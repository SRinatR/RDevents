import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider';

export class DatabaseProvider extends BaseReportProvider {
  readonly key = 'database';
  readonly label: 'Database' = 'Database';
  readonly description: 'Database connectivity and status' = 'Database connectivity and status';
  readonly category: 'application' = 'application';

  async collect(context: ProviderContext): Promise<SectionResult> {
    const lines: string[] = [];
    lines.push('## Database');

    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.$connect();
      lines.push('**Status:** Connected');
      
      const detailLevel = context.options?.detailLevel as string || 'summary';
      
      if (detailLevel === 'detailed') {
        lines.push('');
        lines.push('**Tables:** Check migration status for details');
      }

      await prisma.$disconnect();
      
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
