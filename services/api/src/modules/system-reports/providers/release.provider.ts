import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider';

const RUNTIME_DIR = '/opt/rdevents/runtime';
const ADMIN_DIR = `${RUNTIME_DIR}/admin`;

export class ReleaseProvider extends BaseReportProvider {
  readonly key = 'release';
  readonly label = 'Release / Deploy';
  readonly description = 'Release information and deployment history';
  readonly category = 'system' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    try {
      const lines: string[] = [];
      lines.push('## Release Information');
      lines.push('');

      const releaseCommit = existsSync(`${ADMIN_DIR}/.release-commit`)
        ? readFileSync(`${ADMIN_DIR}/.release-commit`, 'utf-8').trim()
        : null;

      const deployStatePath = `${ADMIN_DIR}/deploy-state.json`;
      const deployState = existsSync(deployStatePath)
        ? JSON.parse(readFileSync(deployStatePath, 'utf-8'))
        : null;

      lines.push(`**Commit:** ${releaseCommit || 'unknown'}`);
      
      if (deployState) {
        lines.push('');
        lines.push('**Deploy State:**');
        lines.push('```json');
        lines.push(JSON.stringify(deployState, null, 2));
        lines.push('```');
      }

      const historyLimit = (context.options?.historyLimit as number) || 5;
      
      const deployLog = existsSync(`${RUNTIME_DIR}/logs/deploy.log`)
        ? readFileSync(`${RUNTIME_DIR}/logs/deploy.log`, 'utf-8')
        : '';

      if (deployLog && historyLimit > 0) {
        const lines_ = deployLog.split('\n').filter(Boolean).slice(-historyLimit * 3);
        if (lines_.length > 0) {
          lines.push('');
          lines.push('**Recent Deployments:**');
          lines.push('```');
          lines.push(lines_.join('\n'));
          lines.push('```');
        }
      }

      return {
        success: true,
        data: {
          content: lines.join('\n'),
          metadata: {
            commit: releaseCommit,
            deployState,
            hasDeployLog: deployLog.length > 0,
          },
        },
        warnings: !releaseCommit ? ['No release commit file found'] : [],
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to collect release info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
