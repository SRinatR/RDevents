import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { sendPlatformEmail } from '../../common/email.js';
import type {
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
  EmailOverview,
  EmailTemplate,
  EmailTemplatesQuery,
  EmailWebhooksData,
  EmailWebhooksQuery,
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
  sending: 'SENDING',
  sent: 'SENT',
  partial: 'PARTIAL',
  failed: 'FAILED',
};

const AUDIENCE_TO_DB: Record<string, string> = {
  mailing_consent: 'MAILING_CONSENT',
  verified_users: 'VERIFIED_USERS',
  active_users: 'ACTIVE_USERS',
  platform_admins: 'PLATFORM_ADMINS',
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
    audience: audienceLabel(row.audienceKind),
    audienceKind: toApiEnum(row.audienceKind) as EmailBroadcast['audienceKind'],
    subject: row.subject,
    status: toApiEnum(row.status) as EmailBroadcast['status'],
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    totalRecipients: row.totalRecipients ?? 0,
    sentCount: row.sentCount ?? 0,
    failedCount: row.failedCount ?? 0,
    errorText: row.errorText ?? null,
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

export async function getEmailOverview(): Promise<EmailOverview> {
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

export async function listEmailBroadcasts(params: EmailBroadcastsQuery = {} as EmailBroadcastsQuery): Promise<Paginated<EmailBroadcast>> {
  const { status, page = 1, limit = 20 } = params;
  const where: any = {};

  if (status && status !== 'ALL') {
    where.status = BROADCAST_STATUS_TO_DB[status];
  }

  const [total, rows] = await Promise.all([
    prisma.emailBroadcast.count({ where }),
    prisma.emailBroadcast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(mapBroadcast),
    meta: paginationMeta(total, page, limit),
  };
}

export async function createEmailBroadcast(input: CreateEmailBroadcastInput, actorId?: string): Promise<EmailBroadcast> {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const row = await prisma.emailBroadcast.create({
    data: {
      title: input.title,
      subject: input.subject,
      preheader: input.preheader || null,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      audienceKind: AUDIENCE_TO_DB[input.audienceKind ?? 'mailing_consent'] as any,
      status: scheduledAt && scheduledAt.getTime() > Date.now() ? 'SCHEDULED' as any : 'DRAFT' as any,
      scheduledAt,
      templateId: input.templateId || undefined,
      createdById: actorId,
    },
  });

  if (input.sendNow) {
    return sendEmailBroadcast(row.id);
  }

  return mapBroadcast(row);
}

export async function sendEmailBroadcast(id: string): Promise<EmailBroadcast> {
  const broadcast = await prisma.emailBroadcast.findUnique({
    where: { id },
  });

  if (!broadcast) {
    throw new Error('EMAIL_BROADCAST_NOT_FOUND');
  }

  if (!['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIAL'].includes(String(broadcast.status))) {
    throw new Error('EMAIL_BROADCAST_NOT_SENDABLE');
  }

  const recipients = await resolveAudienceRecipients(String(broadcast.audienceKind));

  if (recipients.length === 0) {
    const failed = await prisma.emailBroadcast.update({
      where: { id },
      data: {
        status: 'FAILED' as any,
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        errorText: 'Audience has no recipients.',
        finishedAt: new Date(),
      },
    });
    return mapBroadcast(failed);
  }

  if (recipients.length > EMAIL_BROADCAST_MAX_RECIPIENTS) {
    const failed = await prisma.emailBroadcast.update({
      where: { id },
      data: {
        status: 'FAILED' as any,
        totalRecipients: recipients.length,
        sentCount: 0,
        failedCount: 0,
        errorText: `Audience has ${recipients.length} recipients. Limit is ${EMAIL_BROADCAST_MAX_RECIPIENTS}.`,
        finishedAt: new Date(),
      },
    });
    return mapBroadcast(failed);
  }

  await prisma.emailBroadcast.update({
    where: { id },
    data: {
      status: 'SENDING' as any,
      startedAt: new Date(),
      finishedAt: null,
      totalRecipients: recipients.length,
      sentCount: 0,
      failedCount: 0,
      errorText: null,
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (let index = 0; index < recipients.length; index += EMAIL_BROADCAST_CONCURRENCY) {
    const batch = recipients.slice(index, index + EMAIL_BROADCAST_CONCURRENCY);
    await Promise.all(batch.map(async (recipient) => {
      try {
        await sendPlatformEmail({
          to: recipient.email,
          subject: renderRecipientText(broadcast.subject, recipient),
          text: renderRecipientText(broadcast.textBody, recipient),
          html: renderRecipientText(broadcast.htmlBody, recipient),
          source: 'broadcast',
          toUserId: recipient.id,
          broadcastId: broadcast.id,
          templateId: broadcast.templateId,
        });
        sentCount += 1;
      } catch {
        failedCount += 1;
      }
    }));

    await prisma.emailBroadcast.update({
      where: { id },
      data: {
        sentCount,
        failedCount,
      },
    });
  }

  const finalStatus = sentCount > 0 && failedCount === 0
    ? 'SENT'
    : sentCount > 0
      ? 'PARTIAL'
      : 'FAILED';

  const finished = await prisma.emailBroadcast.update({
    where: { id },
    data: {
      status: finalStatus as any,
      sentCount,
      failedCount,
      finishedAt: new Date(),
      errorText: failedCount > 0 ? `${failedCount} recipient(s) failed.` : null,
    },
  });

  return mapBroadcast(finished);
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
