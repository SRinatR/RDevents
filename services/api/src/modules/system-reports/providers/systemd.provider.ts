import { spawnSync } from 'child_process';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCommand(options: {
  command: string;
  args: string[];
  timeoutMs?: number;
}): CommandResult {
  const { command, args, timeoutMs = 10000 } = options;

  try {
    const result = spawnSync(command, args, {
      timeout: timeoutMs,
      encoding: 'utf-8',
      shell: false,
    });

    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.status ?? (result.error ? 1 : 0),
    };
  } catch (error: any) {
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      exitCode: error.status ?? 1,
    };
  }
}

export class SystemdProvider extends BaseReportProvider {
  readonly key = 'systemd';
  readonly label = 'Systemd Services';
  readonly description = 'Host services and systemd units';
  readonly category = 'infrastructure' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    try {
      const lines: string[] = [];
      lines.push('## Systemd Services');

      const isSystemdAvailable = runCommand({
        command: 'systemctl',
        args: ['is-system-running'],
        timeoutMs: 3000,
      });

      if (isSystemdAvailable.exitCode !== 0) {
        lines.push('');
        lines.push('Systemd not available inside container');
        return {
          success: true,
          data: { content: lines.join('\n') },
        };
      }

      const units = (context.options?.units as string[]) || ['rdevents-api', 'rdevents-web'];
      const includeFailed = !(context.options?.includeFailedOnly as boolean);

      for (const unit of units) {
        lines.push('');
        lines.push(`### ${unit}`);

        const statusResult = runCommand({
          command: 'systemctl',
          args: ['status', unit, '--no-pager'],
          timeoutMs: 5000,
        });

        if (statusResult.exitCode === 0) {
          lines.push('```');
          lines.push(this.redact(statusResult.stdout.substring(0, 1000), context.redactionLevel));
          lines.push('```');
        } else {
          lines.push('Unit status unavailable');
        }
      }

      if (includeFailed) {
        lines.push('');
        lines.push('## Failed Units');

        const failedResult = runCommand({
          command: 'systemctl',
          args: ['list-units', '--failed', '--no-legend'],
          timeoutMs: 5000,
        });

        if (failedResult.exitCode === 0 && failedResult.stdout.trim()) {
          lines.push('```');
          lines.push(this.redact(failedResult.stdout.substring(0, 500), context.redactionLevel));
          lines.push('```');
        } else {
          lines.push('No failed units');
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
