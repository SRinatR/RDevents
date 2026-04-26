import { prisma } from '../../../db/prisma.js';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

export class DatabaseProvider extends BaseReportProvider {
  readonly key = 'database';
  readonly label = 'Database' as const;
  readonly description = 'Database connectivity and status' as const;
  readonly category = 'application' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    const lines: string[] = [];
    lines.push('## Database');

    try {
      await prisma.$queryRaw`SELECT 1`;
      lines.push('**Status:** Connected');
      
      const detailLevel = context.options?.detailLevel as string || 'summary';
      
      if (detailLevel === 'detailed') {
        lines.push('');
        lines.push('**Tables:** Check migration status for details');
      }

      return {
        success: true,
        data: { content: lines.join('\n') },
      };
    } catch (error) {
      return {
        success: false,
        error: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
