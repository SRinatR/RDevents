import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { getProvider } from './providers/index.js';
import { addEvent, updateRunProgress, completeRun } from './system-reports.service.js';

const prisma = new PrismaClient();

const REPORTS_STORAGE_ROOT =
  process.env.SYSTEM_REPORTS_STORAGE_DIR ?? '/opt/rdevents/runtime/reports';

const MAX_ARTIFACT_SIZE_BYTES =
  Number(process.env.SYSTEM_REPORTS_MAX_ARTIFACT_BYTES ?? 100 * 1024 * 1024);

export interface WorkerContext {
  runId: string;
  templateId?: string;
  options: Record<string, unknown>;
  redactionLevel: 'strict' | 'standard' | 'off';
}

export type PreparedArtifact = {
  kind: 'report' | 'attachment' | 'log' | 'metadata';
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  checksum: string;
};

interface SectionResult {
  key: string;
  success: boolean;
  content?: string;
  error?: string;
  warnings?: string[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDirForFile(storagePath: string): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
}

async function writeArtifactFile(storagePath: string, content: Buffer | string): Promise<void> {
  await ensureDirForFile(storagePath);
  await writeFile(storagePath, content);
}

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

type ReportFormat = 'txt' | 'json' | 'md' | 'zip';

function normalizeReportFormat(value: unknown): ReportFormat {
  return value === 'json' || value === 'md' || value === 'zip' ? value : 'txt';
}

function safeZipFileName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

async function persistArtifact(
  artifacts: PreparedArtifact[],
  params: {
    kind: PreparedArtifact['kind'];
    fileName: string;
    mimeType: string;
    storagePath: string;
    content: Buffer | string;
  }
): Promise<void> {
  const buffer = Buffer.isBuffer(params.content)
    ? params.content
    : Buffer.from(params.content, 'utf-8');

  if (buffer.length > MAX_ARTIFACT_SIZE_BYTES) {
    throw new Error(`Artifact ${params.fileName} is too large: ${buffer.length} bytes`);
  }

  await writeArtifactFile(params.storagePath, buffer);

  artifacts.push({
    kind: params.kind,
    fileName: params.fileName,
    mimeType: params.mimeType,
    storagePath: params.storagePath,
    sizeBytes: buffer.length,
    checksum: sha256(buffer),
  });
}

async function prepareArtifacts(
  content: string,
  run: any,
  results: SectionResult[]
): Promise<PreparedArtifact[]> {
  const artifacts: PreparedArtifact[] = [];

  const storageDir = path.join(REPORTS_STORAGE_ROOT, run.id);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `report-${run.id}-${timestamp}`;

  const format = normalizeReportFormat(
    run.configJson && typeof run.configJson === 'object' && 'format' in run.configJson
      ? (run.configJson as any).format
      : 'txt'
  );

  const metadata = {
    generatedAt: new Date().toISOString(),
    runId: run.id,
    templateId: run.templateId ?? null,
    format,
    config: run.configJson,
    results: results.map((result) => ({
      key: result.key,
      success: result.success,
      error: result.error ?? null,
      warnings: result.warnings ?? [],
    })),
  };

  const summaryJson = JSON.stringify(metadata, null, 2);

  if (format === 'txt') {
    await persistArtifact(artifacts, {
      kind: 'report',
      fileName: `${baseName}.txt`,
      mimeType: 'text/plain; charset=utf-8',
      storagePath: path.join(storageDir, `${baseName}.txt`),
      content,
    });

    await persistArtifact(artifacts, {
      kind: 'metadata',
      fileName: `${baseName}-meta.json`,
      mimeType: 'application/json',
      storagePath: path.join(storageDir, `${baseName}-meta.json`),
      content: summaryJson,
    });

    return artifacts;
  }

  if (format === 'json') {
    const jsonContent = JSON.stringify(
      {
        ...metadata,
        reportText: content,
        sections: results,
      },
      null,
      2
    );

    await persistArtifact(artifacts, {
      kind: 'report',
      fileName: `${baseName}.json`,
      mimeType: 'application/json',
      storagePath: path.join(storageDir, `${baseName}.json`),
      content: jsonContent,
    });

    await persistArtifact(artifacts, {
      kind: 'attachment',
      fileName: `${baseName}.txt`,
      mimeType: 'text/plain; charset=utf-8',
      storagePath: path.join(storageDir, `${baseName}.txt`),
      content,
    });

    await persistArtifact(artifacts, {
      kind: 'metadata',
      fileName: `${baseName}-meta.json`,
      mimeType: 'application/json',
      storagePath: path.join(storageDir, `${baseName}-meta.json`),
      content: summaryJson,
    });

    return artifacts;
  }

  if (format === 'md') {
    await persistArtifact(artifacts, {
      kind: 'report',
      fileName: `${baseName}.md`,
      mimeType: 'text/markdown; charset=utf-8',
      storagePath: path.join(storageDir, `${baseName}.md`),
      content,
    });

    await persistArtifact(artifacts, {
      kind: 'attachment',
      fileName: `${baseName}.txt`,
      mimeType: 'text/plain; charset=utf-8',
      storagePath: path.join(storageDir, `${baseName}.txt`),
      content,
    });

    await persistArtifact(artifacts, {
      kind: 'metadata',
      fileName: `${baseName}-meta.json`,
      mimeType: 'application/json',
      storagePath: path.join(storageDir, `${baseName}-meta.json`),
      content: summaryJson,
    });

    return artifacts;
  }

  if (format === 'zip') {
    const zip = new JSZip();

    zip.file('report.txt', content);
    zip.file('metadata.json', summaryJson);

    const sectionsFolder = zip.folder('sections');

    for (const result of results) {
      const sectionFileName = `${safeZipFileName(result.key)}.txt`;

      const sectionText = [
        `# ${result.key}`,
        '',
        `success: ${result.success}`,
        result.error ? `error: ${result.error}` : null,
        result.warnings?.length ? `warnings: ${result.warnings.join(', ')}` : null,
        '',
        result.content ?? '',
      ]
        .filter(Boolean)
        .join('\n');

      sectionsFolder?.file(sectionFileName, sectionText);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    });

    await persistArtifact(artifacts, {
      kind: 'report',
      fileName: `${baseName}.zip`,
      mimeType: 'application/zip',
      storagePath: path.join(storageDir, `${baseName}.zip`),
      content: zipBuffer,
    });

    return artifacts;
  }

  throw new Error(`Unsupported report format: ${format}`);
}

async function processRun(runId: string): Promise<void> {
  const run = await prisma.systemReportRun.findUnique({
    where: { id: runId },
    include: {
      template: true,
    },
  });

  if (!run) {
    console.error(`[ReportWorker] Run ${runId} not found`);
    return;
  }

  if (run.status !== 'queued') {
    console.log(`[ReportWorker] Run ${runId} is not queued (status: ${run.status}), skipping`);
    return;
  }

  console.log(`[ReportWorker] Processing run ${runId}`);

  try {
    await prisma.systemReportRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        stage: 'collecting',
        startedAt: new Date(),
        progressPercent: 0,
      },
    });

    await addEvent(runId, 'info', 'RUN_STARTED', 'Report generation started');

    const config = run.configJson as {
      sections: Array<{ key: string; enabled: boolean; options: Record<string, unknown> }>;
      redactionLevel: string;
    };

    const enabledSections = config.sections.filter(s => s.enabled);
    const results: SectionResult[] = [];

    const totalSteps = enabledSections.length;
    let completedSteps = 0;

    for (const section of enabledSections) {
      const provider = getProvider(section.key);

      if (!provider) {
        console.warn(`[ReportWorker] Provider ${section.key} not found`);
        results.push({
          key: section.key,
          success: false,
          error: `Provider ${section.key} not found`,
        });
        completedSteps++;
        continue;
      }

      console.log(`[ReportWorker] Collecting section: ${section.key}`);

      try {
        const result = await provider.collect({
          runId,
          templateId: run.templateId || undefined,
          options: section.options || {},
          redactionLevel: config.redactionLevel as 'strict' | 'standard' | 'off',
        });

        results.push({
          key: section.key,
          success: result.success,
          content: result.data?.content,
          error: result.error,
          warnings: result.warnings,
        });

        if (!result.success && result.error) {
          await addEvent(runId, 'error', 'SECTION_FAILED', `Section "${section.key}" failed: ${result.error}`);
        } else if (result.warnings && result.warnings.length > 0) {
          for (const warning of result.warnings) {
            await addEvent(runId, 'warning', 'SECTION_WARNING', `Section "${section.key}" warning: ${warning}`);
          }
        } else {
          await addEvent(runId, 'info', 'SECTION_COMPLETED', `Section "${section.key}" collected successfully`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ReportWorker] Section ${section.key} threw error:`, error);
        results.push({
          key: section.key,
          success: false,
          error: errorMsg,
        });
        await addEvent(runId, 'error', 'SECTION_ERROR', `Section "${section.key}" threw error: ${errorMsg}`);
      }

      completedSteps++;
      const progress = Math.round((completedSteps / totalSteps) * 80);
      await updateRunProgress(runId, 'collecting', progress);
    }

    await updateRunProgress(runId, 'assembling', 80);
    await addEvent(runId, 'info', 'ASSEMBLING_STARTED', 'Assembling report from sections');

    const reportContent = assembleReport(results, config.redactionLevel as 'strict' | 'standard' | 'off');
    const artifactsData = await prepareArtifacts(reportContent, run, results);

    await updateRunProgress(runId, 'writing_artifacts', 90);
    await addEvent(runId, 'info', 'ARTIFACTS_WRITING', `Writing ${artifactsData.length} artifact(s)`);

    for (const artifact of artifactsData) {
      await prisma.systemReportArtifact.create({
        data: {
          runId,
          kind: artifact.kind,
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
          storagePath: artifact.storagePath,
          sizeBytes: artifact.sizeBytes,
          checksum: artifact.checksum,
        },
      });
    }

    await updateRunProgress(runId, 'finalizing', 95);
    await addEvent(runId, 'info', 'FINALIZING', 'Finalizing report run');

    const hasErrors = results.some(r => !r.success);
    const successCount = results.filter(r => r.success).length;

    await completeRun(runId, {
      status: hasErrors ? 'partial_success' : 'success',
      summary: {
        totalSections: enabledSections.length,
        successfulSections: successCount,
        failedSections: enabledSections.length - successCount,
        artifactsCount: artifactsData.length,
        results: results.map(r => ({
          key: r.key,
          success: r.success,
          error: r.error,
        })),
      },
    });

    await addEvent(runId, 'info', 'RUN_COMPLETED', `Report generation completed with status: ${hasErrors ? 'partial_success' : 'success'}`);

    console.log(`[ReportWorker] Run ${runId} completed successfully`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ReportWorker] Run ${runId} failed:`, error);

    await addEvent(runId, 'error', 'RUN_FAILED', `Report generation failed: ${errorMsg}`);

    await completeRun(runId, {
      status: 'failed',
      errorText: errorMsg,
      summary: {
        failedAt: new Date().toISOString(),
        error: errorMsg,
      },
    });
  }
}

function assembleReport(
  results: Array<{ key: string; success: boolean; content?: string; error?: string }>,
  redactionLevel: 'strict' | 'standard' | 'off'
): string {
  const lines: string[] = [
    '# System Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Redaction Level: ${redactionLevel}`,
    '',
    '---',
    '',
  ];

  for (const result of results) {
    lines.push(`## ${result.key}`);
    lines.push('');

    if (result.success && result.content) {
      lines.push(result.content);
    } else if (result.error) {
      lines.push(`**ERROR:** ${result.error}`);
    } else {
      lines.push('*(No data)*');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export async function startWorker(pollIntervalMs = 5000): Promise<() => void> {
  console.log(`[ReportWorker] Starting worker with ${pollIntervalMs}ms poll interval`);

  let running = true;

  const runLoop = async () => {
    while (running) {
      try {
        const queuedRuns = await prisma.systemReportRun.findMany({
          where: { status: 'queued' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        });

        if (queuedRuns.length > 0) {
          const run = queuedRuns[0];
          console.log(`[ReportWorker] Found queued run: ${run.id}`);
          await processRun(run.id);
        }
      } catch (error) {
        console.error('[ReportWorker] Error in worker loop:', error);
      }

      await sleep(pollIntervalMs);
    }

    console.log('[ReportWorker] Worker loop stopped');
  };

  runLoop().catch(console.error);

  return () => {
    console.log('[ReportWorker] Shutting down worker...');
    running = false;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker();
}