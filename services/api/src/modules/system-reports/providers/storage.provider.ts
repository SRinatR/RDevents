import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

const RUNTIME_DIR = '/opt/rdevents/runtime';

export class StorageProvider extends BaseReportProvider {
  readonly key = 'storage';
  readonly label = 'Storage / Runtime';
  readonly description = 'Disk usage and runtime directories';
  readonly category = 'infrastructure' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    const lines: string[] = [];
    lines.push('## Storage / Runtime');
    lines.push('');

    try {
      const df = execSync('df -h 2>/dev/null || echo ""', { encoding: 'utf-8' });
      lines.push('**Disk Usage:**');
      lines.push('```');
      lines.push(df.split('\n').slice(0, 10).join('\n'));
      lines.push('```');

      const threshold = (context.options?.threshold as number) || 100;

      if (existsSync(RUNTIME_DIR)) {
        lines.push('');
        lines.push(`**Runtime Directory:** ${RUNTIME_DIR}`);
        
        try {
          const du = execSync(`du -sh ${RUNTIME_DIR}/* 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
          lines.push('');
          lines.push('**Subdirectories:**');
          lines.push('```');
          lines.push(du.split('\n').slice(0, 20).join('\n'));
          lines.push('```');
        } catch {
          lines.push('Detailed runtime stats unavailable');
        }
      }

      return {
        success: true,
        data: { content: lines.join('\n') },
      };
    } catch (error) {
      return {
        success: false,
        error: `Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
