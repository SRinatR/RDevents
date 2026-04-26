export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  preheader?: string | null;
  text: string;
  html?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type SendEmailResult = {
  provider: string;
  providerMessageId?: string | null;
  status: 'sent' | 'queued';
  raw?: unknown;
};
