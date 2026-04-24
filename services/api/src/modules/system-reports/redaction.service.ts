export type RedactionLevel = 'strict' | 'standard' | 'off';

const SENSITIVE_PATTERNS: Record<string, RegExp[]> = {
  tokens: [
    /(api[_-]?key|apikey|api[_-]?secret|auth[_-]?token|access[_-]?token|refresh[_-]?token|bearer|jwt)[=:]\s*["']?([a-zA-Z0-9_\-\.]{8,})["']?/gi,
  ],
  passwords: [
    /(password|passwd|pwd|secret)[=:]\s*["']?([^\s&"']{4,})["']?/gi,
  ],
  connectionStrings: [
    /(postgres|mysql|mongodb|redis|amqp):\/\/[^@]+@/gi,
    /(database[_-]?url|db[_-]?url|connection[_-]?string)[=:]\s*["']?[^\s"']+["']?/gi,
  ],
  cookies: [
    /(cookie|session)[=:]\s*["']?([a-zA-Z0-9_\-]{16,})["']?/gi,
  ],
  authorization: [
    /(authorization|auth[_-]?header)[=:]\s*["']?([^"'\s]+)["']?/gi,
  ],
  vault: [/#\s*vault:[^|\n]+/g],
  emails: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
  phones: [/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g],
  ips: [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g],
};

function createRedactor(level: RedactionLevel): (text: string) => string {
  return function redact(text: string): string {
    if (level === 'off') return text;

    let result = text;

    SENSITIVE_PATTERNS.tokens.forEach(pattern => {
      result = result.replace(pattern, '$1=[REDACTED]');
    });

    SENSITIVE_PATTERNS.passwords.forEach(pattern => {
      result = result.replace(pattern, '$1=[REDACTED]');
    });

    SENSITIVE_PATTERNS.connectionStrings.forEach(pattern => {
      result = result.replace(pattern, '[REDACTED_USER@HOST]');
    });

    if (level === 'strict') {
      SENSITIVE_PATTERNS.cookies.forEach(pattern => {
        result = result.replace(pattern, '$1=[REDACTED]');
      });
      SENSITIVE_PATTERNS.authorization.forEach(pattern => {
        result = result.replace(pattern, '$1=[REDACTED]');
      });
      SENSITIVE_PATTERNS.vault.forEach(pattern => {
        result = result.replace(pattern, '$1[REDACTED]');
      });
      SENSITIVE_PATTERNS.emails.forEach(pattern => {
        result = result.replace(pattern, '[EMAIL_REDACTED]');
      });
      SENSITIVE_PATTERNS.phones.forEach(pattern => {
        result = result.replace(pattern, '[PHONE_REDACTED]');
      });
    }

    SENSITIVE_PATTERNS.ips.forEach(pattern => {
      result = result.replace(pattern, '[IP_REDACTED]');
    });

    result = result.replace(/(POSTGRES_PASSWORD|POSTGRES_USER|DATABASE_HOST)[=:][^\s&]+/gi, '$&=[REDACTED]');
    result = result.replace(/(RESEND_API_KEY|SMTP_PASSWORD|SMTP_HOST)[=:][^\s&]+/gi, '$&=[REDACTED]');

    return result;
  };
}

export function redactSensitiveData(text: string, level: RedactionLevel): string {
  return createRedactor(level)(text);
}

export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  level: RedactionLevel
): T {
  if (level === 'off') return obj;

  const redact = createRedactor(level);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const sensitiveKeys = [
      'password', 'secret', 'token', 'apiKey', 'api_key', 'auth',
      'credential', 'private', 'jwt', 'bearer', 'authorization',
      'cookie', 'session', 'connection', 'database', 'db',
    ];

    const isSensitive = sensitiveKeys.some(s =>
      key.toLowerCase().includes(s.toLowerCase())
    );

    if (isSensitive && typeof value === 'string') {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = redact(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string' ? redact(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value as Record<string, unknown>, level);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

export function createReportHeader(level: RedactionLevel): string {
  const warning = level === 'off'
    ? '⚠️  WARNING: This report contains sensitive data. Do not share.'
    : level === 'strict'
    ? '🔒 This report has strict redaction applied. Some data may be masked.'
    : 'ℹ️ This report has standard redaction applied.';

  return `Generated: ${new Date().toISOString()}
Redaction Level: ${level}
${warning}
${'─'.repeat(60)}
`;
}
