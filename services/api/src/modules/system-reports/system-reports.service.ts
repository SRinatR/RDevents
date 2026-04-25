import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ReportStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial_success' | 'canceled' | 'stale';
export type ReportStage = 'queued' | 'collecting' | 'assembling' | 'writing_artifacts' | 'finalizing';
export type ReportFormat = 'txt' | 'json' | 'md' | 'zip';
export type RedactionLevel = 'strict' | 'standard' | 'off';

export interface ReportConfig {
  format: ReportFormat;
  sections: Array<{
    key: string;
    enabled: boolean;
    options: Record<string, unknown>;
  }>;
  redactionLevel: RedactionLevel;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface ReportSectionDefinition {
  key: string;
  label: string;
  description: string;
  category: 'system' | 'application' | 'infrastructure' | 'security';
  options: Array<{
    key: string;
    type: 'boolean' | 'number' | 'select' | 'text';
    label: string;
    default?: unknown;
    required?: boolean;
    options?: unknown[];
  }>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isDefault: boolean;
  config: ReportConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRun {
  id: string;
  templateId?: string;
  templateName?: string;
  title?: string;
  status: ReportStatus;
  stage?: ReportStage;
  progressPercent: number;
  config: ReportConfig;
  summary?: Record<string, unknown>;
  errorText?: string;
  requestedByEmail: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  artifacts: ReportArtifact[];
  events: ReportEvent[];
}

export interface ReportArtifact {
  id: string;
  kind: 'report' | 'attachment' | 'log' | 'metadata';
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  checksum?: string;
  createdAt: string;
}

export interface ReportEvent {
  id: string;
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface ReportConfigResponse {
  sections: ReportSectionDefinition[];
  formats: Array<{ value: ReportFormat; label: string }>;
  redactionLevels: Array<{ value: RedactionLevel; label: string; description: string }>;
  limits: {
    maxArtifacts: number;
    maxArtifactSize: number;
    maxReportSize: number;
  };
}

const REPORT_SECTIONS: ReportSectionDefinition[] = [
  {
    key: 'release',
    label: 'Release / Deploy',
    description: 'Current release SHA, container versions, deploy history',
    category: 'system',
    options: [
      { key: 'includeCommitInfo', type: 'boolean', label: 'Include commit info', default: true },
      { key: 'deployHistoryLimit', type: 'number', label: 'Deploy history limit', default: 5 },
      { key: 'includeLogs', type: 'boolean', label: 'Include deploy logs', default: false },
    ],
  },
  {
    key: 'health',
    label: 'Application Health',
    description: '/health and /ready checks, uptime, build metadata',
    category: 'application',
    options: [
      { key: 'includeBuildMetadata', type: 'boolean', label: 'Include build metadata', default: true },
      { key: 'checkEndpoints', type: 'boolean', label: 'Check health endpoints', default: true },
    ],
  },
  {
    key: 'docker',
    label: 'Docker / Containers',
    description: 'Container status, health, restart counts',
    category: 'infrastructure',
    options: [
      { key: 'includeLogs', type: 'boolean', label: 'Include container logs', default: false },
      { key: 'logLines', type: 'number', label: 'Log lines to include', default: 50 },
      { key: 'includeImageDigests', type: 'boolean', label: 'Include image digests', default: false },
    ],
  },
  {
    key: 'systemd',
    label: 'Systemd / Host',
    description: 'Service units status, failed units, journal logs',
    category: 'infrastructure',
    options: [
      { key: 'units', type: 'select', label: 'Service units', default: ['rdevents-api', 'rdevents-web'] },
      { key: 'includeFailedOnly', type: 'boolean', label: 'Failed units only', default: false },
    ],
  },
  {
    key: 'database',
    label: 'Database',
    description: 'Connectivity, migrations, table counts',
    category: 'application',
    options: [
      { key: 'detailLevel', type: 'select', label: 'Detail level', default: 'summary', options: ['summary', 'detailed'] },
      { key: 'includeSlowQueries', type: 'boolean', label: 'Include slow queries', default: true },
    ],
  },
  {
    key: 'storage',
    label: 'Storage / Runtime',
    description: 'Runtime directories, disk space, large files',
    category: 'infrastructure',
    options: [
      { key: 'largeFileThreshold', type: 'number', label: 'Large file threshold (MB)', default: 100 },
    ],
  },
  {
    key: 'security',
    label: 'Security / Config',
    description: 'Env validation, secrets masking, CORS config',
    category: 'security',
    options: [
      { key: 'redactionLevel', type: 'select', label: 'Redaction level', default: 'standard', options: ['strict', 'standard'] },
    ],
  },
  {
    key: 'performance',
    label: 'Performance / Diagnostics',
    description: 'Response times, error counters, queue indicators',
    category: 'application',
    options: [
      { key: 'timeWindow', type: 'select', label: 'Time window', default: '1h', options: ['1h', '6h', '24h', '7d'] },
    ],
  },
  {
    key: 'audit',
    label: 'Audit / Activity',
    description: 'Recent admin actions, report runs, changes',
    category: 'system',
    options: [
      { key: 'limit', type: 'number', label: 'Activity limit', default: 50 },
    ],
  },
];

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function getConfig(): Promise<ReportConfigResponse> {
  return {
    sections: REPORT_SECTIONS,
    formats: [
      { value: 'txt', label: 'Plain Text (.txt)' },
      { value: 'json', label: 'JSON (.json)' },
      { value: 'md', label: 'Markdown (.md)' },
    ],
    redactionLevels: [
      { value: 'strict', label: 'Strict', description: 'All sensitive data masked, recommended for external sharing' },
      { value: 'standard', label: 'Standard', description: 'Secrets masked, internal data visible' },
      { value: 'off', label: 'No Redaction', description: 'Full data, super admin only, explicit warning' },
    ],
    limits: {
      maxArtifacts: 50,
      maxArtifactSize: 100 * 1024 * 1024,
      maxReportSize: 50 * 1024 * 1024,
    },
  };
}

export async function getTemplates(userId: string): Promise<ReportTemplate[]> {
  const templates = await prisma.systemReportTemplate.findMany({
    where: { createdById: userId },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
  });

  return templates.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description || undefined,
    isDefault: t.isDefault,
    config: t.configJson as unknown as ReportConfig,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function createTemplate(
  userId: string,
  data: { name: string; description?: string; config: ReportConfig; isDefault?: boolean }
): Promise<ReportTemplate> {
  const slug = createSlug(data.name);

  if (data.isDefault) {
    await prisma.systemReportTemplate.updateMany({
      where: { createdById: userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.systemReportTemplate.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      isDefault: data.isDefault ?? false,
      configJson: data.config as unknown as any,
      createdById: userId,
    },
  });

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description || undefined,
    isDefault: template.isDefault,
    config: template.configJson as unknown as ReportConfig,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  data: Partial<{ name: string; description?: string; config: ReportConfig; isDefault?: boolean }>
): Promise<ReportTemplate> {
  const existing = await prisma.systemReportTemplate.findFirst({
    where: { id: templateId, createdById: userId },
  });

  if (!existing) {
    throw new Error('Template not found');
  }

  if (data.isDefault) {
    await prisma.systemReportTemplate.updateMany({
      where: { createdById: userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updateData: any = {
    updatedById: userId,
  };
  if (data.name !== undefined) {
    updateData.name = data.name;
    updateData.slug = createSlug(data.name);
  }
  if (data.description !== undefined) updateData.description = data.description;
  if (data.config !== undefined) updateData.configJson = data.config as unknown as any;
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

  const template = await prisma.systemReportTemplate.update({
    where: { id: templateId },
    data: updateData,
  });

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description || undefined,
    isDefault: template.isDefault,
    config: template.configJson as unknown as ReportConfig,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
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

export async function createRun(
  userId: string,
  userEmail: string,
  data: {
    templateId?: string;
    title?: string;
    format: ReportFormat;
    sections: Array<{ key: string; enabled: boolean; options: Record<string, unknown> }>;
    redactionLevel: RedactionLevel;
  }
): Promise<ReportRun> {
  const config: ReportConfig = {
    format: data.format,
    sections: data.sections,
    redactionLevel: data.redactionLevel,
  };

  let templateName: string | undefined;
  if (data.templateId) {
    const template = await prisma.systemReportTemplate.findUnique({
      where: { id: data.templateId },
    });
    templateName = template?.name;
  }

  const run = await prisma.systemReportRun.create({
    data: {
      templateId: data.templateId || null,
      title: data.title,
      status: 'queued',
      stage: 'queued',
      progressPercent: 0,
      configJson: config as unknown as any,
      requestedByUserId: userId,
      requestedByEmail: userEmail,
    },
  });

  await prisma.systemReportEvent.create({
    data: {
      runId: run.id,
      level: 'info',
      code: 'RUN_CREATED',
      message: `Report run created${templateName ? ` from template "${templateName}"` : ''}`,
    },
  });

  return {
    id: run.id,
    templateId: run.templateId || undefined,
    templateName,
    title: run.title || undefined,
    status: run.status as ReportStatus,
    stage: run.stage as ReportStage | undefined,
    progressPercent: run.progressPercent,
    config,
    requestedByEmail: run.requestedByEmail,
    createdAt: run.createdAt.toISOString(),
    artifacts: [],
    events: [],
  };
}

export async function getRun(runId: string, _userId: string): Promise<ReportRun | null> {
  const run = await prisma.systemReportRun.findFirst({
    where: { id: runId },
    include: {
      template: { select: { id: true, name: true } },
      artifacts: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!run) return null;

  return {
    id: run.id,
    templateId: run.templateId || undefined,
    templateName: run.template?.name,
    title: run.title || undefined,
    status: run.status as ReportStatus,
    stage: run.stage as ReportStage | undefined,
    progressPercent: run.progressPercent,
    config: run.configJson as unknown as ReportConfig,
    summary: run.summaryJson as Record<string, unknown> | undefined,
    errorText: run.errorText || undefined,
    requestedByEmail: run.requestedByEmail,
    startedAt: run.startedAt?.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    createdAt: run.createdAt.toISOString(),
    artifacts: run.artifacts.map(a => ({
      id: a.id,
      kind: a.kind as ReportArtifact['kind'],
      fileName: a.fileName,
      mimeType: a.mimeType,
      storagePath: a.storagePath,
      sizeBytes: a.sizeBytes,
      checksum: a.checksum || undefined,
      createdAt: a.createdAt.toISOString(),
    })),
    events: run.events.map(e => ({
      id: e.id,
      level: e.level as ReportEvent['level'],
      code: e.code,
      message: e.message,
      payload: e.payloadJson as Record<string, unknown> | undefined,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function getRuns(
  userId: string,
  filters?: {
    status?: ReportStatus[];
    templateId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ReportRun[]> {
  const where: any = {};

  if (filters?.status?.length) {
    where.status = { in: filters.status };
  }
  if (filters?.templateId) {
    where.templateId = filters.templateId;
  }
  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const runs = await prisma.systemReportRun.findMany({
    where,
    include: {
      template: { select: { id: true, name: true } },
      artifacts: true,
      events: { take: 10, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return runs.map(run => ({
    id: run.id,
    templateId: run.templateId || undefined,
    templateName: run.template?.name,
    title: run.title || undefined,
    status: run.status as ReportStatus,
    stage: run.stage as ReportStage | undefined,
    progressPercent: run.progressPercent,
    config: run.configJson as unknown as ReportConfig,
    errorText: run.errorText || undefined,
    requestedByEmail: run.requestedByEmail,
    startedAt: run.startedAt?.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    createdAt: run.createdAt.toISOString(),
    artifacts: run.artifacts.map(a => ({
      id: a.id,
      kind: a.kind as ReportArtifact['kind'],
      fileName: a.fileName,
      mimeType: a.mimeType,
      storagePath: a.storagePath,
      sizeBytes: a.sizeBytes,
      checksum: a.checksum || undefined,
      createdAt: a.createdAt.toISOString(),
    })),
    events: run.events.map(e => ({
      id: e.id,
      level: e.level as ReportEvent['level'],
      code: e.code,
      message: e.message,
      payload: e.payloadJson as Record<string, unknown> | undefined,
      createdAt: e.createdAt.toISOString(),
    })),
  }));
}

export async function cancelRun(runId: string, userId: string): Promise<void> {
  const run = await prisma.systemReportRun.findFirst({
    where: { id: runId },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  if (run.status !== 'queued' && run.status !== 'running') {
    throw new Error('Cannot cancel a completed run');
  }

  await prisma.systemReportRun.update({
    where: { id: runId },
    data: {
      status: 'canceled',
      stage: null,
      finishedAt: new Date(),
    },
  });

  await prisma.systemReportEvent.create({
    data: {
      runId,
      level: 'info',
      code: 'RUN_CANCELED',
      message: 'Report run canceled by user',
    },
  });
}

export async function retryRun(runId: string, userId: string, userEmail: string): Promise<ReportRun> {
  const originalRun = await prisma.systemReportRun.findUnique({
    where: { id: runId },
    include: { template: true },
  });

  if (!originalRun) {
    throw new Error('Run not found');
  }

  if (originalRun.status === 'running' || originalRun.status === 'queued') {
    throw new Error('Cannot retry a running or queued run');
  }

  const newRun = await prisma.systemReportRun.create({
    data: {
      templateId: originalRun.templateId,
      title: originalRun.title ? `${originalRun.title} (retry)` : undefined,
      status: 'queued',
      stage: 'queued',
      progressPercent: 0,
      configJson: originalRun.configJson,
      requestedByUserId: userId,
      requestedByEmail: userEmail,
    },
  });

  await prisma.systemReportEvent.create({
    data: {
      runId: newRun.id,
      level: 'info',
      code: 'RUN_CREATED',
      message: `Retry of run ${runId}`,
      payloadJson: { originalRunId: runId } as any,
    },
  });

  return {
    id: newRun.id,
    templateId: newRun.templateId || undefined,
    templateName: originalRun.template?.name,
    title: newRun.title || undefined,
    status: newRun.status as ReportStatus,
    stage: newRun.stage as ReportStage | undefined,
    progressPercent: newRun.progressPercent,
    config: newRun.configJson as unknown as ReportConfig,
    requestedByEmail: newRun.requestedByEmail,
    createdAt: newRun.createdAt.toISOString(),
    artifacts: [],
    events: [],
  };
}

export async function getArtifact(
  runId: string,
  artifactId: string
): Promise<{ content: Buffer; artifact: ReportArtifact } | null> {
  const artifact = await prisma.systemReportArtifact.findFirst({
    where: { id: artifactId, runId },
  });

  if (!artifact) return null;

  const fs = await import('node:fs/promises');

  let content: Buffer;
  try {
    content = await fs.readFile(artifact.storagePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new Error('Artifact file missing on disk');
    }
    throw error;
  }

  return {
    content,
    artifact: {
      id: artifact.id,
      kind: artifact.kind as ReportArtifact['kind'],
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      storagePath: artifact.storagePath,
      sizeBytes: artifact.sizeBytes,
      checksum: artifact.checksum || undefined,
      createdAt: artifact.createdAt.toISOString(),
    },
  };
}

export async function addEvent(
  runId: string,
  level: 'info' | 'warning' | 'error',
  code: string,
  message: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await prisma.systemReportEvent.create({
    data: {
      runId,
      level,
      code,
      message,
      payloadJson: payload as any,
    },
  });
}

export async function updateRunProgress(
  runId: string,
  stage: ReportStage,
  progress: number
): Promise<void> {
  const updateData: any = { stage, progressPercent: progress };

  if (stage === 'collecting' && progress === 0) {
    updateData.startedAt = new Date();
  }

  await prisma.systemReportRun.update({
    where: { id: runId },
    data: updateData,
  });
}

export async function completeRun(
  runId: string,
  options: {
    status: 'success' | 'failed' | 'partial_success';
    errorText?: string;
    summary?: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.systemReportRun.update({
    where: { id: runId },
    data: {
      status: options.status,
      stage: null,
      progressPercent: options.status === 'failed' ? 0 : 100,
      errorText: options.errorText,
      summaryJson: options.summary as unknown as any,
      finishedAt: new Date(),
    },
  });
}

export async function generatePreview(
  config: ReportConfig
): Promise<{
  sections: Array<{
    key: string;
    label: string;
    description: string;
    included: boolean;
  }>;
  estimatedSize: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const sections = config.sections
    .filter(s => s.enabled)
    .map(s => {
      if (s.key === 'docker' && (s.options?.includeLogs as boolean)) {
        warnings.push('Docker logs section may generate large output');
      }
      return {
        key: s.key,
        label: s.key.charAt(0).toUpperCase() + s.key.slice(1),
        description: s.key,
        included: true,
      };
    });

  const estimatedSize = `${Math.max(1, sections.length * 5)}KB`;

  return {
    sections,
    estimatedSize,
    warnings,
  };
}

export async function getRunWithArtifacts(runId: string): Promise<{
  run: ReportRun;
  artifacts: Array<ReportArtifact>;
} | null> {
  const run = await prisma.systemReportRun.findUnique({
    where: { id: runId },
    include: {
      artifacts: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!run) return null;

  return {
    run: {
      id: run.id,
      templateId: run.templateId || undefined,
      title: run.title || undefined,
      status: run.status as ReportStatus,
      stage: run.stage as ReportStage | undefined,
      progressPercent: run.progressPercent,
      config: run.configJson as unknown as ReportConfig,
      summary: run.summaryJson as Record<string, unknown> | undefined,
      errorText: run.errorText || undefined,
      requestedByEmail: run.requestedByEmail,
      startedAt: run.startedAt?.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      createdAt: run.createdAt.toISOString(),
      artifacts: run.artifacts.map(a => ({
        id: a.id,
        kind: a.kind as ReportArtifact['kind'],
        fileName: a.fileName,
        mimeType: a.mimeType,
        storagePath: a.storagePath,
        sizeBytes: a.sizeBytes,
        checksum: a.checksum || undefined,
        createdAt: a.createdAt.toISOString(),
      })),
      events: run.events.map(e => ({
        id: e.id,
        level: e.level as ReportEvent['level'],
        code: e.code,
        message: e.message,
        payload: e.payloadJson as Record<string, unknown> | undefined,
        createdAt: e.createdAt.toISOString(),
      })),
    },
    artifacts: run.artifacts.map(a => ({
      id: a.id,
      kind: a.kind as ReportArtifact['kind'],
      fileName: a.fileName,
      mimeType: a.mimeType,
      storagePath: a.storagePath,
      sizeBytes: a.sizeBytes,
      checksum: a.checksum || undefined,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
