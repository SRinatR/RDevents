import { Resend } from 'resend';
import { env } from '../../config/env.js';
import type { EmailProvider, SendEmailInput, SendEmailResult } from './email-provider.interface.js';

let resendClient: Resend | null = null;

function getResendClient() {
  if (!env.RESEND_API_KEY) return null;
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function formatFromAddress(name: string, email: string) {
  return `${name} <${email}>`;
}

export class ResendEmailProvider implements EmailProvider {
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const client = getResendClient();
    if (!client) throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
    if (!env.RESEND_FROM_EMAIL) throw new Error('EMAIL_SENDER_NOT_CONFIGURED');

    const payload: any = {
      from: formatFromAddress(env.RESEND_FROM_NAME, env.RESEND_FROM_EMAIL),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      headers: {
        'X-RDEvents-Idempotency-Key': input.idempotencyKey,
      },
      tags: [
        { name: 'source', value: input.metadata?.['source'] ?? 'broadcast' },
        { name: 'broadcastId', value: input.metadata?.['broadcastId'] ?? 'unknown' },
      ],
      ...(env.RESEND_REPLY_TO_EMAIL ? { replyTo: env.RESEND_REPLY_TO_EMAIL } : {}),
    };

    if (input.html) payload.html = input.html;

    const response = await client.emails.send(payload);
    if (response.error) {
      throw new Error(response.error.message ?? 'EMAIL_DELIVERY_FAILED');
    }

    return {
      provider: 'resend',
      providerMessageId: response.data?.id ?? null,
      status: 'sent',
      raw: response,
    };
  }
}

export class LogOnlyEmailProvider implements EmailProvider {
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    return {
      provider: 'log-only',
      providerMessageId: `log_${Buffer.from(input.idempotencyKey).toString('base64url').slice(0, 32)}`,
      status: 'sent',
      raw: {
        to: input.to,
        subject: input.subject,
        metadata: input.metadata,
      },
    };
  }
}

export function getEmailProvider(): EmailProvider {
  if (process.env['EMAIL_PROVIDER'] === 'log-only') {
    return new LogOnlyEmailProvider();
  }
  return new ResendEmailProvider();
}
