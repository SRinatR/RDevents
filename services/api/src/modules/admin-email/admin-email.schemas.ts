import { z } from 'zod';

// ─── Query schemas ─────────────────────────────────────────────────────────────

export const emailMessagesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'delivered', 'sent', 'pending', 'failed', 'bounced']).optional(),
  source: z.enum(['ALL', 'verification', 'invitation', 'notification', 'broadcast']).optional(),
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
  status: z.enum(['ALL', 'draft', 'scheduled', 'sent', 'failed']).optional(),
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

// ─── Response types ────────────────────────────────────────────────────────────

export type EmailMessagesQuery = z.infer<typeof emailMessagesQuerySchema>;
export type EmailTemplatesQuery = z.infer<typeof emailTemplatesQuerySchema>;
export type EmailBroadcastsQuery = z.infer<typeof emailBroadcastsQuerySchema>;
export type EmailAutomationsQuery = z.infer<typeof emailAutomationsQuerySchema>;
export type EmailDomainsQuery = z.infer<typeof emailDomainsQuerySchema>;
export type EmailWebhooksQuery = z.infer<typeof emailWebhooksQuerySchema>;

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  status: 'delivered' | 'sent' | 'pending' | 'failed' | 'bounced';
  source: 'verification' | 'invitation' | 'notification' | 'broadcast';
  sentAt: string;
  providerMessageId: string | null;
}

export interface EmailTemplate {
  id: string;
  name: string;
  key: string;
  subject: string;
  status: 'active' | 'draft' | 'archived';
  updatedAt: string;
}

export interface EmailBroadcast {
  id: string;
  title: string;
  audience: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  scheduledAt: string | null;
  sentCount: number;
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
  providerStatus: 'connected' | 'disconnected' | 'unknown';
  sendingDomain: string | null;
  sendingDomainStatus: 'verified' | 'pending' | 'failed' | 'unknown';
  webhookStatus: 'active' | 'inactive' | 'unknown';
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