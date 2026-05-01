import { z } from 'zod';

// ─── Query schemas ─────────────────────────────────────────────────────────────

function lowerEnum<T extends readonly [string, ...string[]]>(values: T, fallback?: T[number]) {
  return z.preprocess((value) => {
    if ((value === undefined || value === null || value === '') && fallback) return fallback;
    return String(value).toLowerCase();
  }, z.enum(values));
}

const jsonObjectSchema = z.record(z.string(), z.unknown()).optional().nullable();

export const emailMessagesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'complained']).optional(),
  source: z.enum(['ALL', 'verification', 'invitation', 'notification', 'broadcast', 'admin_test', 'admin_direct', 'password_reset', 'system']).optional(),
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
  status: lowerEnum(['all', 'draft', 'scheduled', 'queued', 'sending', 'sent', 'partial', 'failed', 'cancelled'], 'all').optional(),
  type: lowerEnum(['all', 'marketing', 'event_announcement', 'event_reminder', 'system_notification', 'admin_test', 'transactional'], 'all').optional(),
  audienceKind: lowerEnum(['all', 'mailing_consent', 'verified_users', 'active_users', 'platform_admins'], 'all').optional(),
  search: z.string().trim().optional(),
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
  type: lowerEnum(['marketing', 'event_announcement', 'event_reminder', 'system_notification', 'admin_test', 'transactional'], 'marketing').optional(),
  subject: z.string().trim().max(200).optional().default(''),
  preheader: z.string().trim().max(220).optional().nullable(),
  htmlBody: z.string().trim().max(200_000).optional().default(''),
  textBody: z.string().trim().max(100_000).optional().default(''),
  audienceKind: z.enum(['mailing_consent', 'verified_users', 'active_users', 'platform_admins']).optional().default('mailing_consent'),
  audienceSource: lowerEnum(['static_filter', 'saved_segment', 'event_participants', 'event_teams', 'team', 'uploaded_csv', 'manual_selection', 'manual_email', 'system'], 'static_filter').optional(),
  audienceFilterJson: jsonObjectSchema,
  savedAudienceId: z.string().trim().min(1).optional().nullable(),
  templateId: z.string().trim().min(1).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).max(80).optional().default('Asia/Tashkent'),
  internalNotes: z.string().trim().max(20_000).optional().nullable(),
  sendMode: lowerEnum(['draft', 'send_now', 'scheduled'], 'draft').optional(),
  sendNow: z.boolean().optional().default(false),
});

export const updateEmailBroadcastSchema = createEmailBroadcastSchema.partial();

export const audienceEstimateSchema = z.object({
  broadcastType: lowerEnum(['marketing', 'event_announcement', 'event_reminder', 'system_notification', 'admin_test', 'transactional'], 'marketing').optional(),
  type: lowerEnum(['marketing', 'event_announcement', 'event_reminder', 'system_notification', 'admin_test', 'transactional'], 'marketing').optional(),
  audienceKind: z.enum(['mailing_consent', 'verified_users', 'active_users', 'platform_admins']).optional().default('mailing_consent'),
  audienceSource: lowerEnum(['static_filter', 'saved_segment', 'event_participants', 'event_teams', 'team', 'uploaded_csv', 'manual_selection', 'manual_email', 'system'], 'static_filter').optional(),
  audienceFilterJson: jsonObjectSchema,
  savedAudienceId: z.string().trim().min(1).optional().nullable(),
});

export const audiencePreviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const sendBroadcastSchema = z.object({
  mode: z.enum(['ALL_ELIGIBLE', 'FAILED_ONLY']).optional().default('ALL_ELIGIBLE'),
});

export const scheduleBroadcastSchema = z.object({
  scheduledAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80).optional().default('Asia/Tashkent'),
});

export const emailRecipientsQuerySchema = z.object({
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const emailPreviewSchema = z.object({
  subject: z.string().max(200).optional().default(''),
  preheader: z.string().max(220).optional().nullable(),
  textBody: z.string().max(100_000).optional().default(''),
  htmlBody: z.string().max(200_000).optional().default(''),
  sampleVariables: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional().default({}),
});

export const emailTestSendSchema = z.object({
  toEmail: z.string().trim().email().optional(),
  email: z.string().trim().email().optional(),
  recipientId: z.string().trim().optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  preheader: z.string().trim().max(220).optional().nullable(),
  textBody: z.string().trim().min(1).max(100_000).optional(),
  htmlBody: z.string().trim().max(200_000).optional(),
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
export type UpdateEmailBroadcastInput = z.infer<typeof updateEmailBroadcastSchema>;
export type AudienceEstimateInput = z.infer<typeof audienceEstimateSchema>;
export type AudiencePreviewQuery = z.infer<typeof audiencePreviewQuerySchema>;
export type SendBroadcastInput = z.infer<typeof sendBroadcastSchema>;
export type ScheduleBroadcastInput = z.infer<typeof scheduleBroadcastSchema>;
export type EmailRecipientsQuery = z.infer<typeof emailRecipientsQuerySchema>;
export type EmailPreviewInput = z.infer<typeof emailPreviewSchema>;
export type EmailTestSendInput = z.infer<typeof emailTestSendSchema>;

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'complained';
  source: 'verification' | 'invitation' | 'notification' | 'broadcast' | 'admin_test' | 'admin_direct' | 'password_reset' | 'system';
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
  type: 'marketing' | 'event_announcement' | 'event_reminder' | 'system_notification' | 'admin_test' | 'transactional';
  audience: string;
  audienceKind: 'mailing_consent' | 'verified_users' | 'active_users' | 'platform_admins';
  audienceSource: string;
  audienceFilterJson?: unknown;
  subject: string;
  preheader: string | null;
  status: 'draft' | 'scheduled' | 'queued' | 'sending' | 'sent' | 'partial' | 'failed' | 'cancelled';
  sendMode: 'draft' | 'send_now' | 'scheduled';
  scheduledAt: string | null;
  timezone: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  totalMatched: number;
  totalEligible: number;
  totalSkipped: number;
  totalRecipients: number;
  queuedCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  bouncedCount: number;
  complainedCount: number;
  unsubscribedCount: number;
  errorText: string | null;
  createdAt?: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
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
