import { BaseProvider, Context, SectionResult } from './base.provider';

export class DatabaseProvider extends BaseProvider {
  readonly key = 'database';
  readonly label = 'Database';
  readonly description = 'Database connectivity and status';
  readonly category = 'application' as const;

  async collect(context: Context): Promise<SectionResult> {
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
        error: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
