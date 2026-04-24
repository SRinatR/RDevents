import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export type ReportStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'partial_success' | 'canceled' | 'stale';
export type ReportStage = 'queued' | 'collecting' | 'assembling' | 'writing_artifacts' | 'finalizing';
export type ReportFormat = 'txt' | 'json' | 'md' | 'zip';

export interface SectionProvider {
  key: string;
  label: string;
  collect(config: SectionConfig): Promise<SectionData>;
}

export interface SectionConfig {
  key: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface SectionData {
  content: string;
  attachments?: Array<{
    fileName: string;
    content: Buffer | string;
    contentType: string;
  }>;
  warnings?: string[];
}

export interface ReportJob {
  id: string;
  requestId: string;
  config: ReportConfig;
  status: ReportStatus;
  stage?: ReportStage;
  progress: number;
  initiatedBy: {
    userId: string;
    email: string;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  sections: Map<string, SectionJob>;
  artifacts: Artifact[];
}

export interface ReportConfig {
  sections: SectionConfig[];
  format: ReportFormat;
  dateRange?: {
    start?: string;
    end?: string;
  };
  detailLevel?: 'basic' | 'detailed';
  maskSensitiveData: boolean;
}

export interface SectionJob {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  warnings: string[];
}

export interface Artifact {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  filePath: string;
  sectionKey?: string;
}

export interface GenerationSummary {
  id: string;
  requestId: string;
  templateId?: string;
  templateName?: string;
  status: ReportStatus;
  stage?: ReportStage;
  progress: number;
  format: ReportFormat;
  initiatedByEmail?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  artifactCount: number;
  sectionsSummary: Array<{
    key: string;
    label: string;
    status: string;
  }>;
}

class ReportOrchestrator {
  private providers: Map<string, SectionProvider> = new Map();
  private activeJobs: Map<string, ReportJob> = new Map();

  registerProvider(provider: SectionProvider) {
    this.providers.set(provider.key, provider);
  }

  async createJob(
    userId: string,
    userEmail: string,
    config: ReportConfig,
    templateId?: string
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    const generation = await prisma.systemReportGeneration.create({
      data: {
        requestId,
        templateId,
        status: 'queued',
        stage: 'queued',
        progress: 0,
        format: config.format,
        createdById: userId,
        initiatedByEmail: userEmail,
      },
    });

    for (const sectionConfig of config.sections.filter(s => s.enabled)) {
      await prisma.systemReportSectionLog.create({
        data: {
          generationId: generation.id,
          sectionKey: sectionConfig.key,
          sectionLabel: this.getSectionLabel(sectionConfig.key),
          status: 'pending',
        },
      });
    }

    this.scheduleJobProcessing(generation.id, config);

    return generation.id;
  }

  private async scheduleJobProcessing(generationId: string, config: ReportConfig) {
    setImmediate(async () => {
      try {
        await this.processJob(generationId, config);
      } catch (error) {
        console.error(`Job ${generationId} failed:`, error);
        await this.markJobFailed(generationId, error instanceof Error ? error.message : 'Unknown error');
      }
    });
  }

  private async processJob(generationId: string, config: ReportConfig) {
    await this.updateJobStatus(generationId, 'running', 'collecting', 10);

    const enabledSections = config.sections.filter(s => s.enabled);
    const totalSections = enabledSections.length;
    let completedSections = 0;

    const sectionResults: Map<string, SectionData> = new Map();
    const sectionErrors: Map<string, string> = new Map();
    const allWarnings: string[] = [];

    for (const sectionConfig of enabledSections) {
      const provider = this.providers.get(sectionConfig.key);
      if (!provider) {
        sectionErrors.set(sectionConfig.key, `Provider not found: ${sectionConfig.key}`);
        continue;
      }

      try {
        await this.updateSectionStatus(generationId, sectionConfig.key, 'running');
        const data = await provider.collect(sectionConfig);

        sectionResults.set(sectionConfig.key, data);
        await this.updateSectionStatus(generationId, sectionConfig.key, 'completed');

        if (data.warnings) {
          allWarnings.push(...data.warnings);
        }

        completedSections++;
        const progress = 10 + Math.floor((completedSections / totalSections) * 60);
        await this.updateJobProgress(generationId, progress);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sectionErrors.set(sectionConfig.key, errorMessage);
        await this.updateSectionStatus(generationId, sectionConfig.key, 'failed', errorMessage);
      }
    }

    await this.updateJobStatus(generationId, 'running', 'assembling', 75);

    const reportContent = this.assembleReport(sectionResults, config);

    await this.updateJobStatus(generationId, 'running', 'writing_artifacts', 85);

    const artifacts = await this.writeArtifacts(generationId, reportContent, config, sectionResults);

    await this.updateJobStatus(generationId, 'running', 'finalizing', 95);

    const hasErrors = sectionErrors.size > 0;
    const allFailed = sectionErrors.size === totalSections;
    const status = allFailed ? 'failed' : hasErrors ? 'partial_success' : 'success';
    const errorMessage = allFailed ? 'All sections failed' : hasErrors ? `${sectionErrors.size} sections failed` : undefined;

    await prisma.systemReportGeneration.update({
      where: { id: generationId },
      data: {
        status,
        stage: null,
        progress: 100,
        outputPath: artifacts[0]?.filePath,
        errorMessage,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    for (const [sectionKey, error] of sectionErrors) {
      await prisma.systemReportSectionLog.updateMany({
        where: { generationId, sectionKey },
        data: { status: 'failed', message: error, completedAt: new Date() },
      });
    }

    this.activeJobs.delete(generationId);
  }

  private async updateJobStatus(
    generationId: string,
    status: ReportStatus,
    stage?: ReportStage,
    progress?: number
  ) {
    await prisma.systemReportGeneration.update({
      where: { id: generationId },
      data: {
        status,
        stage,
        progress,
        startedAt: progress === 10 ? new Date() : undefined,
      },
    });
  }

  private async updateJobProgress(generationId: string, progress: number) {
    await prisma.systemReportGeneration.update({
      where: { id: generationId },
      data: { progress },
    });
  }

  private async updateSectionStatus(
    generationId: string,
    sectionKey: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    error?: string
  ) {
    const updateData: any = { status };
    if (status === 'running') updateData.startedAt = new Date();
    if (status === 'completed' || status === 'failed') updateData.completedAt = new Date();
    if (error) updateData.message = error;

    await prisma.systemReportSectionLog.updateMany({
      where: { generationId, sectionKey },
      data: updateData,
    });
  }

  private async markJobFailed(generationId: string, errorMessage: string) {
    await prisma.systemReportGeneration.update({
      where: { id: generationId },
      data: {
        status: 'failed',
        stage: null,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  private getSectionLabel(key: string): string {
    const labels: Record<string, string> = {
      release: 'Release / Deploy',
      health: 'Application Health',
      docker: 'Docker / Containers',
      systemd: 'Systemd / Host',
      database: 'Database',
      storage: 'Storage / Runtime',
      security: 'Security / Config',
      performance: 'Performance / Diagnostics',
      audit: 'Audit / Activity',
    };
    return labels[key] || key;
  }

  private assembleReport(sectionResults: Map<string, SectionData>, config: ReportConfig): string {
    switch (config.format) {
      case 'json':
        return this.assembleJSON(sectionResults, config);
      case 'md':
        return this.assembleMarkdown(sectionResults, config);
      case 'zip':
        return this.assembleMarkdown(sectionResults, config);
      default:
        return this.assembleText(sectionResults, config);
    }
  }

  private assembleText(sectionResults: Map<string, SectionData>, config: ReportConfig): string {
    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('SYSTEM REPORT');
    lines.push('═'.repeat(60));
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Format: TEXT`);
    lines.push('');

    for (const [key, data] of sectionResults) {
      lines.push('─'.repeat(60));
      lines.push(key.toUpperCase());
      lines.push('─'.repeat(60));
      lines.push(data.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  private assembleMarkdown(sectionResults: Map<string, SectionData>, config: ReportConfig): string {
    const lines: string[] = [];
    lines.push('# System Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Format:** Markdown`);
    lines.push('');

    for (const [key, data] of sectionResults) {
      lines.push(`## ${this.getSectionLabel(key)}`);
      lines.push('');
      lines.push('```');
      lines.push(data.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  private assembleJSON(sectionResults: Map<string, SectionData>, config: ReportConfig): string {
    const report: Record<string, unknown> = {
      generated: new Date().toISOString(),
      format: 'json',
      sections: {},
    };

    for (const [key, data] of sectionResults) {
      (report.sections as Record<string, unknown>)[key] = {
        content: data.content,
        warnings: data.warnings || [],
      };
    }

    return JSON.stringify(report, null, 2);
  }

  private async writeArtifacts(
    generationId: string,
    content: string,
    config: ReportConfig,
    sectionResults: Map<string, SectionData>
  ): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    const RUNTIME_DIR = '/opt/rdevents/runtime/reports';

    const reportFileName = `report-${generationId}.${config.format}`;
    const reportPath = `${RUNTIME_DIR}/${generationId}/${reportFileName}`;

    const fs = await import('fs');
    fs.mkdirSync(`${RUNTIME_DIR}/${generationId}`, { recursive: true });
    fs.writeFileSync(reportPath, content);

    const artifact = await prisma.systemReportAttachment.create({
      data: {
        generationId,
        fileName: reportFileName,
        fileSize: content.length,
        contentType: this.getContentType(config.format),
        filePath: reportPath,
      },
    });

    artifacts.push({
      id: artifact.id,
      fileName: artifact.fileName,
      fileSize: artifact.fileSize,
      contentType: artifact.contentType,
      filePath: artifact.filePath,
    });

    for (const [sectionKey, data] of sectionResults) {
      if (data.attachments) {
        for (const attachment of data.attachments) {
          const attachmentPath = `${RUNTIME_DIR}/${generationId}/${attachment.fileName}`;
          const buffer = attachment.content instanceof Buffer
            ? attachment.content
            : Buffer.from(attachment.content);

          fs.writeFileSync(attachmentPath, buffer);

          const dbAttachment = await prisma.systemReportAttachment.create({
            data: {
              generationId,
              fileName: attachment.fileName,
              fileSize: buffer.length,
              contentType: attachment.contentType,
              filePath: attachmentPath,
              sectionKey,
            },
          });

          artifacts.push({
            id: dbAttachment.id,
            fileName: dbAttachment.fileName,
            fileSize: dbAttachment.fileSize,
            contentType: dbAttachment.contentType,
            filePath: dbAttachment.filePath,
            sectionKey,
          });
        }
      }
    }

    return artifacts;
  }

  private getContentType(format: ReportFormat): string {
    switch (format) {
      case 'json': return 'application/json';
      case 'md': return 'text/markdown';
      case 'zip': return 'application/zip';
      default: return 'text/plain';
    }
  }

  async getGenerationSummary(generationId: string): Promise<GenerationSummary | null> {
    const generation = await prisma.systemReportGeneration.findUnique({
      where: { id: generationId },
      include: {
        template: {
          select: { id: true, name: true },
        },
        sections: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
      },
    });

    if (!generation) return null;

    return {
      id: generation.id,
      requestId: generation.requestId,
      templateId: generation.templateId || undefined,
      templateName: generation.template?.name,
      status: generation.status as ReportStatus,
      stage: generation.stage as ReportStage | undefined,
      progress: generation.progress,
      format: generation.format as ReportFormat,
      initiatedByEmail: generation.initiatedByEmail || undefined,
      createdAt: generation.createdAt.toISOString(),
      startedAt: generation.startedAt?.toISOString(),
      completedAt: generation.completedAt?.toISOString(),
      errorMessage: generation.errorMessage || undefined,
      artifactCount: generation.attachments.length,
      sectionsSummary: generation.sections.map(s => ({
        key: s.sectionKey,
        label: s.sectionLabel,
        status: s.status,
      })),
    };
  }

  async getCurrentStatus(): Promise<{
    latestGeneration?: GenerationSummary;
    activeGenerations: GenerationSummary[];
  }> {
    const activeGenerations = await prisma.systemReportGeneration.findMany({
      where: {
        status: { in: ['queued', 'running'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        template: { select: { id: true, name: true } },
        sections: { orderBy: { createdAt: 'asc' } },
        attachments: true,
      },
    });

    const latestGeneration = await prisma.systemReportGeneration.findFirst({
      where: {
        status: { in: ['success', 'failed', 'partial_success'] },
      },
      orderBy: { completedAt: 'desc' },
      include: {
        template: { select: { id: true, name: true } },
        sections: { orderBy: { createdAt: 'asc' } },
        attachments: true,
      },
    });

    return {
      latestGeneration: latestGeneration ? {
        id: latestGeneration.id,
        requestId: latestGeneration.requestId,
        templateId: latestGeneration.templateId || undefined,
        templateName: latestGeneration.template?.name,
        status: latestGeneration.status as ReportStatus,
        stage: latestGeneration.stage as ReportStage | undefined,
        progress: latestGeneration.progress,
        format: latestGeneration.format as ReportFormat,
        initiatedByEmail: latestGeneration.initiatedByEmail || undefined,
        createdAt: latestGeneration.createdAt.toISOString(),
        startedAt: latestGeneration.startedAt?.toISOString(),
        completedAt: latestGeneration.completedAt?.toISOString(),
        errorMessage: latestGeneration.errorMessage || undefined,
        artifactCount: latestGeneration.attachments.length,
        sectionsSummary: latestGeneration.sections.map(s => ({
          key: s.sectionKey,
          label: s.sectionLabel,
          status: s.status,
        })),
      } : undefined,
      activeGenerations: activeGenerations.map(g => ({
        id: g.id,
        requestId: g.requestId,
        templateId: g.templateId || undefined,
        templateName: g.template?.name,
        status: g.status as ReportStatus,
        stage: g.stage as ReportStage | undefined,
        progress: g.progress,
        format: g.format as ReportFormat,
        initiatedByEmail: g.initiatedByEmail || undefined,
        createdAt: g.createdAt.toISOString(),
        startedAt: g.startedAt?.toISOString(),
        completedAt: g.completedAt?.toISOString(),
        errorMessage: g.errorMessage || undefined,
        artifactCount: g.attachments.length,
        sectionsSummary: g.sections.map(s => ({
          key: s.sectionKey,
          label: s.sectionLabel,
          status: s.status,
        })),
      })),
    };
  }
}

export const reportOrchestrator = new ReportOrchestrator();

export { allProviders } from './section-providers.js';
