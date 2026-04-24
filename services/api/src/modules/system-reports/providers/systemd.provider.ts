import { execSync } from 'child_process';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider';

export class SystemdProvider extends BaseReportProvider {
  readonly key = 'systemd';
  readonly label = 'Systemd Services';
  readonly description = 'Host services and systemd units';
  readonly category = 'infrastructure' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    try {
      const lines: string[] = [];
      lines.push('## Systemd Services');

      const units = (context.options?.units as string[]) || ['rdevents-api', 'rdevents-web'];
      const includeFailed = !(context.options?.includeFailedOnly as boolean);

      for (const unit of units) {
        lines.push('');
        lines.push(`### ${unit}`);
        
        try {
          const status = execSync(`systemctl status ${unit} 2>&1 || echo "Unit not found"`, {
            encoding: 'utf-8',
            timeout: 5000,
          });
          
          lines.push('```');
          lines.push(this.redact(status.substring(0, 1000), context.redactionLevel));
          lines.push('```');
        } catch {
          lines.push('Unit status unavailable');
        }
      }

      if (includeFailed) {
        lines.push('');
        lines.push('## Failed Units');
        
        try {
          const failed = execSync('systemctl list-units --failed --no-legend 2>/dev/null || echo ""', {
            encoding: 'utf-8',
            timeout: 5000,
          });
          
          if (failed.trim()) {
            lines.push('```');
            lines.push(this.redact(failed.substring(0, 500), context.redactionLevel));
            lines.push('```');
          } else {
            lines.push('No failed units');
          }
        } catch {
          lines.push('Failed units check unavailable');
        }
      }

      return {
        success: true,
        data: { content: lines.join('\n') },
      };
    } catch (error) {
      return {
        success: false,
        error: `Systemd check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
