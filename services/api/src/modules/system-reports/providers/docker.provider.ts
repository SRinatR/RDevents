import { execSync } from 'child_process';
import { BaseReportProvider, Context, SectionResult } from './base.provider';

export class DockerProvider extends BaseProvider {
  readonly key = 'docker';
  readonly label = 'Docker Containers';
  readonly description = 'Container status and logs';
  readonly category = 'infrastructure' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    try {
      const lines: string[] = [];
      const warnings: string[] = [];

      lines.push('## Docker Containers');

      let containers: any[] = [];
      
      try {
        const psOutput = execSync('docker compose ps --format json 2>/dev/null || echo "[]', {
          encoding: 'utf-8',
          timeout: 10000,
        });
        containers = JSON.parse(psOutput || '[]');
      } catch {
        lines.push('Docker not available or no containers running');
      }

      if (containers.length > 0) {
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
          try {
            const logs = execSync(
              `docker logs ${name} --tail ${logLines} 2>&1 || echo "Logs unavailable"`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            lines.push('');
            lines.push(`### ${name} logs`);
            lines.push('```');
            lines.push(this.redact(logs, context.redactionLevel).substring(0, 2000));
            lines.push('```');
          } catch {
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
        error: `Docker check failed: ${error instanceof Error ? error.message : 'Unknown error`,
      };
    }
  }
}
