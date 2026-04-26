import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { sendPlatformEmail } from '../../common/email.js';
import type { User } from '@prisma/client';
import { canAccessEvent, getManagedEventIds } from '../access-control/access-control.service.js';
import { resolveAudience, extractAudienceEventId } from '../email-audience/audience-resolver.service.js';
import { normalizeEmail } from '@event-platform/shared';
import { renderEmailContent, hasUnsubscribeVariable, requiresUnsubscribeVariable } from '../email/email-renderer.service.js';
import { sanitizeEmailHtml } from '../email/email-sanitizer.service.js';
import { getEmailProvider } from '../email/resend.provider.js';
import type {
  AudienceEstimateInput,
  AudiencePreviewQuery,
  CreateEmailBroadcastInput,
  CreateEmailTemplateInput,
  EmailAudienceData,
  EmailAutomation,
  EmailBroadcast,
  EmailBroadcastsQuery,
  EmailDomain,
  EmailDomainsQuery,
  EmailMessage,
  EmailMessagesQuery,
  EmailPreviewInput,
  EmailRecipientsQuery,
  EmailTestSendInput,
  EmailOverview,
  EmailTemplate,
  EmailTemplatesQuery,
  EmailWebhooksData,
  EmailWebhooksQuery,
  ScheduleBroadcastInput,
  SendBroadcastInput,
  UpdateEmailBroadcastInput,
  UpdateEmailTemplateInput,
  WebhookEvent,
} from './admin-email.schemas.js';

const EMAIL_BROADCAST_MAX_RECIPIENTS = Math.max(
  1,
  Number(process.env['EMAIL_BROADCAST_MAX_RECIPIENTS'] ?? 1000) || 1000,
);

const EMAIL_BROADCAST_CONCURRENCY = Math.min(
  10,
  Math.max(1, Number(process.env['EMAIL_BROADCAST_CONCURRENCY'] ?? 3) || 3),
);

const EMAIL_BROADCAST_BATCH_SIZE = Math.max(
  1,
  Number(process.env['EMAIL_BROADCAST_BATCH_SIZE'] ?? 50) || 50,
);

const EMAIL_TEST_SEND_RATE_LIMIT_PER_HOUR = Math.max(
  1,
  Number(process.env['EMAIL_TEST_SEND_RATE_LIMIT_PER_HOUR'] ?? 20) || 20,
);

const MESSAGE_STATUS_TO_DB: Record<string, string> = {
  pending: 'PENDING',
  sent: 'SENT',
  delivered: 'DELIVERED',
  opened: 'OPENED',
  clicked: 'CLICKED',
  bounced: 'BOUNCED',
  complained: 'COMPLAINED',
  failed: 'FAILED',
};

const MESSAGE_SOURCE_TO_DB: Record<string, string> = {
  verification: 'VERIFICATION',
  invitation: 'INVITATION',
  notification: 'NOTIFICATION',
  broadcast: 'BROADCAST',
  admin_test: 'ADMIN_TEST',
  password_reset: 'PASSWORD_RESET',
  system: 'SYSTEM',
};

const TEMPLATE_STATUS_TO_DB: Record<string, string> = {
  active: 'ACTIVE',
  draft: 'DRAFT',
  archived: 'ARCHIVED',
};

const BROADCAST_STATUS_TO_DB: Record<string, string> = {
  draft: 'DRAFT',
  scheduled: 'SCHEDULED',
  queued: 'QUEUED',
  sending: 'SENDING',
  sent: 'SENT',
  partial: 'PARTIAL',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
};

const AUDIENCE_TO_DB: Record<string, string> = {
  mailing_consent: 'MAILING_CONSENT',
  verified_users: 'VERIFIED_USERS',
  active_users: 'ACTIVE_USERS',
  platform_admins: 'PLATFORM_ADMINS',
};

const AUDIENCE_SOURCE_TO_DB: Record<string, string> = {
  static_filter: 'STATIC_FILTER',
  saved_segment: 'SAVED_SEGMENT',
  event_participants: 'EVENT_PARTICIPANTS',
  event_teams: 'EVENT_TEAMS',
  uploaded_csv: 'UPLOADED_CSV',
  manual_selection: 'MANUAL_SELECTION',
  system: 'SYSTEM',
};

const WEBHOOK_STATUS_TO_DB: Record<string, string> = {
  pending: 'PENDING',
  processing: 'PROCESSING',
  processed: 'PROCESSED',
  failed: 'FAILED',
};

const SUBSCRIBED_RESEND_EVENTS = [
  'email.sent',
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.opened',
  'email.clicked',
];

type PaginationMeta = { total: number; page: number; limit: number; pages: number };
type Paginated<T> = { data: T[]; meta: PaginationMeta };
type AudienceRecipient = { id: string; email: string; name: string | null };

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    subject?: string;
  };
};

function getEmailConfig() {
  return {
    provider: env.RESEND_API_KEY ? 'resend' : null,
    sendingDomain: env.RESEND_FROM_EMAIL ? env.RESEND_FROM_EMAIL.split('@')[1] ?? null : null,
    webhookEndpoint: env.RESEND_WEBHOOK_ENDPOINT || (env.RESEND_WEBHOOK_SECRET ? 'https://api.rdevents.uz/webhooks/resend' : null),
  };
}

function paginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function parseTimeRange(timeRange?: string): Date | null {
  if (!timeRange) return null;
  const match = timeRange.match(/^(\d+)([dh])$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];
  const millis = unit === 'h' ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - millis);
}

function toApiEnum(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function toDbEnum(value: unknown, fallback: string) {
  return String(value ?? fallback).trim().toUpperCase();
}

function isPlatformAdmin(user?: User | null) {
  return Boolean(user && ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role));
}

async function ensureAudienceAccess(actor: User | undefined, input: { audienceSource?: unknown; audienceFilterJson?: unknown }) {
  if (isPlatformAdmin(actor)) return;
  if (!actor) throw new Error('FORBIDDEN');
  const eventId = extractAudienceEventId({
    audienceSource: input.audienceSource,
    audienceFilterJson: input.audienceFilterJson as any,
  });
  if (!eventId) throw new Error('EVENT_SCOPED_AUDIENCE_REQUIRED');
  if (!(await canAccessEvent(actor, eventId, 'participants.readPii'))) throw new Error('FORBIDDEN');
}

async function ensureBroadcastAccess(actor: User | undefined, broadcast: any) {
  if (isPlatformAdmin(actor)) return;
  if (!actor) throw new Error('FORBIDDEN');
  const eventId = extractAudienceEventId({
    audienceSource: broadcast.audienceSource,
    audienceFilterJson: broadcast.audienceFilterJson,
  });
  if (!eventId || !(await canAccessEvent(actor, eventId, 'participants.readPii'))) throw new Error('FORBIDDEN');
}

function validateSendableContent(broadcast: any) {
  if (!String(broadcast.subject ?? '').trim()) throw new Error('EMAIL_SUBJECT_REQUIRED');
  if (!String(broadcast.textBody ?? '').trim()) throw new Error('EMAIL_TEXT_BODY_REQUIRED');
  if (!String(broadcast.htmlBody ?? '').trim()) throw new Error('EMAIL_HTML_BODY_REQUIRED');
  if (requiresUnsubscribeVariable(String(broadcast.type ?? 'MARKETING')) && !hasUnsubscribeVariable(broadcast)) {
    throw new Error('UNSUBSCRIBE_URL_REQUIRED');
  }
}

async function addBroadcastEvent(input: { broadcastId: string; recipientId?: string | null; type: string; actorUserId?: string | null; payloadJson?: unknown }) {
  await prisma.emailBroadcastEvent.create({
    data: {
      broadcastId: input.broadcastId,
      recipientId: input.recipientId ?? null,
      type: input.type as any,
      actorUserId: input.actorUserId ?? null,
      payloadJson: input.payloadJson as any,
    },
  });
}

async function recalculateBroadcastCounters(broadcastId: string) {
  const groups = await prisma.emailBroadcastRecipient.groupBy({
    by: ['status'],
    where: { broadcastId },
    _count: true,
  });
  const count = (status: string) => groups.find(row => row.status === status)?._count ?? 0;
  const skipped = groups.filter(row => String(row.status).startsWith('SKIPPED')).reduce((sum, row) => sum + row._count, 0);
  const eligible = groups
    .filter(row => !String(row.status).startsWith('SKIPPED') && row.status !== 'CANCELLED')
    .reduce((sum, row) => sum + row._count, 0);
  const totalMatched = groups.reduce((sum, row) => sum + row._count, 0);
  return prisma.emailBroadcast.update({
    where: { id: broadcastId },
    data: {
      totalMatched,
      totalEligible: eligible,
      totalSkipped: skipped,
      totalRecipients: eligible,
      queuedCount: count('QUEUED') + count('SENDING'),
      sentCount: count('SENT') + count('DELIVERED') + count('OPENED') + count('CLICKED'),
      deliveredCount: count('DELIVERED') + count('OPENED') + count('CLICKED'),
      openedCount: count('OPENED') + count('CLICKED'),
      clickedCount: count('CLICKED'),
      failedCount: count('FAILED'),
      bouncedCount: count('BOUNCED'),
      complainedCount: count('COMPLAINED'),
      unsubscribedCount: count('SKIPPED_UNSUBSCRIBED'),
    },
  });
}

function normalizeTemplateKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || `template-${Date.now()}`
  );
}

function audienceLabel(audienceKind: string) {
  switch (audienceKind) {
    case 'MAILING_CONSENT':
      return 'Mailing consent';
    case 'VERIFIED_USERS':
      return 'Verified users';
    case 'ACTIVE_USERS':
      return 'Active users';
    case 'PLATFORM_ADMINS':
      return 'Platform admins';
    default:
      return audienceKind;
  }
}

function mapMessage(row: any): EmailMessage {
  return {
    id: row.id,
    to: row.toEmail,
    subject: row.subject,
    status: toApiEnum(row.status) as EmailMessage['status'],
    source: toApiEnum(row.source) as EmailMessage['source'],
    sentAt: (row.sentAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
    errorText: row.errorText ?? null,
    providerMessageId: row.providerMessageId ?? null,
  };
}

function mapTemplate(row: any, includeBodies = false): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    subject: row.subject,
    preheader: row.preheader ?? null,
    ...(includeBodies ? { htmlBody: row.htmlBody, textBody: row.textBody } : {}),
    status: toApiEnum(row.status) as EmailTemplate['status'],
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBroadcast(row: any): EmailBroadcast {
  return {
    id: row.id,
    title: row.title,
    type: toApiEnum(row.type ?? 'MARKETING') as EmailBroadcast['type'],
    audience: audienceLabel(row.audienceKind),
    audienceKind: toApiEnum(row.audienceKind) as EmailBroadcast['audienceKind'],
    audienceSource: toApiEnum(row.audienceSource ?? 'STATIC_FILTER'),
    audienceFilterJson: row.audienceFilterJson ?? null,
    subject: row.subject,
    preheader: row.preheader ?? null,
    status: toApiEnum(row.status) as EmailBroadcast['status'],
    sendMode: toApiEnum(row.sendMode ?? 'DRAFT') as EmailBroadcast['sendMode'],
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    timezone: row.timezone ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    totalMatched: row.totalMatched ?? 0,
    totalEligible: row.totalEligible ?? 0,
    totalSkipped: row.totalSkipped ?? 0,
    totalRecipients: row.totalRecipients ?? 0,
    queuedCount: row.queuedCount ?? 0,
    sentCount: row.sentCount ?? 0,
    deliveredCount: row.deliveredCount ?? 0,
    openedCount: row.openedCount ?? 0,
    clickedCount: row.clickedCount ?? 0,
    failedCount: row.failedCount ?? 0,
    bouncedCount: row.bouncedCount ?? 0,
    complainedCount: row.complainedCount ?? 0,
    unsubscribedCount: row.unsubscribedCount ?? 0,
    errorText: row.errorText ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? undefined,
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name, email: row.createdBy.email } : null,
  };
}

function mapWebhookEvent(row: any): WebhookEvent {
  return {
    id: row.id,
    eventType: row.eventType,
    providerEventId: row.providerEventId ?? null,
    receivedAt: row.receivedAt.toISOString(),
    processingStatus: toApiEnum(row.processingStatus) as WebhookEvent['processingStatus'],
    relatedEntity: row.relatedMessageId ?? row.providerMessageId ?? null,
    errorMessage: row.errorMessage ?? null,
  };
}

export async function getEmailOverview(_actor?: User): Promise<EmailOverview> {
  const emailConfig = getEmailConfig();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    sent24h,
    delivered24h,
    failed24h,
    templatesCount,
    automationsCount,
    recentMessages,
    recentWebhooks,
  ] = await Promise.all([
    prisma.emailMessage.count({ where: { sentAt: { gte: since24h } } }),
    prisma.emailMessage.count({
      where: {
        deliveredAt: { gte: since24h },
      },
    }),
    prisma.emailMessage.count({
      where: {
        updatedAt: { gte: since24h },
        status: { in: ['FAILED', 'BOUNCED', 'COMPLAINED'] as any[] },
      },
    }),
    prisma.emailTemplate.count({ where: { status: { not: 'ARCHIVED' as any } } }),
    Promise.resolve(0),
    prisma.emailMessage.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { source: true, status: true, updatedAt: true },
    }),
    prisma.emailWebhookEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 5,
      select: { eventType: true, processingStatus: true, receivedAt: true },
    }),
  ]);

  const recentActivity = [
    ...recentMessages.map((message) => ({
      type: `email.${toApiEnum(message.source)}`,
      status: toApiEnum(message.status),
      timestamp: message.updatedAt.toISOString(),
    })),
    ...recentWebhooks.map((event) => ({
      type: event.eventType,
      status: toApiEnum(event.processingStatus),
      timestamp: event.receivedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);

  return {
    provider: emailConfig.provider,
    providerStatus: emailConfig.provider ? 'connected' : 'not_configured',
    sendingDomain: emailConfig.sendingDomain,
    sendingDomainStatus: emailConfig.sendingDomain ? 'verified' : 'not_configured',
    webhookStatus: emailConfig.webhookEndpoint && env.RESEND_WEBHOOK_SECRET ? 'active' : 'not_configured',
    webhookEndpoint: emailConfig.webhookEndpoint,
    sent24h,
    delivered24h,
    failed24h,
    templatesCount,
    automationsCount,
    recentActivity,
  };
}

export async function listEmailMessages(params: EmailMessagesQuery = {} as EmailMessagesQuery): Promise<Paginated<EmailMessage>> {
  const { search, status, source, timeRange, page = 1, limit = 50 } = params;
  const cutoff = parseTimeRange(timeRange);

  const where: any = {};

  if (search) {
    where.OR = [
      { toEmail: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { providerMessageId: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status && status !== 'ALL') {
    where.status = MESSAGE_STATUS_TO_DB[status];
  }

  if (source && source !== 'ALL') {
    where.source = MESSAGE_SOURCE_TO_DB[source];
  }

  if (cutoff) {
    where.createdAt = { gte: cutoff };
  }

  const [total, rows] = await Promise.all([
    prisma.emailMessage.count({ where }),
    prisma.emailMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(mapMessage),
    meta: paginationMeta(total, page, limit),
  };
}

export async function listEmailTemplates(params: EmailTemplatesQuery = {} as EmailTemplatesQuery): Promise<Paginated<EmailTemplate>> {
  const { search, status, page = 1, limit = 20 } = params;
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { key: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status && status !== 'ALL') {
    where.status = TEMPLATE_STATUS_TO_DB[status];
  }

  const [total, rows] = await Promise.all([
    prisma.emailTemplate.count({ where }),
    prisma.emailTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map((row) => mapTemplate(row, true)),
    meta: paginationMeta(total, page, limit),
  };
}

export async function createEmailTemplate(input: CreateEmailTemplateInput, actorId?: string): Promise<EmailTemplate> {
  const row = await prisma.emailTemplate.create({
    data: {
      name: input.name,
      key: normalizeTemplateKey(input.key ?? input.name),
      subject: input.subject,
      preheader: input.preheader || null,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      status: TEMPLATE_STATUS_TO_DB[input.status ?? 'draft'] as any,
      createdById: actorId,
      updatedById: actorId,
    },
  });

  return mapTemplate(row, true);
}

export async function updateEmailTemplate(id: string, input: UpdateEmailTemplateInput, actorId?: string): Promise<EmailTemplate> {
  const data: any = {
    updatedById: actorId,
  };

  if (input.name !== undefined) data.name = input.name;
  if (input.key !== undefined) data.key = normalizeTemplateKey(input.key);
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.preheader !== undefined) data.preheader = input.preheader || null;
  if (input.htmlBody !== undefined) data.htmlBody = input.htmlBody;
  if (input.textBody !== undefined) data.textBody = input.textBody;
  if (input.status !== undefined) data.status = TEMPLATE_STATUS_TO_DB[input.status] as any;

  const row = await prisma.emailTemplate.update({
    where: { id },
    data,
  });

  return mapTemplate(row, true);
}

export async function archiveEmailTemplate(id: string, actorId?: string): Promise<EmailTemplate> {
  const row = await prisma.emailTemplate.update({
    where: { id },
    data: {
      status: 'ARCHIVED' as any,
      updatedById: actorId,
    },
  });

  return mapTemplate(row, true);
}

export async function listEmailBroadcasts(actor?: User, params: EmailBroadcastsQuery = {} as EmailBroadcastsQuery): Promise<Paginated<EmailBroadcast>> {
  const { status, type, audienceKind, search, page = 1, limit = 20 } = params;
  const where: any = {};

  if (status && status !== 'all') {
    where.status = BROADCAST_STATUS_TO_DB[status];
  }
  if (type && type !== 'all') where.type = toDbEnum(type, 'MARKETING') as any;
  if (audienceKind && audienceKind !== 'all') where.audienceKind = AUDIENCE_TO_DB[audienceKind] as any;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.emailBroadcast.findMany({
    where,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    skip: isPlatformAdmin(actor) ? (page - 1) * limit : 0,
    take: isPlatformAdmin(actor) ? limit : 200,
  });
  let visibleRows = rows;
  let total = await prisma.emailBroadcast.count({ where });
  if (!isPlatformAdmin(actor)) {
    const managedEventIds = new Set(actor ? await getManagedEventIds(actor, 'participants.readPii') : []);
    visibleRows = rows.filter((row) => {
      const eventId = extractAudienceEventId({ audienceSource: row.audienceSource, audienceFilterJson: row.audienceFilterJson });
      return eventId ? managedEventIds.has(eventId) : false;
    });
    total = visibleRows.length;
    visibleRows = visibleRows.slice((page - 1) * limit, page * limit);
  }

  return {
    data: visibleRows.map(mapBroadcast),
    meta: paginationMeta(total, page, limit),
  };
}

export async function createEmailBroadcast(input: CreateEmailBroadcastInput, actor?: User): Promise<EmailBroadcast> {
  await ensureAudienceAccess(actor, { audienceSource: input.audienceSource ?? 'static_filter', audienceFilterJson: input.audienceFilterJson ?? null });
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const sanitized = sanitizeEmailHtml(input.htmlBody ?? '');
  const sendMode = input.sendNow ? 'send_now' : input.sendMode ?? (scheduledAt ? 'scheduled' : 'draft');
  const row = await prisma.emailBroadcast.create({
    data: {
      title: input.title,
      type: toDbEnum(input.type, 'MARKETING') as any,
      subject: input.subject ?? '',
      preheader: input.preheader || null,
      htmlBody: sanitized.html,
      textBody: input.textBody ?? '',
      audienceKind: AUDIENCE_TO_DB[input.audienceKind ?? 'mailing_consent'] as any,
      audienceSource: AUDIENCE_SOURCE_TO_DB[input.audienceSource ?? 'static_filter'] as any,
      audienceFilterJson: (input.audienceFilterJson ?? null) as any,
      savedAudienceId: input.savedAudienceId || null,
      status: 'DRAFT' as any,
      sendMode: toDbEnum(sendMode, 'DRAFT') as any,
      scheduledAt,
      timezone: input.timezone ?? 'Asia/Tashkent',
      internalNotes: input.internalNotes || null,
      templateId: input.templateId || undefined,
      createdById: actor?.id,
    },
  });
  await addBroadcastEvent({ broadcastId: row.id, type: 'CREATED', actorUserId: actor?.id, payloadJson: { sanitized: sanitized.removed } });

  if (sendMode === 'send_now') return sendEmailBroadcast(row.id, { mode: 'ALL_ELIGIBLE' }, actor);
  if (sendMode === 'scheduled' && scheduledAt) return scheduleEmailBroadcast(row.id, { scheduledAt: scheduledAt.toISOString(), timezone: input.timezone ?? 'Asia/Tashkent' }, actor);

  return mapBroadcast(row);
}

export async function updateEmailBroadcast(id: string, input: UpdateEmailBroadcastInput, actor?: User): Promise<EmailBroadcast> {
  const broadcast = await prisma.emailBroadcast.findUnique({
    where: { id },
  });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  if (!['DRAFT', 'SCHEDULED'].includes(String(broadcast.status))) throw new Error('EMAIL_BROADCAST_NOT_EDITABLE');
  if (input.audienceSource || input.audienceFilterJson) {
    await ensureAudienceAccess(actor, {
      audienceSource: input.audienceSource ?? toApiEnum(broadcast.audienceSource),
      audienceFilterJson: input.audienceFilterJson ?? broadcast.audienceFilterJson,
    });
    await prisma.emailBroadcastRecipient.deleteMany({ where: { broadcastId: id } });
  }
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.type !== undefined) data.type = toDbEnum(input.type, 'MARKETING') as any;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.preheader !== undefined) data.preheader = input.preheader || null;
  if (input.textBody !== undefined) data.textBody = input.textBody;
  if (input.htmlBody !== undefined) data.htmlBody = sanitizeEmailHtml(input.htmlBody).html;
  if (input.audienceKind !== undefined) data.audienceKind = AUDIENCE_TO_DB[input.audienceKind] as any;
  if (input.audienceSource !== undefined) data.audienceSource = AUDIENCE_SOURCE_TO_DB[input.audienceSource] as any;
  if (input.audienceFilterJson !== undefined) data.audienceFilterJson = input.audienceFilterJson as any;
  if (input.savedAudienceId !== undefined) data.savedAudienceId = input.savedAudienceId || null;
  if (input.templateId !== undefined) data.templateId = input.templateId || null;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.internalNotes !== undefined) data.internalNotes = input.internalNotes || null;
  const row = await prisma.emailBroadcast.update({ where: { id }, data });
  await addBroadcastEvent({ broadcastId: id, type: 'UPDATED', actorUserId: actor?.id, payloadJson: data });
  return mapBroadcast(row);
}

export async function sendEmailBroadcast(id: string, input: SendBroadcastInput = { mode: 'ALL_ELIGIBLE' }, actor?: User): Promise<EmailBroadcast> {
  const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  if (!['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIAL', 'CANCELLED'].includes(String(broadcast.status))) throw new Error('EMAIL_BROADCAST_NOT_SENDABLE');
  validateSendableContent(broadcast);

  if (input.mode === 'FAILED_ONLY') {
    const updated = await prisma.emailBroadcastRecipient.updateMany({
      where: { broadcastId: id, status: 'FAILED' as any },
      data: { status: 'QUEUED' as any, queuedAt: new Date(), failureReason: null, retryCount: { increment: 1 }, lastRetryAt: new Date() },
    });
    if (updated.count === 0) throw new Error('NO_FAILED_RECIPIENTS_TO_RETRY');
  } else {
    await createEmailBroadcastSnapshot(id, actor);
  }

  const queued = await prisma.emailBroadcast.update({
    where: { id },
    data: { status: 'QUEUED' as any, sendMode: 'SEND_NOW' as any, scheduledAt: null, startedAt: null, finishedAt: null, cancelledAt: null, errorText: null },
  });
  await recalculateBroadcastCounters(id);
  await addBroadcastEvent({ broadcastId: id, type: 'QUEUED', actorUserId: actor?.id, payloadJson: { mode: input.mode } });
  return mapBroadcast(queued);
}

export async function createEmailBroadcastSnapshot(id: string, actor?: User): Promise<EmailBroadcast> {
  const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  const result = await resolveAudience({
    broadcastId: id,
    broadcastType: toApiEnum(broadcast.type),
    audienceKind: toApiEnum(broadcast.audienceKind),
    audienceSource: toApiEnum(broadcast.audienceSource),
    audienceFilterJson: broadcast.audienceFilterJson,
    savedAudienceId: broadcast.savedAudienceId,
    includeSkipped: true,
    limit: EMAIL_BROADCAST_MAX_RECIPIENTS + 1,
    resultLimit: EMAIL_BROADCAST_MAX_RECIPIENTS + 1,
  });
  if (result.totalEligible > EMAIL_BROADCAST_MAX_RECIPIENTS) throw new Error(`EMAIL_BROADCAST_MAX_RECIPIENTS_EXCEEDED:${EMAIL_BROADCAST_MAX_RECIPIENTS}`);

  await prisma.$transaction(async (tx) => {
    await tx.emailBroadcastRecipient.deleteMany({ where: { broadcastId: id } });
    for (const item of result.items) {
      await tx.emailBroadcastRecipient.create({
        data: {
          broadcastId: id,
          userId: item.userId ?? null,
          email: item.email ?? '',
          normalizedEmail: item.normalizedEmail ?? `missing-${item.userId ?? Date.now()}`,
          name: item.name ?? null,
          status: item.eligible ? 'QUEUED' as any : item.status as any,
          skipReason: item.skipReason ?? null,
          consentSnapshotJson: item.consentSnapshot as any,
          variablesSnapshotJson: item.variables as any,
          audienceReasonJson: item.audienceReason as any,
          queuedAt: item.eligible ? new Date() : null,
          skippedAt: item.eligible ? null : new Date(),
        },
      });
    }
    await tx.emailBroadcast.update({
      where: { id },
      data: {
        totalMatched: result.totalMatched,
        totalEligible: result.totalEligible,
        totalSkipped: result.totalSkipped,
        totalRecipients: result.totalEligible,
        queuedCount: result.totalEligible,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        failedCount: 0,
        bouncedCount: 0,
        complainedCount: 0,
        unsubscribedCount: 0,
        errorText: null,
      },
    });
  });
  await addBroadcastEvent({ broadcastId: id, type: 'RECIPIENT_SNAPSHOT_CREATED', actorUserId: actor?.id, payloadJson: { totalMatched: result.totalMatched, totalEligible: result.totalEligible, totalSkipped: result.totalSkipped, skippedByReason: result.skippedByReason } });
  const row = await prisma.emailBroadcast.findUnique({ where: { id } });
  return mapBroadcast(row);
}

export async function scheduleEmailBroadcast(id: string, input: ScheduleBroadcastInput, actor?: User): Promise<EmailBroadcast> {
  const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  validateSendableContent(broadcast);
  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt.getTime() <= Date.now()) throw new Error('SCHEDULED_AT_IN_PAST');
  await createEmailBroadcastSnapshot(id, actor);
  const row = await prisma.emailBroadcast.update({
    where: { id },
    data: { status: 'SCHEDULED' as any, sendMode: 'SCHEDULED' as any, scheduledAt, timezone: input.timezone, errorText: null },
  });
  await addBroadcastEvent({ broadcastId: id, type: 'SCHEDULED', actorUserId: actor?.id, payloadJson: { scheduledAt: scheduledAt.toISOString(), timezone: input.timezone } });
  return mapBroadcast(row);
}

export async function cancelEmailBroadcast(id: string, actor?: User): Promise<EmailBroadcast> {
  const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  if (!['SCHEDULED', 'QUEUED', 'SENDING'].includes(String(broadcast.status))) throw new Error('EMAIL_BROADCAST_NOT_CANCELLABLE');
  await prisma.emailBroadcastRecipient.updateMany({
    where: { broadcastId: id, status: { in: ['MATCHED', 'QUEUED', 'SENDING'] as any[] } },
    data: { status: 'CANCELLED' as any, cancelledAt: new Date() },
  });
  const row = await prisma.emailBroadcast.update({ where: { id }, data: { status: 'CANCELLED' as any, cancelledAt: new Date(), finishedAt: new Date() } });
  await recalculateBroadcastCounters(id);
  await addBroadcastEvent({ broadcastId: id, type: 'CANCELLED', actorUserId: actor?.id });
  return mapBroadcast(row);
}

export async function getEmailBroadcast(id: string, actor?: User) {
  const row = await prisma.emailBroadcast.findUnique({
    where: { id },
    include: {
      template: true,
      createdBy: { select: { id: true, name: true, email: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!row) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, row);
  return {
    broadcast: { ...mapBroadcast(row), htmlBody: row.htmlBody, textBody: row.textBody, internalNotes: row.internalNotes ?? null },
    template: row.template ? mapTemplate(row.template, false) : null,
    statistics: analyticsFromBroadcast(row),
    latestEvents: row.events.map(event => ({ id: event.id, type: toApiEnum(event.type), recipientId: event.recipientId, actorUserId: event.actorUserId, payloadJson: event.payloadJson, createdAt: event.createdAt.toISOString() })),
  };
}

export async function estimateEmailAudience(input: AudienceEstimateInput, actor?: User) {
  await ensureAudienceAccess(actor, { audienceSource: input.audienceSource ?? 'static_filter', audienceFilterJson: input.audienceFilterJson ?? null });
  const result = await resolveAudience({
    broadcastType: input.broadcastType ?? input.type ?? 'marketing',
    audienceKind: input.audienceKind,
    audienceSource: input.audienceSource ?? 'static_filter',
    audienceFilterJson: input.audienceFilterJson,
    savedAudienceId: input.savedAudienceId,
    includeSkipped: true,
    limit: EMAIL_BROADCAST_MAX_RECIPIENTS + 1,
    resultLimit: 1,
  });
  return { totalMatched: result.totalMatched, totalEligible: result.totalEligible, totalSkipped: result.totalSkipped, skippedByReason: result.skippedByReason };
}

export async function previewEmailAudience(input: AudienceEstimateInput, query: AudiencePreviewQuery, actor?: User) {
  await ensureAudienceAccess(actor, { audienceSource: input.audienceSource ?? 'static_filter', audienceFilterJson: input.audienceFilterJson ?? null });
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const result = await resolveAudience({
    broadcastType: input.broadcastType ?? input.type ?? 'marketing',
    audienceKind: input.audienceKind,
    audienceSource: input.audienceSource ?? 'static_filter',
    audienceFilterJson: input.audienceFilterJson,
    savedAudienceId: input.savedAudienceId,
    includeSkipped: true,
    limit: EMAIL_BROADCAST_MAX_RECIPIENTS + 1,
    resultLimit: EMAIL_BROADCAST_MAX_RECIPIENTS + 1,
  });
  const filtered = result.items.filter(item => {
    if (query.status && query.status !== 'ALL' && item.status !== query.status.toUpperCase()) return false;
    if (!query.search) return true;
    const needle = query.search.toLowerCase();
    return [item.email, item.name, item.userId].filter(Boolean).some(value => String(value).toLowerCase().includes(needle));
  });
  return { data: filtered.slice((page - 1) * limit, page * limit), meta: paginationMeta(filtered.length, page, limit), totals: { totalMatched: result.totalMatched, totalEligible: result.totalEligible, totalSkipped: result.totalSkipped, skippedByReason: result.skippedByReason } };
}

export async function listEmailBroadcastRecipients(id: string, query: EmailRecipientsQuery, actor?: User) {
  const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const where: any = { broadcastId: id };
  if (query.status && query.status !== 'ALL') where.status = query.status.toUpperCase();
  if (query.search) where.OR = [
    { email: { contains: query.search, mode: 'insensitive' } },
    { name: { contains: query.search, mode: 'insensitive' } },
    { providerMessageId: { contains: query.search, mode: 'insensitive' } },
  ];
  const [total, rows] = await Promise.all([
    prisma.emailBroadcastRecipient.count({ where }),
    prisma.emailBroadcastRecipient.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return {
    data: rows.map(row => ({
      id: row.id,
      userId: row.userId,
      email: row.email,
      name: row.name,
      status: row.status,
      skipReason: row.skipReason,
      failureReason: row.failureReason,
      provider: row.provider,
      providerMessageId: row.providerMessageId,
      queuedAt: row.queuedAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      openedAt: row.openedAt?.toISOString() ?? null,
      clickedAt: row.clickedAt?.toISOString() ?? null,
      bouncedAt: row.bouncedAt?.toISOString() ?? null,
      complainedAt: row.complainedAt?.toISOString() ?? null,
      unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
      retryCount: row.retryCount,
    })),
    meta: paginationMeta(total, page, limit),
  };
}

function analyticsFromBroadcast(broadcast: any) {
  const deliveryRate = broadcast.sentCount ? (broadcast.deliveredCount / broadcast.sentCount) * 100 : 0;
  const openRate = broadcast.deliveredCount ? (broadcast.openedCount / broadcast.deliveredCount) * 100 : 0;
  const clickRate = broadcast.deliveredCount ? (broadcast.clickedCount / broadcast.deliveredCount) * 100 : 0;
  const unsubscribeRate = broadcast.sentCount ? (broadcast.unsubscribedCount / broadcast.sentCount) * 100 : 0;
  return {
    totalMatched: broadcast.totalMatched ?? 0,
    totalEligible: broadcast.totalEligible ?? 0,
    totalSkipped: broadcast.totalSkipped ?? 0,
    queuedCount: broadcast.queuedCount ?? 0,
    sentCount: broadcast.sentCount ?? 0,
    deliveredCount: broadcast.deliveredCount ?? 0,
    openedCount: broadcast.openedCount ?? 0,
    clickedCount: broadcast.clickedCount ?? 0,
    failedCount: broadcast.failedCount ?? 0,
    bouncedCount: broadcast.bouncedCount ?? 0,
    complainedCount: broadcast.complainedCount ?? 0,
    unsubscribedCount: broadcast.unsubscribedCount ?? 0,
    deliveryRate: Number(deliveryRate.toFixed(2)),
    openRate: Number(openRate.toFixed(2)),
    clickRate: Number(clickRate.toFixed(2)),
    unsubscribeRate: Number(unsubscribeRate.toFixed(2)),
  };
}

export async function getEmailBroadcastAnalytics(id: string, actor?: User) {
  const broadcast = await prisma.emailBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  await ensureBroadcastAccess(actor, broadcast);
  const [timeline, errorsByReason] = await Promise.all([
    prisma.emailBroadcastEvent.groupBy({ by: ['type'], where: { broadcastId: id }, _count: true }),
    prisma.emailBroadcastRecipient.groupBy({ by: ['failureReason'], where: { broadcastId: id, status: 'FAILED' as any }, _count: true }),
  ]);
  return {
    ...analyticsFromBroadcast(broadcast),
    timeline: timeline.map(row => ({ type: row.type, count: row._count })),
    topLinks: [],
    errorsByReason: errorsByReason.map(row => ({ reason: row.failureReason ?? 'UNKNOWN', count: row._count })),
  };
}

export async function retryEmailBroadcastRecipient(id: string, recipientId: string, actor?: User) {
  const recipient = await prisma.emailBroadcastRecipient.findUnique({ where: { id: recipientId }, include: { broadcast: true } });
  if (!recipient || recipient.broadcastId !== id) throw new Error('EMAIL_RECIPIENT_NOT_FOUND');
  await ensureBroadcastAccess(actor, recipient.broadcast);
  if (!['FAILED', 'BOUNCED'].includes(String(recipient.status))) throw new Error('EMAIL_RECIPIENT_NOT_RETRYABLE');
  await prisma.emailBroadcastRecipient.update({
    where: { id: recipientId },
    data: { status: 'QUEUED' as any, queuedAt: new Date(), failureReason: null, retryCount: { increment: 1 }, lastRetryAt: new Date() },
  });
  const broadcast = await prisma.emailBroadcast.update({ where: { id }, data: { status: 'QUEUED' as any, finishedAt: null, errorText: null } });
  await recalculateBroadcastCounters(id);
  await addBroadcastEvent({ broadcastId: id, recipientId, type: 'QUEUED', actorUserId: actor?.id, payloadJson: { retry: true } });
  return mapBroadcast(broadcast);
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportEmailBroadcastRecipientsCsv(id: string, actor?: User) {
  const detail = await getEmailBroadcast(id, actor);
  const rows = await prisma.emailBroadcastRecipient.findMany({ where: { broadcastId: id }, orderBy: { createdAt: 'asc' } });
  const headers = ['broadcastTitle', 'name', 'email', 'userId', 'status', 'skipReason', 'failureReason', 'provider', 'providerMessageId', 'queuedAt', 'sentAt', 'deliveredAt', 'openedAt', 'clickedAt', 'bouncedAt', 'complainedAt', 'unsubscribedAt', 'retryCount'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      detail.broadcast.title,
      row.name,
      row.email,
      row.userId,
      row.status,
      row.skipReason,
      row.failureReason,
      row.provider,
      row.providerMessageId,
      row.queuedAt?.toISOString() ?? '',
      row.sentAt?.toISOString() ?? '',
      row.deliveredAt?.toISOString() ?? '',
      row.openedAt?.toISOString() ?? '',
      row.clickedAt?.toISOString() ?? '',
      row.bouncedAt?.toISOString() ?? '',
      row.complainedAt?.toISOString() ?? '',
      row.unsubscribedAt?.toISOString() ?? '',
      row.retryCount,
    ].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export async function previewEmailContent(input: EmailPreviewInput) {
  const sanitized = sanitizeEmailHtml(input.htmlBody ?? '');
  const rendered = renderEmailContent({
    subject: input.subject,
    preheader: input.preheader,
    textBody: input.textBody,
    htmlBody: sanitized.html,
    variables: input.sampleVariables,
  });
  return {
    subjectPreview: rendered.subject,
    preheaderPreview: rendered.preheader,
    textPreview: rendered.text,
    htmlPreview: rendered.html,
    warnings: [...rendered.warnings, ...sanitized.warnings],
    unknownVariables: rendered.unknownVariables,
  };
}

export async function sendTestEmail(input: EmailTestSendInput, actor?: User) {
  if (!isPlatformAdmin(actor)) throw new Error('FORBIDDEN');
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const sentRecently = await prisma.emailMessage.count({ where: { source: 'ADMIN_TEST' as any, toEmail: input.toEmail, createdAt: { gte: since } } });
  if (sentRecently >= EMAIL_TEST_SEND_RATE_LIMIT_PER_HOUR) throw new Error('EMAIL_TEST_SEND_RATE_LIMITED');
  const preview = await previewEmailContent({
    subject: input.subject,
    preheader: input.preheader,
    textBody: input.textBody,
    htmlBody: input.htmlBody,
    sampleVariables: { name: 'Admin', email: input.toEmail, unsubscribeUrl: `${env.APP_URL}/ru/unsubscribe?token=test` },
  });
  await sendPlatformEmail({ to: input.toEmail, subject: preview.subjectPreview, text: preview.textPreview, html: preview.htmlPreview, source: 'admin_test' });
  return { ok: true, toEmail: input.toEmail, warnings: preview.warnings };
}

async function recipientStillEligible(broadcast: any, recipient: any) {
  if (!recipient.userId) return { eligible: true };
  const user = await prisma.user.findUnique({
    where: { id: recipient.userId },
    select: {
      email: true,
      isActive: true,
      emailVerifiedAt: true,
      extendedProfile: { select: { consentMailing: true } },
      communicationConsents: { where: { channel: 'EMAIL' as any }, select: { topic: true, status: true } },
    },
  });
  if (!user?.email) return { eligible: false, status: 'SKIPPED_NO_EMAIL', reason: 'Email is missing before send.' };
  if (!user.isActive) return { eligible: false, status: 'SKIPPED_BLOCKED', reason: 'User became inactive before send.' };
  if (['MARKETING', 'EVENT_ANNOUNCEMENT', 'EVENT_REMINDER'].includes(String(broadcast.type)) && !user.emailVerifiedAt) {
    return { eligible: false, status: 'SKIPPED_EMAIL_NOT_VERIFIED', reason: 'Email is not verified before send.' };
  }
  const suppressed = await prisma.emailSuppression.findUnique({ where: { normalizedEmail: normalizeEmail(user.email) } });
  if (suppressed) return { eligible: false, status: 'SKIPPED_SUPPRESSED', reason: `Email suppressed before send: ${suppressed.reason}` };
  const topics = String(broadcast.type) === 'EVENT_ANNOUNCEMENT'
    ? ['EVENT_ANNOUNCEMENTS', 'MARKETING']
    : String(broadcast.type) === 'EVENT_REMINDER'
      ? ['EVENT_REMINDERS', 'MARKETING']
      : String(broadcast.type) === 'MARKETING'
        ? ['MARKETING']
        : [];
  if (topics.length) {
    const consents = user.communicationConsents ?? [];
    if (consents.some(consent => topics.includes(consent.topic) && consent.status === 'OPTED_OUT')) {
      return { eligible: false, status: 'SKIPPED_UNSUBSCRIBED', reason: 'User opted out before send.' };
    }
    const optedIn = consents.some(consent => topics.includes(consent.topic) && consent.status === 'OPTED_IN')
      || (topics.includes('MARKETING') && user.extendedProfile?.consentMailing === true);
    if (!optedIn) return { eligible: false, status: 'SKIPPED_NO_CONSENT', reason: 'Consent missing before send.' };
  }
  return { eligible: true };
}

async function sendQueuedRecipient(broadcast: any, recipient: any) {
  const recheck = await recipientStillEligible(broadcast, recipient);
  if (!recheck.eligible) {
    await prisma.emailBroadcastRecipient.update({ where: { id: recipient.id }, data: { status: recheck.status as any, skipReason: recheck.reason, skippedAt: new Date() } });
    await addBroadcastEvent({ broadcastId: broadcast.id, recipientId: recipient.id, type: 'RECIPIENT_SKIPPED', payloadJson: recheck });
    return;
  }
  await prisma.emailBroadcastRecipient.update({ where: { id: recipient.id }, data: { status: 'SENDING' as any, sendingAt: new Date() } });
  const variables = (recipient.variablesSnapshotJson ?? {}) as Record<string, string>;
  const rendered = renderEmailContent({
    subject: broadcast.subject,
    preheader: broadcast.preheader,
    textBody: broadcast.textBody,
    htmlBody: sanitizeEmailHtml(broadcast.htmlBody).html,
    variables,
  });
  let messageId: string | null = null;
  try {
    const message = await prisma.emailMessage.create({
      data: { toEmail: recipient.email, toUserId: recipient.userId, subject: rendered.subject, source: 'BROADCAST' as any, status: 'PENDING' as any, broadcastId: broadcast.id, templateId: broadcast.templateId },
      select: { id: true },
    });
    messageId = message.id;
    const providerResult = await getEmailProvider().sendEmail({
      to: recipient.email,
      subject: rendered.subject,
      preheader: rendered.preheader,
      text: rendered.text,
      html: rendered.html,
      idempotencyKey: `${broadcast.id}:${recipient.id}:${recipient.retryCount}`,
      metadata: { source: 'broadcast', broadcastId: broadcast.id, recipientId: recipient.id },
    });
    await prisma.emailMessage.update({ where: { id: message.id }, data: { status: 'SENT' as any, sentAt: new Date(), providerMessageId: providerResult.providerMessageId ?? null, errorText: null } });
    await prisma.emailBroadcastRecipient.update({ where: { id: recipient.id }, data: { status: 'SENT' as any, sentAt: new Date(), emailMessageId: message.id, provider: providerResult.provider, providerMessageId: providerResult.providerMessageId ?? null, failureReason: null } });
    await addBroadcastEvent({ broadcastId: broadcast.id, recipientId: recipient.id, type: 'RECIPIENT_SENT', payloadJson: { provider: providerResult.provider } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (messageId) await prisma.emailMessage.update({ where: { id: messageId }, data: { status: 'FAILED' as any, errorText: reason } }).catch(() => null);
    await prisma.emailBroadcastRecipient.update({ where: { id: recipient.id }, data: { status: 'FAILED' as any, failedAt: new Date(), failureReason: reason, emailMessageId: messageId } });
    await addBroadcastEvent({ broadcastId: broadcast.id, recipientId: recipient.id, type: 'RECIPIENT_FAILED', payloadJson: { reason } });
  }
}

export async function emailBroadcastWorkerTick() {
  const now = new Date();
  const dueScheduled = await prisma.emailBroadcast.findMany({ where: { status: 'SCHEDULED' as any, scheduledAt: { lte: now } }, select: { id: true }, take: 20 });
  for (const broadcast of dueScheduled) {
    await prisma.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: 'QUEUED' as any, sendMode: 'SEND_NOW' as any } });
    await addBroadcastEvent({ broadcastId: broadcast.id, type: 'QUEUED', payloadJson: { reason: 'scheduled_due' } });
  }

  await prisma.emailBroadcastRecipient.updateMany({
    where: {
      status: 'SENDING' as any,
      sendingStartedAt: {
        lt: new Date(Date.now() - 15 * 60 * 1000),
      },
      retryCount: { lt: 3 },
    },
    data: {
      status: 'QUEUED' as any,
      failureReason: null,
    },
  });

  const broadcasts = await prisma.emailBroadcast.findMany({ where: { status: { in: ['QUEUED', 'SENDING'] as any[] } }, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }], take: 5 });
  for (const broadcast of broadcasts) {
    if (broadcast.status === 'QUEUED') {
      await prisma.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: 'SENDING' as any, startedAt: broadcast.startedAt ?? new Date(), errorText: null } });
      await addBroadcastEvent({ broadcastId: broadcast.id, type: 'SENDING_STARTED' });
    }
    const claimedRecipients = await prisma.$transaction(async (tx) => {
      const rows = await tx.emailBroadcastRecipient.findMany({
        where: { broadcastId: broadcast.id, status: 'QUEUED' as any },
        orderBy: { queuedAt: 'asc' },
        take: EMAIL_BROADCAST_BATCH_SIZE,
      });

      if (rows.length === 0) return rows;

      const updated = await tx.emailBroadcastRecipient.updateMany({
        where: {
          id: { in: rows.map(row => row.id) },
          status: 'QUEUED' as any,
        },
        data: {
          status: 'SENDING' as any,
          sendingStartedAt: new Date(),
        },
      });

      if (updated.count !== rows.length) {
        return [];
      }

      return rows;
    });

    for (let index = 0; index < claimedRecipients.length; index += EMAIL_BROADCAST_CONCURRENCY) {
      await Promise.all(claimedRecipients.slice(index, index + EMAIL_BROADCAST_CONCURRENCY).map(recipient => sendQueuedRecipient(broadcast, recipient)));
    }
    await recalculateBroadcastCounters(broadcast.id);
    const remaining = await prisma.emailBroadcastRecipient.count({ where: { broadcastId: broadcast.id, status: { in: ['QUEUED', 'SENDING'] as any[] } } });
    if (remaining === 0) {
      const failed = await prisma.emailBroadcastRecipient.count({ where: { broadcastId: broadcast.id, status: { in: ['FAILED', 'BOUNCED', 'COMPLAINED'] as any[] } } });
      const sent = await prisma.emailBroadcastRecipient.count({ where: { broadcastId: broadcast.id, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'] as any[] } } });
      const finalStatus = sent > 0 && failed === 0 ? 'SENT' : sent > 0 ? 'PARTIAL' : failed > 0 ? 'FAILED' : 'CANCELLED';
      await prisma.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: finalStatus as any, finishedAt: new Date(), errorText: failed > 0 ? `${failed} recipient(s) failed.` : null } });
      await addBroadcastEvent({ broadcastId: broadcast.id, type: 'FINISHED', payloadJson: { finalStatus } });
    }
  }
}

export async function listEmailAutomations(params: { status?: string; page?: number; limit?: number } = {}): Promise<Paginated<EmailAutomation>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  return {
    data: [],
    meta: paginationMeta(0, page, limit),
  };
}

export async function getEmailAudience(): Promise<EmailAudienceData> {
  const [
    totalContacts,
    verifiedContacts,
    mailingConsent,
    activeUsers,
    platformAdmins,
    eventParticipantRows,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, emailVerifiedAt: { not: null } } }),
    prisma.user.count({
      where: {
        isActive: true,
        emailVerifiedAt: { not: null },
        extendedProfile: { is: { consentMailing: true } },
      },
    }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, role: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] as any[] } } }),
    prisma.eventMember.groupBy({
      by: ['userId'],
    }),
  ]);

  const now = new Date().toISOString();
  const unsubscribed = Math.max(totalContacts - mailingConsent, 0);

  return {
    totalContacts,
    verifiedContacts,
    unsubscribed,
    segmentsCount: 5,
    segments: [
      { id: 'mailing_consent', name: 'Mailing consent', size: mailingConsent, source: 'user_extended_profiles.consentMailing', updatedAt: now },
      { id: 'verified_users', name: 'Verified users', size: verifiedContacts, source: 'users.emailVerifiedAt', updatedAt: now },
      { id: 'active_users', name: 'Active users', size: activeUsers, source: 'users.isActive', updatedAt: now },
      { id: 'event_participants', name: 'Event participants', size: eventParticipantRows.length, source: 'event_members', updatedAt: now },
      { id: 'platform_admins', name: 'Platform admins', size: platformAdmins, source: 'users.role', updatedAt: now },
    ],
  };
}

export async function listEmailDomains(params: EmailDomainsQuery = {} as EmailDomainsQuery): Promise<Paginated<EmailDomain>> {
  const { search, page = 1, limit = 20 } = params;
  const emailConfig = getEmailConfig();

  if (!emailConfig.provider || !emailConfig.sendingDomain) {
    return {
      data: [],
      meta: paginationMeta(0, page, limit),
    };
  }

  const domain: EmailDomain = {
    id: `domain_${emailConfig.sendingDomain}`,
    domain: emailConfig.sendingDomain,
    provider: emailConfig.provider,
    verificationStatus: 'verified',
    spf: true,
    dkim: true,
    dmarc: true,
    isDefault: true,
  };

  const data = search && !domain.domain.toLowerCase().includes(search.toLowerCase()) ? [] : [domain];

  return {
    data,
    meta: paginationMeta(data.length, page, limit),
  };
}

export async function getEmailWebhooks(params: EmailWebhooksQuery = {} as EmailWebhooksQuery): Promise<EmailWebhooksData> {
  const emailConfig = getEmailConfig();
  const where: any = {};

  if (params.status && params.status !== 'ALL') {
    where.processingStatus = WEBHOOK_STATUS_TO_DB[params.status];
  }

  const [
    totalReceived,
    totalSuccess,
    totalFailed,
    logs,
  ] = await Promise.all([
    prisma.emailWebhookEvent.count(),
    prisma.emailWebhookEvent.count({ where: { processingStatus: 'PROCESSED' as any } }),
    prisma.emailWebhookEvent.count({ where: { processingStatus: 'FAILED' as any } }),
    prisma.emailWebhookEvent.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: params.limit ?? 50,
      skip: ((params.page ?? 1) - 1) * (params.limit ?? 50),
    }),
  ]);

  return {
    endpoint: emailConfig.webhookEndpoint ?? null,
    signatureStatus: env.RESEND_WEBHOOK_SECRET ? 'valid' : 'unknown',
    subscribedEvents: SUBSCRIBED_RESEND_EVENTS,
    totalReceived,
    totalSuccess,
    totalFailed,
    logs: logs.map(mapWebhookEvent),
  };
}

export async function processResendWebhookEvent(event: ResendWebhookEvent, providerEventId?: string | null) {
  const eventType = event.type ?? 'unknown';
  const providerMessageId = event.data?.email_id ?? null;
  const eventKey = providerEventId ?? `resend-${eventType}-${providerMessageId ?? event.created_at ?? 'unknown'}`;

  const webhookEvent = await prisma.emailWebhookEvent.upsert({
    where: { providerEventId: eventKey },
    update: {
      eventType,
      providerMessageId,
      payloadJson: event as any,
      processingStatus: 'PROCESSING' as any,
      errorMessage: null,
    },
    create: {
      eventType,
      providerEventId: eventKey,
      providerMessageId,
      payloadJson: event as any,
      processingStatus: 'PROCESSING' as any,
    },
  });

  try {
    const message = providerMessageId
      ? await prisma.emailMessage.findUnique({ where: { providerMessageId } })
      : null;

    if (message) {
      await prisma.emailMessage.update({
        where: { id: message.id },
        data: mapWebhookMessageUpdate(eventType),
      });
    }

    const recipient = providerMessageId
      ? await prisma.emailBroadcastRecipient.findFirst({
          where: {
            OR: [
              { providerMessageId },
              ...(message ? [{ emailMessageId: message.id }] : []),
            ],
          },
        })
      : null;

    if (recipient) {
      const recipientUpdate = mapWebhookRecipientUpdate(eventType);
      if (Object.keys(recipientUpdate.data).length > 0) {
        await prisma.emailBroadcastRecipient.update({
          where: { id: recipient.id },
          data: recipientUpdate.data,
        });
        await addBroadcastEvent({
          broadcastId: recipient.broadcastId,
          recipientId: recipient.id,
          type: recipientUpdate.eventType,
          payloadJson: event,
        });
        if (recipientUpdate.suppressionReason) {
          await prisma.emailSuppression.upsert({
            where: { normalizedEmail: recipient.normalizedEmail },
            update: { reason: recipientUpdate.suppressionReason, provider: 'resend', providerEventId: eventKey, source: 'webhook' },
            create: { normalizedEmail: recipient.normalizedEmail, reason: recipientUpdate.suppressionReason, provider: 'resend', providerEventId: eventKey, source: 'webhook' },
          });
        }
        await recalculateBroadcastCounters(recipient.broadcastId);
      }
    }

    await prisma.emailWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processingStatus: 'PROCESSED' as any,
        relatedMessageId: message?.id ?? null,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.emailWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processingStatus: 'FAILED' as any,
        errorMessage: error instanceof Error ? error.message : String(error),
        processedAt: new Date(),
      },
    });
    throw error;
  }
}

function mapWebhookMessageUpdate(eventType: string) {
  const now = new Date();

  switch (eventType) {
    case 'email.sent':
      return { status: 'SENT' as any, sentAt: now };
    case 'email.delivered':
      return { status: 'DELIVERED' as any, deliveredAt: now };
    case 'email.opened':
      return { status: 'OPENED' as any, openedAt: now };
    case 'email.clicked':
      return { status: 'CLICKED' as any, clickedAt: now };
    case 'email.bounced':
      return { status: 'BOUNCED' as any, bouncedAt: now };
    case 'email.complained':
      return { status: 'COMPLAINED' as any, complainedAt: now };
    default:
      return {};
  }
}

function mapWebhookRecipientUpdate(eventType: string) {
  const now = new Date();
  switch (eventType) {
    case 'email.sent':
      return { data: { status: 'SENT' as any, sentAt: now }, eventType: 'RECIPIENT_SENT', suppressionReason: null };
    case 'email.delivered':
      return { data: { status: 'DELIVERED' as any, deliveredAt: now }, eventType: 'DELIVERED', suppressionReason: null };
    case 'email.opened':
      return { data: { status: 'OPENED' as any, openedAt: now }, eventType: 'OPENED', suppressionReason: null };
    case 'email.clicked':
      return { data: { status: 'CLICKED' as any, clickedAt: now }, eventType: 'CLICKED', suppressionReason: null };
    case 'email.bounced':
      return { data: { status: 'BOUNCED' as any, bouncedAt: now }, eventType: 'BOUNCED', suppressionReason: 'BOUNCED' };
    case 'email.complained':
      return { data: { status: 'COMPLAINED' as any, complainedAt: now }, eventType: 'COMPLAINED', suppressionReason: 'COMPLAINED' };
    default:
      return { data: {}, eventType: 'UPDATED', suppressionReason: null };
  }
}

async function resolveAudienceRecipients(audienceKind: string): Promise<AudienceRecipient[]> {
  const baseSelect = { id: true, email: true, name: true };

  const whereByAudience: Record<string, any> = {
    MAILING_CONSENT: {
      isActive: true,
      emailVerifiedAt: { not: null },
      extendedProfile: { is: { consentMailing: true } },
    },
    VERIFIED_USERS: {
      isActive: true,
      emailVerifiedAt: { not: null },
    },
    ACTIVE_USERS: {
      isActive: true,
    },
    PLATFORM_ADMINS: {
      isActive: true,
      role: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] },
    },
  };

  return prisma.user.findMany({
    where: whereByAudience[audienceKind] ?? whereByAudience.MAILING_CONSENT,
    select: baseSelect,
    orderBy: { registeredAt: 'desc' },
    take: EMAIL_BROADCAST_MAX_RECIPIENTS + 1,
  });
}

function renderRecipientText(value: string, recipient: AudienceRecipient) {
  return value
    .replace(/\{\{\s*name\s*\}\}/g, recipient.name ?? recipient.email)
    .replace(/\{\{\s*email\s*\}\}/g, recipient.email);
}
