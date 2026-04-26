import { prisma } from '../../../db/prisma.js';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

export class AuditProvider extends BaseReportProvider {
  readonly key = 'audit';
  readonly label = 'Audit / Activity' as const;
  readonly description = 'Recent admin actions, report runs, changes' as const;
  readonly category = 'system' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    const lines: string[] = [];
    lines.push('## Audit / Activity');
    lines.push('');

    const limit = (context.options?.limit as number) || 50;
    const warnings: string[] = [];

    try {
      const recentReportRuns = await prisma.systemReportRun.findMany({
        take: Math.min(limit, 20),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          requestedByEmail: true,
          createdAt: true,
          finishedAt: true,
        },
      });

      lines.push('**Recent Report Runs:**');
      if (recentReportRuns.length === 0) {
        lines.push('- No report runs found');
      } else {
        for (const run of recentReportRuns) {
          const date = new Date(run.createdAt).toISOString();
          const status = run.status;
          const email = this.redact(run.requestedByEmail, context.redactionLevel);
          const title = run.title || 'Untitled report';
          lines.push(`- [${date}] ${status}: ${title} (by ${email})`);
        }
      }
      lines.push('');

      const recentReportEvents = await prisma.systemReportEvent.findMany({
        where: {
          level: 'error',
        },
        take: Math.min(limit, 10),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          level: true,
          code: true,
          message: true,
          createdAt: true,
        },
      });

      lines.push('**Recent Error Events:**');
      if (recentReportEvents.length === 0) {
        lines.push('- No error events found');
      } else {
        for (const event of recentReportEvents) {
          const date = new Date(event.createdAt).toISOString();
          const code = event.code;
          const message = event.message.substring(0, 100);
          lines.push(`- [${date}] ${code}: ${message}...`);
        }
      }
      lines.push('');

      const recentTemplateChanges = await prisma.systemReportTemplate.findMany({
        take: Math.min(limit, 10),
        orderBy: { updatedAt: 'desc' },
        where: {
          updatedAt: {
            not: undefined,
          },
        },
        select: {
          id: true,
          name: true,
          isDefault: true,
          updatedAt: true,
          createdBy: {
            select: {
              email: true,
            },
          },
        },
      });

      lines.push('**Recent Template Changes:**');
      if (recentTemplateChanges.length === 0) {
        lines.push('- No template changes found');
      } else {
        for (const template of recentTemplateChanges) {
          const date = new Date(template.updatedAt).toISOString();
          const name = template.name;
          const email = this.redact(template.createdBy?.email || 'unknown', context.redactionLevel);
          const isDefault = template.isDefault ? ' [DEFAULT]' : '';
          lines.push(`- [${date}] ${name}${isDefault} (by ${email})`);
        }
      }
      lines.push('');

      return {
        success: true,
        data: {
          content: lines.join('\n'),
          metadata: {
            recentReportRuns: recentReportRuns.length,
            recentErrorEvents: recentReportEvents.length,
            recentTemplateChanges: recentTemplateChanges.length,
          },
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `Audit check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
