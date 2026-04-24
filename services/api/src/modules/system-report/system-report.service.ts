import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, statSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

const RUNTIME_ADMIN = '/opt/rdevents/runtime/admin';
const RUNTIME_CONTROL = '/opt/rdevents/runtime/control';
const REPORTS_DIR = '/opt/rdevents/runtime/reports';

const LEGACY_STATUS_FILE = 'system-report-status.json';
const LEGACY_META_FILE = 'system-report-meta.json';
const LEGACY_REPORT_FILE = 'system-report.txt';
const REQUEST_FILE = 'system-report-refresh-request.json';

export interface ReportSectionConfig {
  key: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface ReportConfig {
  sections: ReportSectionConfig[];
  format: 'txt' | 'json' | 'md' | 'zip';
  dateRange?: {
    start?: string;
    end?: string;
  };
  detailLevel?: 'basic' | 'detailed';
  maskSensitiveData: boolean;
}

export interface ReportTemplate {
  id?: string;
  name: string;
  description?: string;
  config: ReportConfig;
  isDefault?: boolean;
}

export interface GenerationStatus {
  id: string;
  templateId?: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  progress: number;
  format: string;
  outputPath?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  sections?: Array<{
    key: string;
    label: string;
    status: string;
    message?: string;
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    contentType: string;
  }>;
}

function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tempPath, content, 'utf-8');
  renameSync(tempPath, filePath);
}

function redactSecrets(text: string): string {
  return text
    .replace(/(DATABASE_URL=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(JWT_[A-Z_]*=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(RESEND_API_KEY=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(POSTGRES_PASSWORD=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(# vault:)[^|]*/g, '$1[REDACTED]')
    .replace(/(password[=:])[^&\s]*/gi, '$1[REDACTED]')
    .replace(/(secret[=:])[^&\s]*/gi, '$1[REDACTED]');
}

export async function getTemplates(userId: string) {
  const templates = await prisma.systemReportTemplate.findMany({
    where: { createdById: userId },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' }
    ],
  });

  return templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isDefault: t.isDefault,
    config: t.configJson as unknown as ReportConfig,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function createTemplate(userId: string, template: Omit<ReportTemplate, 'id'>) {
  if (template.isDefault) {
    await prisma.systemReportTemplate.updateMany({
      where: { createdById: userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const created = await prisma.systemReportTemplate.create({
    data: {
      name: template.name,
      description: template.description,
      isDefault: template.isDefault ?? false,
      configJson: template.config as any,
      createdById: userId,
    },
  });

  return {
    id: created.id,
    name: created.name,
    description: created.description,
    isDefault: created.isDefault,
    config: created.configJson as unknown as ReportConfig,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function updateTemplate(userId: string, templateId: string, updates: Partial<ReportTemplate>) {
  const existing = await prisma.systemReportTemplate.findFirst({
    where: { id: templateId, createdById: userId },
  });

  if (!existing) {
    throw new Error('Template not found');
  }

  if (updates.isDefault) {
    await prisma.systemReportTemplate.updateMany({
      where: { createdById: userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.systemReportTemplate.update({
    where: { id: templateId },
    data: {
      name: updates.name,
      description: updates.description,
      isDefault: updates.isDefault,
      configJson: updates.config as any,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    isDefault: updated.isDefault,
    config: updated.configJson as unknown as ReportConfig,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deleteTemplate(userId: string, templateId: string) {
  const existing = await prisma.systemReportTemplate.findFirst({
    where: { id: templateId, createdById: userId },
  });

  if (!existing) {
    throw new Error('Template not found');
  }

  await prisma.systemReportTemplate.delete({
    where: { id: templateId },
  });
}

export async function getGenerationHistory(userId: string, limit = 20) {
  const generations = await prisma.systemReportGeneration.findMany({
    where: { createdById: userId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      sections: {
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return generations.map(g => ({
    id: g.id,
    templateId: g.templateId,
    templateName: g.template?.name,
    status: g.status,
    progress: g.progress,
    format: g.format,
    outputPath: g.outputPath,
    errorMessage: g.errorMessage,
    startedAt: g.startedAt?.toISOString(),
    completedAt: g.completedAt?.toISOString(),
    createdAt: g.createdAt.toISOString(),
    sections: g.sections.map(s => ({
      key: s.sectionKey,
      label: s.sectionLabel,
      status: s.status,
      message: s.message,
    })),
    attachments: g.attachments.map(a => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      contentType: a.contentType,
    })),
  }));
}

export async function getGenerationStatus(generationId: string, userId: string) {
  const generation = await prisma.systemReportGeneration.findFirst({
    where: { id: generationId, createdById: userId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      sections: {
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
  });

  if (!generation) {
    throw new Error('Generation not found');
  }

  return {
    id: generation.id,
    templateId: generation.templateId,
    templateName: generation.template?.name,
    status: generation.status,
    progress: generation.progress,
    format: generation.format,
    outputPath: generation.outputPath,
    errorMessage: generation.errorMessage,
    startedAt: generation.startedAt?.toISOString(),
    completedAt: generation.completedAt?.toISOString(),
    createdAt: generation.createdAt.toISOString(),
    sections: generation.sections.map(s => ({
      key: s.sectionKey,
      label: s.sectionLabel,
      status: s.status,
      message: s.message,
      startedAt: s.startedAt?.toISOString(),
      completedAt: s.completedAt?.toISOString(),
    })),
    attachments: generation.attachments.map(a => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      contentType: a.contentType,
    })),
  };
}

export async function startGeneration(userId: string, userEmail: string, config: ReportConfig, templateId?: string) {
  const existingActive = await prisma.systemReportGeneration.findFirst({
    where: {
      createdById: userId,
      status: { in: ['queued', 'running'] },
    },
  });

  if (existingActive) {
    throw new Error('Generation already in progress');
  }

  const generation = await prisma.systemReportGeneration.create({
    data: {
      templateId: templateId || null,
      status: 'queued',
      progress: 0,
      format: config.format,
      createdById: userId,
    },
  });

  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);
  const requestPayload = {
    requestId: generation.id,
    requestedAt: new Date().toISOString(),
    requestedByUserId: userId,
    requestedByEmail: userEmail,
    config: config,
  };

  let fd: number | null = null;
  try {
    fd = openSync(requestPath, 'wx');
    writeFileSync(fd, JSON.stringify(requestPayload, null, 2), 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      unlinkSync(requestPath);
      fd = openSync(requestPath, 'wx');
      writeFileSync(fd, JSON.stringify(requestPayload, null, 2), 'utf-8');
    } else {
      throw err;
    }
  } finally {
    if (fd !== null) closeSync(fd);
  }

  return {
    id: generation.id,
    status: 'queued',
    progress: 0,
    format: config.format,
    createdAt: generation.createdAt.toISOString(),
  };
}

export async function downloadReport(generationId: string, userId: string) {
  const generation = await prisma.systemReportGeneration.findFirst({
    where: { id: generationId, createdById: userId },
  });

  if (!generation) {
    throw new Error('Generation not found');
  }

  if (generation.status !== 'success') {
    throw new Error('Report not ready');
  }

  if (!generation.outputPath || !existsSync(generation.outputPath)) {
    throw new Error('Report file not found');
  }

  const content = readFileSync(generation.outputPath, 'utf-8');
  const stat = statSync(generation.outputPath);
  const hash = createHash('sha256').update(content).digest('hex');

  return {
    content,
    fileName: `system-report-${generationId}.${generation.format}`,
    fileSize: stat.size,
    mimeType: generation.format === 'json' ? 'application/json' :
              generation.format === 'md' ? 'text/markdown' :
              generation.format === 'zip' ? 'application/zip' :
              'text/plain',
    sha256: hash,
  };
}

export async function getAvailableSections() {
  return [
    {
      key: 'release',
      label: 'Release / Deploy',
      description: 'Current release SHA, container versions, deploy history',
      defaultParams: {
        deployHistoryLimit: 5,
        includeLogs: false,
      },
    },
    {
      key: 'health',
      label: 'Application Health',
      description: '/health and /ready checks, uptime, build metadata',
      defaultParams: {
        includeBuildMetadata: true,
      },
    },
    {
      key: 'docker',
      label: 'Docker / Containers',
      description: 'Container status, health, restart counts, image info',
      defaultParams: {
        includeLogs: false,
        logLines: 50,
        includeImageDigests: false,
      },
    },
    {
      key: 'systemd',
      label: 'Systemd / Host',
      description: 'Service units status, failed units, journal logs',
      defaultParams: {
        units: ['rdevents-api', 'rdevents-web', 'rdevents-db'],
        includeFailedOnly: false,
      },
    },
    {
      key: 'database',
      label: 'Database',
      description: 'Connectivity, migrations, table counts, recent errors',
      defaultParams: {
        detailLevel: 'summary',
        includeSlowQueries: true,
        slowQueryThreshold: 1000,
      },
    },
    {
      key: 'storage',
      label: 'Storage / Runtime',
      description: 'Runtime directories, disk space, large files summary',
      defaultParams: {
        largeFileThreshold: 100 * 1024 * 1024,
      },
    },
    {
      key: 'security',
      label: 'Security / Config',
      description: 'Env validation, secrets masking, CORS config',
      defaultParams: {
        redactionLevel: 'strict',
      },
    },
    {
      key: 'performance',
      label: 'Performance / Diagnostics',
      description: 'Response times, error counters, queue indicators',
      defaultParams: {
        timeWindow: '1h',
      },
    },
    {
      key: 'audit',
      label: 'Audit / Activity',
      description: 'Recent admin actions, report runs, changes',
      defaultParams: {
        limit: 20,
      },
    },
  ];
}

export async function getLegacyStatus() {
  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);
  const reportPath = join(RUNTIME_ADMIN, LEGACY_REPORT_FILE);
  const statusPath = join(RUNTIME_ADMIN, LEGACY_STATUS_FILE);
  const metaPath = join(RUNTIME_ADMIN, LEGACY_META_FILE);

  const reportExists = existsSync(reportPath);
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf-8')) : null;
  const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf-8')) : null;
  const requestData = existsSync(requestPath) ? JSON.parse(readFileSync(requestPath, 'utf-8')) : null;

  if (requestData) {
    return {
      state: status?.state === 'running' ? 'running' : 'queued',
      requestId: requestData.requestId,
      requestedAt: requestData.requestedAt,
      requestedByUserId: requestData.requestedByUserId,
      requestedByEmail: requestData.requestedByEmail,
      startedAt: status?.startedAt ?? null,
      completedAt: status?.completedAt ?? null,
      lastSuccessAt: status?.lastSuccessAt ?? null,
      lastError: status?.lastError ?? null,
      fileName: meta?.fileName ?? null,
      generatedAt: meta?.generatedAt ?? null,
      fileSizeBytes: meta?.fileSizeBytes ?? null,
      sha256: meta?.sha256 ?? null,
      reportExists,
      downloadAvailable: reportExists && meta !== null,
    };
  }

  return {
    state: status?.state ?? 'idle',
    requestId: status?.requestId ?? null,
    requestedAt: status?.requestedAt ?? null,
    requestedByUserId: status?.requestedByUserId ?? null,
    requestedByEmail: status?.requestedByEmail ?? null,
    startedAt: status?.startedAt ?? null,
    completedAt: status?.completedAt ?? null,
    lastSuccessAt: status?.lastSuccessAt ?? null,
    lastError: status?.lastError ?? null,
    fileName: meta?.fileName ?? null,
    generatedAt: meta?.generatedAt ?? null,
    fileSizeBytes: meta?.fileSizeBytes ?? null,
    sha256: meta?.sha256 ?? null,
    reportExists,
    downloadAvailable: reportExists && meta !== null,
  };
}

export async function downloadLegacyReport() {
  const reportPath = join(RUNTIME_ADMIN, LEGACY_REPORT_FILE);

  if (!existsSync(reportPath)) {
    throw new Error('Report file not found');
  }

  const content = readFileSync(reportPath, 'utf-8');
  const stat = statSync(reportPath);
  const hash = createHash('sha256').update(content).digest('hex');

  return {
    content,
    fileName: 'system-report.txt',
    fileSize: stat.size,
    mimeType: 'text/plain',
    sha256: hash,
  };
}

export async function initializeDefaultTemplates(userId: string) {
  const existing = await prisma.systemReportTemplate.findMany({
    where: { createdById: userId },
  });

  if (existing.length > 0) {
    return;
  }

  const defaultTemplates: Array<Omit<ReportTemplate, 'id'>> = [
    {
      name: 'Health Report',
      description: 'Basic system health check with critical metrics',
      isDefault: true,
      config: {
        sections: [
          { key: 'health', enabled: true, params: { includeBuildMetadata: true } },
          { key: 'docker', enabled: true, params: { includeLogs: false } },
          { key: 'database', enabled: true, params: { detailLevel: 'summary' } },
        ],
        format: 'txt',
        maskSensitiveData: true,
      },
    },
    {
      name: 'Full Infrastructure',
      description: 'Complete infrastructure diagnostics',
      isDefault: false,
      config: {
        sections: [
          { key: 'release', enabled: true, params: { deployHistoryLimit: 10, includeLogs: true } },
          { key: 'health', enabled: true, params: { includeBuildMetadata: true } },
          { key: 'docker', enabled: true, params: { includeLogs: true, logLines: 100 } },
          { key: 'systemd', enabled: true, params: { includeFailedOnly: false } },
          { key: 'database', enabled: true, params: { detailLevel: 'detailed', includeSlowQueries: true } },
          { key: 'storage', enabled: true, params: { largeFileThreshold: 50 * 1024 * 1024 } },
        ],
        format: 'zip',
        maskSensitiveData: true,
      },
    },
    {
      name: 'Deploy Diagnostics',
      description: 'Focused on deployment and release information',
      isDefault: false,
      config: {
        sections: [
          { key: 'release', enabled: true, params: { deployHistoryLimit: 20, includeLogs: true } },
          { key: 'docker', enabled: true, params: { includeImageDigests: true } },
          { key: 'systemd', enabled: true, params: {} },
        ],
        format: 'json',
        maskSensitiveData: true,
      },
    },
    {
      name: 'Security Audit',
      description: 'Security and configuration review',
      isDefault: false,
      config: {
        sections: [
          { key: 'security', enabled: true, params: { redactionLevel: 'strict' } },
          { key: 'database', enabled: true, params: { detailLevel: 'summary' } },
          { key: 'audit', enabled: true, params: { limit: 50 } },
        ],
        format: 'md',
        maskSensitiveData: true,
      },
    },
  ];

  for (const template of defaultTemplates) {
    await createTemplate(userId, template);
  }
}
