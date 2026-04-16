import type {
  EmailOverview,
  EmailMessage,
  EmailTemplate,
  EmailBroadcast,
  EmailAutomation,
  EmailDomain,
  EmailAudienceData,
  EmailWebhooksData,
} from './admin-email.schemas.js';

// ─── Deterministic mock data (no Math.random()) ─────────────────────────────────

// Static base dates for consistent mock data
const BASE_DATE = new Date('2026-04-17T00:00:00Z');

function daysAgo(days: number): string {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function inFuture(hours: number): string {
  const d = new Date(BASE_DATE);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

// Static IDs based on index (deterministic)
const messageIds = ['msg_abc123def456', 'msg_ghi789jkl012', 'msg_mno345pqr678', 'msg_stu901vwx234', 'msg_yza567bcd890', 'msg_efg123hij456'];
const templateIds = ['tpl_verification001', 'tpl_invitation002', 'tpl_reminder003', 'tpl_confirmed004', 'tpl_password005', 'tpl_status006'];
const broadcastIds = ['brd_season2026q1', 'brd_registration_rem', 'brd_event_summary'];
const automationIds = ['aut_welcome_series', 'aut_24h_reminder', 'aut_feedback'];
const domainIds = ['dom_mail_primary', 'dom_newsletter'];
const segmentIds = ['seg_active_participants', 'seg_volunteers', 'seg_new_users', 'seg_inactive30d', 'seg_all'];
const webhookIds = ['wh_delivered001', 'wh_bounced002', 'wh_opened003'];

// ─── Email overview ───────────────────────────────────────────────────────────

export async function getEmailOverview(): Promise<EmailOverview> {
  return {
    provider: process.env['EMAIL_PROVIDER'] ?? 'resend',
    providerStatus: 'connected',
    sendingDomain: process.env['EMAIL_SENDING_DOMAIN'] ?? 'mail.rdevents.uz',
    sendingDomainStatus: 'verified',
    webhookStatus: 'active',
    webhookEndpoint: process.env['EMAIL_WEBHOOK_ENDPOINT'] ?? 'https://api.rdevents.uz/webhooks/email',
    sent24h: 142,
    delivered24h: 138,
    failed24h: 4,
    templatesCount: 6,
    automationsCount: 3,
    recentActivity: [
      { type: 'email_sent', status: 'delivered', timestamp: daysAgo(0) },
      { type: 'email_delivered', status: 'delivered', timestamp: daysAgo(0.04) },
      { type: 'email_opened', status: 'opened', timestamp: daysAgo(0.08) },
      { type: 'email_clicked', status: 'clicked', timestamp: daysAgo(0.2) },
      { type: 'email_bounced', status: 'bounced', timestamp: daysAgo(1) },
    ],
  };
}

// ─── Email messages ─────────────────────────────────────────────────────────────

export async function listEmailMessages(
  _params: { search?: string; status?: string; source?: string; timeRange?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailMessage[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const messages: EmailMessage[] = [
    {
      id: messageIds[0],
      to: 'user1@example.com',
      subject: 'Подтверждение регистрации',
      status: 'delivered',
      source: 'verification',
      sentAt: daysAgo(0),
      providerMessageId: 'resend_' + messageIds[0],
    },
    {
      id: messageIds[1],
      to: 'user2@example.com',
      subject: 'Приглашение на мероприятие',
      status: 'delivered',
      source: 'invitation',
      sentAt: daysAgo(0.1),
      providerMessageId: 'resend_' + messageIds[1],
    },
    {
      id: messageIds[2],
      to: 'user3@example.com',
      subject: 'Напоминание о событии',
      status: 'sent',
      source: 'notification',
      sentAt: daysAgo(0.5),
      providerMessageId: 'resend_' + messageIds[2],
    },
    {
      id: messageIds[3],
      to: 'user4@example.com',
      subject: 'Обновление статуса регистрации',
      status: 'delivered',
      source: 'notification',
      sentAt: daysAgo(1),
      providerMessageId: 'resend_' + messageIds[3],
    },
    {
      id: messageIds[4],
      to: 'invalid@example',
      subject: 'Код подтверждения',
      status: 'failed',
      source: 'verification',
      sentAt: daysAgo(2),
      providerMessageId: null,
    },
    {
      id: messageIds[5],
      to: 'test@example.com',
      subject: 'Тестовое сообщение',
      status: 'bounced',
      source: 'broadcast',
      sentAt: daysAgo(3),
      providerMessageId: 'resend_' + messageIds[5],
    },
  ];

  return {
    data: messages,
    meta: { total: messages.length, page: 1, limit: 50, pages: 1 },
  };
}

// ─── Email templates ───────────────────────────────────────────────────────────

export async function listEmailTemplates(
  _params: { search?: string; status?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailTemplate[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const templates: EmailTemplate[] = [
    {
      id: templateIds[0],
      name: 'Подтверждение email',
      key: 'email-verification',
      subject: 'Подтвердите ваш email адрес',
      status: 'active',
      updatedAt: daysAgo(5),
    },
    {
      id: templateIds[1],
      name: 'Приглашение на событие',
      key: 'event-invitation',
      subject: 'Вас приглашают на мероприятие',
      status: 'active',
      updatedAt: daysAgo(3),
    },
    {
      id: templateIds[2],
      name: 'Напоминание',
      key: 'event-reminder',
      subject: 'Напоминание о мероприятии завтра',
      status: 'active',
      updatedAt: daysAgo(7),
    },
    {
      id: templateIds[3],
      name: 'Подтверждение регистрации',
      key: 'registration-confirmed',
      subject: 'Ваша регистрация подтверждена',
      status: 'draft',
      updatedAt: daysAgo(10),
    },
    {
      id: templateIds[4],
      name: 'Сброс пароля',
      key: 'password-reset',
      subject: 'Сброс пароля',
      status: 'active',
      updatedAt: daysAgo(2),
    },
    {
      id: templateIds[5],
      name: 'Обновление статуса',
      key: 'status-update',
      subject: 'Обновление статуса вашей заявки',
      status: 'archived',
      updatedAt: daysAgo(30),
    },
  ];

  return {
    data: templates,
    meta: { total: templates.length, page: 1, limit: 20, pages: 1 },
  };
}

// ─── Email broadcasts ───────────────────────────────────────────────────────────

export async function listEmailBroadcasts(
  _params: { status?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailBroadcast[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const broadcasts: EmailBroadcast[] = [
    {
      id: broadcastIds[0],
      title: 'Анонс нового сезона мероприятий',
      audience: 'Все подписчики',
      status: 'sent',
      scheduledAt: daysAgo(7),
      sentCount: 1250,
    },
    {
      id: broadcastIds[1],
      title: 'Напоминание о регистрациях',
      audience: 'Незавершённые регистрации',
      status: 'scheduled',
      scheduledAt: inFuture(24),
      sentCount: 0,
    },
    {
      id: broadcastIds[2],
      title: 'Итоги мероприятия',
      audience: 'Участники события',
      status: 'draft',
      scheduledAt: null,
      sentCount: 0,
    },
  ];

  return {
    data: broadcasts,
    meta: { total: broadcasts.length, page: 1, limit: 20, pages: 1 },
  };
}

// ─── Email automations ─────────────────────────────────────────────────────────

export async function listEmailAutomations(
  _params: { status?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailAutomation[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const automations: EmailAutomation[] = [
    {
      id: automationIds[0],
      name: 'Добро пожаловать серии',
      trigger: 'user.created',
      status: 'active',
      lastRunAt: daysAgo(0),
      nextRunAt: inFuture(1),
    },
    {
      id: automationIds[1],
      name: 'Напоминание за 24ч',
      trigger: 'event.starts_soon',
      status: 'active',
      lastRunAt: daysAgo(1),
      nextRunAt: inFuture(2),
    },
    {
      id: automationIds[2],
      name: 'Сбор обратной связи',
      trigger: 'event.ended',
      status: 'paused',
      lastRunAt: daysAgo(14),
      nextRunAt: null,
    },
  ];

  return {
    data: automations,
    meta: { total: automations.length, page: 1, limit: 20, pages: 1 },
  };
}

// ─── Email audience ─────────────────────────────────────────────────────────────

export async function getEmailAudience(): Promise<EmailAudienceData> {
  return {
    totalContacts: 2847,
    verifiedContacts: 2654,
    unsubscribed: 42,
    segmentsCount: 5,
    segments: [
      { id: segmentIds[0], name: 'Активные участники', size: 1250, source: 'event_registration', updatedAt: daysAgo(1) },
      { id: segmentIds[1], name: 'Волонтёры', size: 340, source: 'volunteer_application', updatedAt: daysAgo(3) },
      { id: segmentIds[2], name: 'Новые пользователи', size: 180, source: 'user_created', updatedAt: daysAgo(0) },
      { id: segmentIds[3], name: 'Неактивные 30 дней', size: 520, source: 'inactivity_rule', updatedAt: daysAgo(7) },
      { id: segmentIds[4], name: 'Все подписчики', size: 2847, source: 'all_contacts', updatedAt: daysAgo(0) },
    ],
  };
}

// ─── Email domains ─────────────────────────────────────────────────────────────

export async function listEmailDomains(
  _params: { search?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailDomain[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const domains: EmailDomain[] = [
    {
      id: domainIds[0],
      domain: process.env['EMAIL_SENDING_DOMAIN'] ?? 'mail.rdevents.uz',
      provider: process.env['EMAIL_PROVIDER'] ?? 'resend',
      verificationStatus: 'verified',
      spf: true,
      dkim: true,
      dmarc: true,
      isDefault: true,
    },
    {
      id: domainIds[1],
      domain: 'newsletter.rdevents.uz',
      provider: process.env['EMAIL_PROVIDER'] ?? 'resend',
      verificationStatus: 'pending',
      spf: true,
      dkim: false,
      dmarc: false,
      isDefault: false,
    },
  ];

  return {
    data: domains,
    meta: { total: domains.length, page: 1, limit: 20, pages: 1 },
  };
}

// ─── Email webhooks ─────────────────────────────────────────────────────────────

export async function getEmailWebhooks(): Promise<EmailWebhooksData> {
  return {
    endpoint: process.env['EMAIL_WEBHOOK_ENDPOINT'] ?? 'https://api.rdevents.uz/webhooks/email',
    signatureStatus: 'valid',
    subscribedEvents: [
      'email.sent',
      'email.delivered',
      'email.bounced',
      'email.complained',
      'email.opened',
      'email.clicked',
    ],
    totalReceived: 15847,
    totalSuccess: 15230,
    totalFailed: 617,
    logs: [
      {
        id: webhookIds[0],
        eventType: 'email.delivered',
        providerEventId: 'evt_' + webhookIds[0],
        receivedAt: daysAgo(0),
        processingStatus: 'processed',
        relatedEntity: 'registration-123',
        errorMessage: null,
      },
      {
        id: webhookIds[1],
        eventType: 'email.bounced',
        providerEventId: 'evt_' + webhookIds[1],
        receivedAt: daysAgo(1),
        processingStatus: 'processed',
        relatedEntity: 'user-456',
        errorMessage: null,
      },
      {
        id: webhookIds[2],
        eventType: 'email.opened',
        providerEventId: 'evt_' + webhookIds[2],
        receivedAt: daysAgo(0.5),
        processingStatus: 'processed',
        relatedEntity: 'email-789',
        errorMessage: null,
      },
    ],
  };
}
