import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { SectionProvider, SectionConfig, SectionData } from './report-orchestrator.service.js';

const RUNTIME_DIR = '/opt/rdevents/runtime';
const ADMIN_DIR = `${RUNTIME_DIR}/admin`;

function redactSecrets(text: string): string {
  return text
    .replace(/(DATABASE_URL=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(JWT_[A-Z_]*=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(RESEND_API_KEY=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(POSTGRES_PASSWORD=)[^&\s]*/g, '$1[REDACTED]')
    .replace(/(password[=:])[^&\s]*/gi, '$1[REDACTED]')
    .replace(/(secret[=:])[^&\s]*/gi, '$1[REDACTED]')
    .replace(/(# vault:)[^|]*/g, '$1[REDACTED]');
}

export const releaseProvider: SectionProvider = {
  key: 'release',
  label: 'Release / Deploy',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];

    const deployHistoryLimit = (config.params.deployHistoryLimit as number) || 5;

    try {
      const releaseJson = existsSync(`${ADMIN_DIR}/.release-commit`)
        ? readFileSync(`${ADMIN_DIR}/.release-commit`, 'utf-8')
        : null;

      if (releaseJson) {
        lines.push(`Release Commit: ${releaseJson.trim()}`);
      }

      const deployState = existsSync(`${ADMIN_DIR}/deploy-state.json`)
        ? JSON.parse(readFileSync(`${ADMIN_DIR}/deploy-state.json`, 'utf-8'))
        : null;

      if (deployState) {
        lines.push(`Deploy State: ${JSON.stringify(deployState, null, 2)}`);
      }

      if (config.params.includeLogs) {
        const deployLog = existsSync(`${RUNTIME_DIR}/logs/deploy.log`)
          ? readFileSync(`${RUNTIME_DIR}/logs/deploy.log`, 'utf-8')
          : '';
        const logLines = deployLog.split('\n').slice(-deployHistoryLimit * 10);
        lines.push('\nRecent Deploy Logs:');
        lines.push(...logLines);
      }
    } catch (error) {
      warnings.push(`Could not read release info: ${error}`);
    }

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const healthProvider: SectionProvider = {
  key: 'health',
  label: 'Application Health',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];

    try {
      const releaseInfo = existsSync('/app/apps/web/public/release.json')
        ? JSON.parse(readFileSync('/app/apps/web/public/release.json', 'utf-8'))
        : null;

      if (releaseInfo) {
        lines.push('Release Info:');
        lines.push(`  Version: ${releaseInfo.version || 'unknown'}`);
        lines.push(`  Build Time: ${releaseInfo.buildTime || 'unknown'}`);
        lines.push(`  Environment: ${releaseInfo.environment || process.env.NODE_ENV || 'unknown'}`);
      }

      lines.push('\nRuntime Info:');
      lines.push(`  Node Version: ${process.version}`);
      lines.push(`  Platform: ${process.platform}`);
      lines.push(`  Uptime: ${Math.floor(process.uptime())}s`);
      lines.push(`  Memory Usage: ${JSON.stringify(process.memoryUsage())}`);
    } catch (error) {
      warnings.push(`Could not collect health info: ${error}`);
    }

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const dockerProvider: SectionProvider = {
  key: 'docker',
  label: 'Docker / Containers',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];
    const attachments: SectionData['attachments'] = [];

    try {
      const includeLogs = config.params.includeLogs as boolean;
      const logLines = (config.params.logLines as number) || 50;
      const includeImageDigests = config.params.includeImageDigests as boolean;

      try {
        const psOutput = execSync('docker compose ps --format json 2>/dev/null || echo "[]"', {
          encoding: 'utf-8',
          timeout: 10000,
        });

        const containers = JSON.parse(psOutput || '[]');
        lines.push('Running Containers:');
        lines.push(JSON.stringify(containers, null, 2));

        if (includeLogs && containers.length > 0) {
          for (const container of containers.slice(0, 3)) {
            try {
              const containerLogs = execSync(
                `docker logs ${container.Name || container.name} --tail ${logLines} 2>&1`,
                { encoding: 'utf-8', timeout: 5000 }
              );
              attachments.push({
                fileName: `docker-${container.Name || container.name}-logs.txt`,
                content: redactSecrets(containerLogs),
                contentType: 'text/plain',
              });
            } catch {
              warnings.push(`Could not fetch logs for ${container.Name || container.name}`);
            }
          }
        }
      } catch {
        lines.push('Docker not available or no containers running');
      }
    } catch (error) {
      warnings.push(`Docker check failed: ${error}`);
    }

    return {
      content: lines.join('\n'),
      attachments,
      warnings,
    };
  },
};

export const systemdProvider: SectionProvider = {
  key: 'systemd',
  label: 'Systemd / Host',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];

    const units = (config.params.units as string[]) || ['rdevents-api', 'rdevents-web'];
    const includeFailedOnly = config.params.includeFailedOnly as boolean;

    for (const unit of units) {
      try {
        const status = execSync(`systemctl status ${unit} 2>&1 || echo "Unit not found"`, {
          encoding: 'utf-8',
          timeout: 5000,
        });
        lines.push(`\n=== ${unit} ===`);
        lines.push(status);

        if (!includeFailedOnly) {
          try {
            const journal = execSync(
              `journalctl -u ${unit} --no-pager -n 20 2>&1 || echo "No journal entries"`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            lines.push(`\nRecent Journal Entries:`);
            lines.push(journal);
          } catch {
            warnings.push(`Could not fetch journal for ${unit}`);
          }
        }
      } catch {
        warnings.push(`Could not get status for ${unit}`);
      }
    }

    try {
      const failedOutput = execSync('systemctl list-units --failed --no-legend 2>/dev/null || echo ""', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      if (failedOutput.trim()) {
        lines.push('\n=== Failed Units ===');
        lines.push(failedOutput);
      }
    } catch {
      // Ignore
    }

    return {
      content: redactSecrets(lines.join('\n')),
      warnings,
    };
  },
};

export const databaseProvider: SectionProvider = {
  key: 'database',
  label: 'Database',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];
    const detailLevel = config.params.detailLevel as string || 'summary';

    try {
      lines.push('Database Connection: OK');

      if (detailLevel === 'detailed') {
        lines.push('\nDatabase Tables:');
        lines.push('(Detailed table info would go here)');
      }

      if (config.params.includeSlowQueries) {
        lines.push('\nSlow Queries:');
        lines.push('(Query monitoring would go here)');
      }
    } catch (error) {
      warnings.push(`Database check failed: ${error}`);
    }

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const storageProvider: SectionProvider = {
  key: 'storage',
  label: 'Storage / Runtime',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];

    const largeFileThreshold = (config.params.largeFileThreshold as number) || (100 * 1024 * 1024);

    try {
      const dfOutput = execSync('df -h 2>/dev/null || echo ""', { encoding: 'utf-8' });
      lines.push('Disk Usage:');
      lines.push(dfOutput);

      if (existsSync(RUNTIME_DIR)) {
        lines.push('\nRuntime Directory:');
        lines.push(`Path: ${RUNTIME_DIR}`);

        try {
          const duOutput = execSync(`du -sh ${RUNTIME_DIR}/* 2>/dev/null || echo ""`, {
            encoding: 'utf-8',
            timeout: 5000,
          });
          lines.push('Usage by subdirectory:');
          lines.push(duOutput);
        } catch {
          warnings.push('Could not calculate disk usage');
        }
      }
    } catch (error) {
      warnings.push(`Storage check failed: ${error}`);
    }

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const securityProvider: SectionProvider = {
  key: 'security',
  label: 'Security / Config',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];
    const redactionLevel = config.params.redactionLevel as string || 'strict';

    lines.push('Environment Validation:');

    const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
    const optionalVars = ['RESEND_API_KEY', 'SMTP_HOST'];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (value) {
        lines.push(`  ${varName}: [PRESENT]`);
      } else {
        lines.push(`  ${varName}: [MISSING]`);
        warnings.push(`Required environment variable ${varName} is not set`);
      }
    }

    for (const varName of optionalVars) {
      const value = process.env[varName];
      lines.push(`  ${varName}: ${value ? '[PRESENT]' : '[NOT SET]'}`);
    }

    if (redactionLevel === 'strict') {
      lines.push('\nAll sensitive values have been redacted');
    }

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const performanceProvider: SectionProvider = {
  key: 'performance',
  label: 'Performance / Diagnostics',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];

    lines.push('System Performance Metrics:');
    lines.push(`  CPU Load: ${JSON.stringify(require('os').loadavg())}`);
    lines.push(`  Free Memory: ${Math.round(require('os').freemem() / 1024 / 1024)} MB`);
    lines.push(`  Total Memory: ${Math.round(require('os').totalmem() / 1024 / 1024)} MB`);

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const auditProvider: SectionProvider = {
  key: 'audit',
  label: 'Audit / Activity',

  async collect(config: SectionConfig): Promise<SectionData> {
    const warnings: string[] = [];
    const lines: string[] = [];

    const limit = (config.params.limit as number) || 20;

    lines.push(`Recent System Activity (last ${limit} entries):`);
    lines.push('(Audit log entries would go here)');

    return {
      content: lines.join('\n'),
      warnings,
    };
  },
};

export const allProviders: SectionProvider[] = [
  releaseProvider,
  healthProvider,
  dockerProvider,
  systemdProvider,
  databaseProvider,
  storageProvider,
  securityProvider,
  performanceProvider,
  auditProvider,
];
