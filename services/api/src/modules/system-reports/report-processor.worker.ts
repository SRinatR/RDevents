import { PrismaClient } from '@prisma/client';
import { getProviders, getProvider } from './providers/index.js';
import { addEvent, updateRunProgress, completeRun } from './system-reports.service.js';

const prisma = new PrismaClient();

export interface WorkerContext {
  runId: string;
  templateId?: string;
  options: Record<string, unknown>;
  redactionLevel: 'strict' | 'standard' | 'off';
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    const providers = getProviders();
    const results: Array<{ key: string; success: boolean; content?: string; error?: string; warnings?: string[] }> = [];

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
    const artifactsData = prepareArtifacts(reportContent, run);

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

function prepareArtifacts(content: string, run: any): Array<{
  kind: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  checksum: string;
}> {
  const artifacts: Array<{
    kind: string;
    fileName: string;
    mimeType: string;
    storagePath: string;
    sizeBytes: number;
    checksum: string;
  }> = [];

  const storageDir = '/var/lib/rdevents/reports';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `report-${run.id}-${timestamp}`;

  const checksum = require('crypto')
    .createHash('sha256')
    .update(content)
    .digest('hex');

  const artifact = {
    kind: 'report',
    fileName: `${baseName}.txt`,
    mimeType: 'text/plain; charset=utf-8',
    storagePath: `${storageDir}/${baseName}.txt`,
    sizeBytes: Buffer.byteLength(content, 'utf-8'),
    checksum,
  };

  artifacts.push(artifact);

  if (run.configJson && typeof run.configJson === 'object' && 'format' in run.configJson) {
    const format = (run.configJson as any).format;

    if (format === 'json') {
      const jsonContent = JSON.stringify({
        generated: new Date().toISOString(),
        runId: run.id,
        report: content,
      }, null, 2);

      artifacts.push({
        kind: 'report',
        fileName: `${baseName}.json`,
        mimeType: 'application/json',
        storagePath: `${storageDir}/${baseName}.json`,
        sizeBytes: Buffer.byteLength(jsonContent, 'utf-8'),
        checksum: require('crypto')
          .createHash('sha256')
          .update(jsonContent)
          .digest('hex'),
      });
    } else if (format === 'md') {
      artifacts.push({
        kind: 'report',
        fileName: `${baseName}.md`,
        mimeType: 'text/markdown; charset=utf-8',
        storagePath: `${storageDir}/${baseName}.md`,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
        checksum,
      });
    } else if (format === 'zip') {
      const metadata = {
        generated: new Date().toISOString(),
        runId: run.id,
        templateId: run.templateId,
        config: run.configJson,
      };

      artifacts.push({
        kind: 'metadata',
        fileName: `${baseName}-meta.json`,
        mimeType: 'application/json',
        storagePath: `${storageDir}/${baseName}-meta.json`,
        sizeBytes: Buffer.byteLength(JSON.stringify(metadata), 'utf-8'),
        checksum: require('crypto')
          .createHash('sha256')
          .update(JSON.stringify(metadata))
          .digest('hex'),
      });
    }
  }

  return artifacts;
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
  startWorker()
    .then(stop => {
      console.log('[ReportWorker] Worker started');

      process.on('SIGINT', async () => {
        console.log('[ReportWorker] Received SIGINT');
        await stop();
        await prisma.$disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('[ReportWorker] Received SIGTERM');
        await stop();
        await prisma.$disconnect();
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('[ReportWorker] Failed to start:', error);
      process.exit(1);
    });
}
