import { BaseReportProvider, ProviderContext, SectionResult } from './base.provider.js';

export class SecurityProvider extends BaseReportProvider {
  readonly key = 'security';
  readonly label = 'Security / Config' as const;
  readonly description = 'Environment validation and security status' as const;
  readonly category = 'security' as const;

  async collect(context: ProviderContext): Promise<SectionResult> {
    const lines: string[] = [];
    lines.push('## Security Configuration');
    lines.push('');

    const required = [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ];

    const optional = [
      'RESEND_API_KEY',
      'SMTP_HOST',
      'SMTP_USER',
      'CORS_ORIGIN',
      'APP_URL',
    ];

    lines.push('**Environment Variables:**');

    for (const key of required) {
      const value = process.env[key];
      const status = value ? '✅ Present' : '❌ Missing';
      lines.push(`- ${key}: ${status}`);
    }

    for (const key of optional) {
      const value = process.env[key];
      lines.push(`- ${key}: ${value ? '✅ Present' : '⚪ Not set'}`);
    }

    const level = context.redactionLevel;
    lines.push('');
    lines.push(`**Redaction Level:** ${level}`);
    
    if (level === 'strict') {
      lines.push('All sensitive values are redacted');
    }

    return {
      success: true,
      data: { content: lines.join('\n') },
    };
  }
}
