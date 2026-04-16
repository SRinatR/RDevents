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

// ─── Mock data generators ───────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// ─── Email overview ────────────────────────────────────────────────────────────

export async function getEmailOverview(): Promise<EmailOverview> {
  return {
    provider: 'resend',
    providerStatus: 'connected',
    sendingDomain: 'mail.rdevents.uz',
    sendingDomainStatus: 'verified',
    webhookStatus: 'active',
    webhookEndpoint: 'https://api.rdevents.uz/webhooks/email',
    sent24h: 142,
    delivered24h: 138,
    failed24h: 4,
    templatesCount: 8,
    automationsCount: 3,
    recentActivity: [
      { type: 'email_sent', status: 'delivered', timestamp: generateDate(0) },
      { type: 'email_delivered', status: 'delivered', timestamp: generateDate(0.1) },
      { type: 'email_opened', status: 'opened', timestamp: generateDate(0.2) },
      { type: 'email_clicked', status: 'clicked', timestamp: generateDate(0.5) },
      { type: 'email_bounced', status: 'bounced', timestamp: generateDate(1) },
    ],
  };
}

// ─── Email messages ─────────────────────────────────────────────────────────────

export async function listEmailMessages(
  _params: { search?: string; status?: string; source?: string; timeRange?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailMessage[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const messages: EmailMessage[] = [
    {
      id: generateId(),
      to: 'user1@example.com',
      subject: 'Подтверждение регистрации',
      status: 'delivered',
      source: 'verification',
      sentAt: generateDate(0),
      providerMessageId: 'msg_' + generateId(),
    },
    {
      id: generateId(),
      to: 'user2@example.com',
      subject: 'Приглашение на мероприятие',
      status: 'delivered',
      source: 'invitation',
      sentAt: generateDate(0.1),
      providerMessageId: 'msg_' + generateId(),
    },
    {
      id: generateId(),
      to: 'user3@example.com',
      subject: 'Напоминание о событии',
      status: 'sent',
      source: 'notification',
      sentAt: generateDate(0.5),
      providerMessageId: 'msg_' + generateId(),
    },
    {
      id: generateId(),
      to: 'user4@example.com',
      subject: 'Обновление статуса регистрации',
      status: 'delivered',
      source: 'notification',
      sentAt: generateDate(1),
      providerMessageId: 'msg_' + generateId(),
    },
    {
      id: generateId(),
      to: 'invalid@example',
      subject: 'Код подтверждения',
      status: 'failed',
      source: 'verification',
      sentAt: generateDate(2),
      providerMessageId: null,
    },
    {
      id: generateId(),
      to: 'test@example.com',
      subject: 'Тестовое сообщение',
      status: 'bounced',
      source: 'broadcast',
      sentAt: generateDate(3),
      providerMessageId: 'msg_' + generateId(),
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
      id: generateId(),
      name: 'Подтверждение email',
      key: 'email-verification',
      subject: 'Подтвердите ваш email адрес',
      status: 'active',
      updatedAt: generateDate(5),
    },
    {
      id: generateId(),
      name: 'Приглашение на событие',
      key: 'event-invitation',
      subject: 'Вас приглашают на мероприятие',
      status: 'active',
      updatedAt: generateDate(3),
    },
    {
      id: generateId(),
      name: 'Напоминание',
      key: 'event-reminder',
      subject: 'Напоминание о мероприятии завтра',
      status: 'active',
      updatedAt: generateDate(7),
    },
    {
      id: generateId(),
      name: 'Подтверждение регистрации',
      key: 'registration-confirmed',
      subject: 'Ваша регистрация подтверждена',
      status: 'draft',
      updatedAt: generateDate(10),
    },
    {
      id: generateId(),
      name: 'Сброс пароля',
      key: 'password-reset',
      subject: 'Сброс пароля',
      status: 'active',
      updatedAt: generateDate(2),
    },
    {
      id: generateId(),
      name: 'Обновление статуса',
      key: 'status-update',
      subject: 'Обновление статуса вашей заявки',
      status: 'archived',
      updatedAt: generateDate(30),
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
      id: generateId(),
      title: 'Анонс нового сезона мероприятий',
      audience: 'Все подписчики',
      status: 'sent',
      scheduledAt: generateDate(7),
      sentCount: 1250,
    },
    {
      id: generateId(),
      title: 'Напоминание о регистрациях',
      audience: 'Незавершённые регистрации',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      sentCount: 0,
    },
    {
      id: generateId(),
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
      id: generateId(),
      name: 'Добро пожаловать серии',
      trigger: 'user.created',
      status: 'active',
      lastRunAt: generateDate(0),
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
    },
    {
      id: generateId(),
      name: 'Напоминание за 24ч',
      trigger: 'event.starts_soon',
      status: 'active',
      lastRunAt: generateDate(1),
      nextRunAt: new Date(Date.now() + 7200000).toISOString(),
    },
    {
      id: generateId(),
      name: 'Сбор обратной связи',
      trigger: 'event.ended',
      status: 'paused',
      lastRunAt: generateDate(14),
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
      { id: generateId(), name: 'Активные участники', size: 1250, source: 'event_registration', updatedAt: generateDate(1) },
      { id: generateId(), name: 'Волонтёры', size: 340, source: 'volunteer_application', updatedAt: generateDate(3) },
      { id: generateId(), name: 'Новые пользователи', size: 180, source: 'user_created', updatedAt: generateDate(0) },
      { id: generateId(), name: 'Неактивные 30 дней', size: 520, source: 'inactivity_rule', updatedAt: generateDate(7) },
      { id: generateId(), name: 'Все подписчики', size: 2847, source: 'all_contacts', updatedAt: generateDate(0) },
    ],
  };
}

// ─── Email domains ─────────────────────────────────────────────────────────────

export async function listEmailDomains(
  _params: { search?: string; page?: number; limit?: number } = {}
): Promise<{ data: EmailDomain[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const domains: EmailDomain[] = [
    {
      id: generateId(),
      domain: 'mail.rdevents.uz',
      provider: 'resend',
      verificationStatus: 'verified',
      spf: true,
      dkim: true,
      dmarc: true,
      isDefault: true,
    },
    {
      id: generateId(),
      domain: 'newsletter.rdevents.uz',
      provider: 'resend',
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
    endpoint: 'https://api.rdevents.uz/webhooks/email',
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
        id: generateId(),
        eventType: 'email.delivered',
        providerEventId: 'evt_' + generateId(),
        receivedAt: generateDate(0),
        processingStatus: 'processed',
        relatedEntity: 'registration-123',
        errorMessage: null,
      },
      {
        id: generateId(),
        eventType: 'email.bounced',
        providerEventId: 'evt_' + generateId(),
        receivedAt: generateDate(1),
        processingStatus: 'processed',
        relatedEntity: 'user-456',
        errorMessage: null,
      },
      {
        id: generateId(),
        eventType: 'email.opened',
        providerEventId: 'evt_' + generateId(),
        receivedAt: generateDate(0.5),
        processingStatus: 'processed',
        relatedEntity: 'email-789',
        errorMessage: null,
      },
    ],
  };
}