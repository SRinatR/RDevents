export interface BaseSectionData {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SectionAttachment {
  name: string;
  data: Buffer | string;
  mimeType: string;
}

export interface SectionResult {
  success: boolean;
  data?: BaseSectionData;
  error?: string;
  warnings?: string[];
}

export interface ProviderContext {
  runId: string;
  templateId?: string;
  options: Record<string, unknown>;
  redactionLevel: 'strict' | 'standard' | 'off';
}

export abstract class BaseReportProvider {
  abstract readonly key: string;
  abstract readonly label: string;
  abstract readonly description: string;
  abstract readonly category: 'system' | 'application' | 'infrastructure' | 'security';

  abstract collect(context: ProviderContext): Promise<SectionResult>;

  protected redact(text: string, level: 'strict' | 'standard' | 'off'): string {
    if (level === 'off') return text;

    let result = text;
    result = result.replace(/(api[_-]?key|apikey|token)[=:]\s*[^\s&]+/gi, '$&=[REDACTED]');
    result = result.replace(/(password|secret)[=:]\s*[^\s&]+/gi, '$1=[REDACTED]');
    result = result.replace(/(postgres|mysql|mongodb|redis)[=:][^\s&]+/gi, '$&=[REDACTED]');
    
    if (level === 'strict') {
      result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
      result = result.replace(/\+?\d{10,}/g, '[PHONE_REDACTED]');
    }

    return result;
  }
}
