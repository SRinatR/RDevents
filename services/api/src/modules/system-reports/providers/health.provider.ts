import { readFileSync, existsSync } from 'fs';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider';

export class HealthProvider extends BaseReportProvider {
  readonly key = 'health';
  readonly label = 'Application Health';
  readonly description = 'Health checks and runtime status';
  readonly category = 'application' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    try {
      const lines: string[] = [];
      lines.push('## Application Health');
      lines.push('');

      const releaseInfo = existsSync('/app/apps/web/public/release.json')
        ? JSON.parse(readFileSync('/app/apps/web/public/release.json', 'utf-8')
        : null;

      if (releaseInfo) {
        lines.push('**Version:**', releaseInfo.version || 'unknown');
        lines.push('**Build Time:**', releaseInfo.buildTime || 'unknown');
        lines.push('**Environment:**', process.env.NODE_ENV || 'unknown');
        lines.push('');
      }

      lines.push('**Runtime Info:**');
      lines.push(`- Node Version: ${process.version}`);
      lines.push(`- Platform: ${process.platform}`);
      lines.push(`- Uptime: ${Math.floor(process.uptime())}s`);
      lines.push(`- Memory RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

      return {
        success: true,
        data: {
          content: lines.join('\n'),
          metadata: {
            version: releaseInfo?.version,
            uptime: process.uptime(),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
