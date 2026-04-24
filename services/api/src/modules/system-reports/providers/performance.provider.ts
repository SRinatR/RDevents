import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

const RUNTIME_DIR = '/opt/rdevents/runtime';

export class PerformanceProvider extends BaseReportProvider {
  readonly key = 'performance';
  readonly label = 'Performance / Diagnostics';
  readonly description = 'Response times, error counters, queue indicators';
  readonly category = 'application' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    const lines: string[] = [];
    lines.push('## Performance / Diagnostics');
    lines.push('');

    const timeWindow = (context.options?.timeWindow as string) || '1h';
    const warnings: string[] = [];

    try {
      lines.push(`**Time Window:** ${timeWindow}`);
      lines.push('');

      if (existsSync(`${RUNTIME_DIR}/metrics`)) {
        try {
          const uptime = execSync('cat /proc/uptime 2>/dev/null | awk \'{print $1}\'', {
            encoding: 'utf-8',
            timeout: 2000,
          }).trim();
          
          if (uptime) {
            const uptimeSeconds = parseFloat(uptime);
            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            
            lines.push('**System Uptime:**');
            lines.push(`- ${days}d ${hours}h ${minutes}m`);
            lines.push('');
          }
        } catch {
          warnings.push('Could not read system uptime');
        }

        try {
          const loadavg = execSync('cat /proc/loadavg 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 2000,
          }).trim();
          
          if (loadavg) {
            const parts = loadavg.split(' ');
            lines.push('**System Load Average:**');
            lines.push(`- 1 min: ${parts[0]}`);
            lines.push(`- 5 min: ${parts[1]}`);
            lines.push(`- 15 min: ${parts[2]}`);
            lines.push('');
          }
        } catch {
          warnings.push('Could not read system load average');
        }

        try {
          const meminfo = execSync('cat /proc/meminfo 2>/dev/null | head -5', {
            encoding: 'utf-8',
            timeout: 2000,
          });
          
          lines.push('**Memory Usage:**');
          const memLines = meminfo.split('\n').slice(0, 5);
          for (const line of memLines) {
            if (line.trim()) {
              lines.push(`- ${line.trim()}`);
            }
          }
          lines.push('');
        } catch {
          warnings.push('Could not read memory info');
        }
      }

      if (existsSync(`${RUNTIME_DIR}/metrics/response-times.json`)) {
        try {
          const responseTimes = JSON.parse(
            readFileSync(`${RUNTIME_DIR}/metrics/response-times.json`, 'utf-8')
          );
          
          lines.push('**Response Times (sample):**');
          if (responseTimes.recent && Array.isArray(responseTimes.recent)) {
            const recent = responseTimes.recent.slice(-10);
            for (const rt of recent) {
              const timestamp = new Date(rt.timestamp).toISOString();
              const duration = rt.duration ? `${rt.duration}ms` : 'N/A';
              const status = rt.status || 'unknown';
              lines.push(`- [${timestamp}] ${duration} (${status})`);
            }
          }
          lines.push('');
        } catch {
          warnings.push('Could not read response times');
        }
      }

      if (existsSync(`${RUNTIME_DIR}/metrics/errors.json`)) {
        try {
          const errors = JSON.parse(
            readFileSync(`${RUNTIME_DIR}/metrics/errors.json`, 'utf-8')
          );
          
          lines.push('**Recent Errors:**');
          if (errors.count !== undefined) {
            lines.push(`- Total errors: ${errors.count}`);
          }
          if (errors.recent && Array.isArray(errors.recent)) {
            const recent = errors.recent.slice(-5);
            for (const err of recent) {
              const timestamp = new Date(err.timestamp).toISOString();
              const message = err.message || 'Unknown error';
              lines.push(`- [${timestamp}] ${message}`);
            }
          }
          lines.push('');
        } catch {
          warnings.push('Could not read error metrics');
        }
      }

      if (existsSync(`${RUNTIME_DIR}/metrics/queue.json`)) {
        try {
          const queue = JSON.parse(
            readFileSync(`${RUNTIME_DIR}/metrics/queue.json`, 'utf-8')
          );
          
          lines.push('**Queue/Backlog Status:**');
          if (queue.pending !== undefined) {
            lines.push(`- Pending: ${queue.pending}`);
          }
          if (queue.processing !== undefined) {
            lines.push(`- Processing: ${queue.processing}`);
          }
          if (queue.completed !== undefined) {
            lines.push(`- Completed: ${queue.completed}`);
          }
          if (queue.failed !== undefined) {
            lines.push(`- Failed: ${queue.failed}`);
          }
          lines.push('');
        } catch {
          warnings.push('Could not read queue metrics');
        }
      }

      const diskIO = existsSync('/proc/diskstats');
      if (diskIO) {
        try {
          const iostat = execSync('cat /proc/diskstats | head -3 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 2000,
          });
          
          if (iostat.trim()) {
            lines.push('**Disk I/O (sample):**');
            lines.push('```');
            lines.push(iostat.trim());
            lines.push('```');
            lines.push('');
          }
        } catch {
          warnings.push('Could not read disk I/O stats');
        }
      }

      return {
        success: true,
        data: {
          content: lines.join('\n'),
          metadata: {
            timeWindow,
            hasMetrics: existsSync(`${RUNTIME_DIR}/metrics`),
          },
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
