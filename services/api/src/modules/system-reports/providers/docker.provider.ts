import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCommand(options: {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}): CommandResult {
  const { command, args, cwd, timeoutMs = 10000 } = options;

  try {
    const result = spawnSync(command, args, {
      cwd,
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

export class DockerProvider extends BaseReportProvider {
  readonly key = 'docker';
  readonly label = 'Docker Containers';
  readonly description = 'Container status and logs';
  readonly category = 'infrastructure' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    try {
      const lines: string[] = [];
      const warnings: string[] = [];

      if (!existsSync('/var/run/docker.sock')) {
        lines.push('## Docker Containers');
        lines.push('');
        lines.push('Docker socket not available');
        return {
          success: true,
          data: { content: lines.join('\n') },
        };
      }

      lines.push('## Docker Containers');

      let containers: any[] = [];

      const psResult = runCommand({
        command: 'docker',
        args: ['compose', 'ps', '--format', 'json'],
        cwd: '/opt/rdevents/app',
        timeoutMs: 10000,
      });

      if (psResult.exitCode === 0 && psResult.stdout) {
        try {
          containers = JSON.parse(psResult.stdout || '[]');
        } catch {
          containers = [];
        }
      }

      if (containers.length === 0) {
        lines.push('Docker not available or no containers running');
      } else {
        lines.push('');
        lines.push(`**Running:** ${containers.length} containers`);
        lines.push('');

        for (const container of containers.slice(0, 5)) {
          const name = container.Name || container.name || 'unknown';
          const status = container.Status || 'unknown';
          const state = container.State || 'unknown';

          lines.push(`### ${name}`);
          lines.push(`- Status: ${status}`);
          lines.push(`- State: ${state}`);
        }
      }

      const includeLogs = context.options?.includeLogs as boolean;
      const logLines = (context.options?.logLines as number) || 50;

      if (includeLogs && containers.length > 0) {
        lines.push('');
        lines.push('## Container Logs (sample)');

        for (const container of containers.slice(0, 3)) {
          const name = container.Name || container.name;
          const logsResult = runCommand({
            command: 'docker',
            args: ['logs', name, '--tail', String(logLines)],
            timeoutMs: 5000,
          });

          if (logsResult.exitCode === 0) {
            lines.push('');
            lines.push(`### ${name} logs`);
            lines.push('```');
            lines.push(this.redact(logsResult.stdout.substring(0, 2000), context.redactionLevel));
            lines.push('```');
          } else {
            warnings.push(`Could not fetch logs for ${name}`);
          }
        }
      }

      return {
        success: true,
        data: { content: lines.join('\n') },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
