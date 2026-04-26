import { z } from 'zod';

// ─── Query schemas ─────────────────────────────────────────────────────────────

export const emailMessagesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'complained']).optional(),
  source: z.enum(['ALL', 'verification', 'invitation', 'notification', 'broadcast', 'password_reset', 'system']).optional(),
  timeRange: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const emailTemplatesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'active', 'draft', 'archived']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const emailBroadcastsQuerySchema = z.object({
  status: z.enum(['ALL', 'draft', 'scheduled', 'sending', 'sent', 'partial', 'failed']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const emailAutomationsQuerySchema = z.object({
  status: z.enum(['ALL', 'active', 'paused', 'draft']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const emailDomainsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const emailWebhooksQuerySchema = z.object({
  status: z.enum(['ALL', 'processed', 'processing', 'failed', 'pending']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const createEmailTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/).optional(),
  subject: z.string().trim().min(2).max(200),
  preheader: z.string().trim().max(220).optional().nullable(),
  htmlBody: z.string().trim().min(1).max(200_000),
  textBody: z.string().trim().min(1).max(100_000),
  status: z.enum(['active', 'draft', 'archived']).optional().default('draft'),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

export const createEmailBroadcastSchema = z.object({
  title: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(200),
  preheader: z.string().trim().max(220).optional().nullable(),
  htmlBody: z.string().trim().min(1).max(200_000),
  textBody: z.string().trim().min(1).max(100_000),
  audienceKind: z.enum(['mailing_consent', 'verified_users', 'active_users', 'platform_admins']).optional().default('mailing_consent'),
  templateId: z.string().trim().min(1).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  sendNow: z.boolean().optional().default(false),
});

// ─── Response types ────────────────────────────────────────────────────────────

export type EmailMessagesQuery = z.infer<typeof emailMessagesQuerySchema>;
export type EmailTemplatesQuery = z.infer<typeof emailTemplatesQuerySchema>;
export type EmailBroadcastsQuery = z.infer<typeof emailBroadcastsQuerySchema>;
export type EmailAutomationsQuery = z.infer<typeof emailAutomationsQuerySchema>;
export type EmailDomainsQuery = z.infer<typeof emailDomainsQuerySchema>;
export type EmailWebhooksQuery = z.infer<typeof emailWebhooksQuerySchema>;
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
export type CreateEmailBroadcastInput = z.infer<typeof createEmailBroadcastSchema>;

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'complained';
  source: 'verification' | 'invitation' | 'notification' | 'broadcast' | 'password_reset' | 'system';
  sentAt: string;
  createdAt: string;
  errorText: string | null;
  providerMessageId: string | null;
}

export interface EmailTemplate {
  id: string;
  name: string;
  key: string;
  subject: string;
  preheader: string | null;
  htmlBody?: string;
  textBody?: string;
  status: 'active' | 'draft' | 'archived';
  updatedAt: string;
}

export interface EmailBroadcast {
  id: string;
  title: string;
  audience: string;
  audienceKind: 'mailing_consent' | 'verified_users' | 'active_users' | 'platform_admins';
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed';
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  errorText: string | null;
}

export interface EmailAutomation {
  id: string;
  name: string;
  trigger: string;
  status: 'active' | 'paused' | 'draft';
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface EmailDomain {
  id: string;
  domain: string;
  provider: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  isDefault: boolean;
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  providerEventId: string | null;
  receivedAt: string;
  processingStatus: 'processed' | 'processing' | 'failed' | 'pending';
  relatedEntity: string | null;
  errorMessage: string | null;
}

export interface EmailWebhooksData {
  endpoint: string | null;
  signatureStatus: 'valid' | 'invalid' | 'unknown';
  subscribedEvents: string[];
  totalReceived: number;
  totalSuccess: number;
  totalFailed: number;
  logs: WebhookEvent[];
}

export interface EmailAudienceData {
  totalContacts: number;
  verifiedContacts: number;
  unsubscribed: number;
  segmentsCount: number;
  segments: Array<{
    id: string;
    name: string;
    size: number;
    source: string;
    updatedAt: string;
  }>;
}

export interface EmailOverview {
  provider: string | null;
  providerStatus: 'connected' | 'disconnected' | 'unknown' | 'not_configured';
  sendingDomain: string | null;
  sendingDomainStatus: 'verified' | 'pending' | 'failed' | 'unknown' | 'not_configured';
  webhookStatus: 'active' | 'inactive' | 'unknown' | 'not_configured';
  webhookEndpoint: string | null;
  sent24h: number;
  delivered24h: number;
  failed24h: number;
  templatesCount: number;
  automationsCount: number;
  recentActivity: Array<{
    type: string;
    status: string;
    timestamp: string;
  }>;
}
