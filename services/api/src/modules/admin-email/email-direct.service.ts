import { prisma } from '../../db/prisma.js';
import { sendPlatformEmail } from '../../common/email.js';

export type DirectEmailInput = {
  actorUserId: string;
  eventId?: string | null;
  selectedUserIds: string[];
  excludedUserIds?: string[];
  subject: string;
  preheader?: string | null;
  text?: string | null;
  html?: string | null;
  emailType: 'ADMIN_DIRECT' | 'SYSTEM_NOTIFICATION' | 'MARKETING';
  reason: string;
  respectConsent: boolean;
};

export type RecipientPreview = {
  userId: string;
  email: string;
  name: string;
  status: 'READY' | 'SKIPPED_NO_CONSENT' | 'SKIPPED_NO_EMAIL' | 'SKIPPED_EMAIL_NOT_VERIFIED' | 'SKIPPED_EXCLUDED' | 'SKIPPED_USER_NOT_FOUND';
  reason?: string;
};

export type PreviewManualRecipientsResult = {
  totalSelected: number;
  willSend: number;
  willSkip: number;
  recipients: Array<{
    userId: string;
    email: string;
    name: string;
    status: 'READY';
  }>;
  skipped: Array<RecipientPreview>;
};

export type SendDirectEmailResult = {
  status: 'QUEUED' | 'SENT' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  totalSelected: number;
  sent: number;
  skipped: number;
  messages: Array<{
    userId: string;
    email: string;
    messageId: string | null;
    providerMessageId: string | null;
    status: 'PENDING' | 'SENT' | 'FAILED';
    failureReason?: string | null;
  }>;
  skippedRecipients: Array<RecipientPreview>;
};

const DIRECT_EMAIL_MAX_RECIPIENTS = Math.max(
  1,
  Number(process.env['DIRECT_EMAIL_MAX_RECIPIENTS'] ?? 500) || 500,
);

function assertDirectEmailInput(input: DirectEmailInput): void {
  if (!input.selectedUserIds.length) {
    throw new Error('RECIPIENTS_REQUIRED');
  }

  if (!input.subject.trim()) {
    throw new Error('SUBJECT_REQUIRED');
  }

  if (!input.text?.trim() && !input.html?.trim()) {
    throw new Error('EMAIL_CONTENT_REQUIRED');
  }

  if (!input.reason.trim()) {
    throw new Error('REASON_REQUIRED');
  }

  if (input.selectedUserIds.length > DIRECT_EMAIL_MAX_RECIPIENTS) {
    throw new Error('TOO_MANY_RECIPIENTS');
  }
}

function renderUserTemplate(
  template: string,
  recipient: { name?: string | null; email: string }
): string {
  return template
    .replaceAll('{{user.name}}', recipient.name || recipient.email)
    .replaceAll('{{user.email}}', recipient.email);
}

export async function previewManualRecipients(input: {
  selectedUserIds: string[];
  excludedUserIds?: string[];
  emailType: string;
  respectConsent: boolean;
  eventId?: string | null;
}): Promise<PreviewManualRecipientsResult> {
  const selectedIds = [...new Set(input.selectedUserIds)];
  const excludedIds = new Set(input.excludedUserIds ?? []);

  const users = await prisma.user.findMany({
    where: {
      id: { in: selectedIds },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      extendedProfile: {
        select: {
          consentMailing: true,
        },
      },
    },
  });

  const byId = new Map(users.map(user => [user.id, user]));

  const recipients: Array<{ userId: string; email: string; name: string; status: 'READY' }> = [];
  const skipped: RecipientPreview[] = [];

  for (const userId of selectedIds) {
    if (userId.startsWith('prefill-')) {
      skipped.push({
        userId,
        email: '',
        name: '',
        status: 'SKIPPED_USER_NOT_FOUND',
        reason: 'Получатель передан без реального User ID. Найдите пользователя через поиск и выберите его из списка.',
      });
      continue;
    }

    if (excludedIds.has(userId)) {
      skipped.push({
        userId,
        email: '',
        name: '',
        status: 'SKIPPED_EXCLUDED',
        reason: 'Пользователь исключён вручную',
      });
      continue;
    }

    const user = byId.get(userId);

    if (!user) {
      skipped.push({
        userId,
        email: '',
        name: '',
        status: 'SKIPPED_USER_NOT_FOUND',
        reason: 'Пользователь не найден или отключён',
      });
      continue;
    }

    if (!user.email) {
      skipped.push({
        userId,
        email: user.email ?? '',
        name: user.name ?? '',
        status: 'SKIPPED_NO_EMAIL',
        reason: 'Нет email',
      });
      continue;
    }

    if (!user.emailVerifiedAt && input.emailType !== 'ADMIN_DIRECT') {
      skipped.push({
        userId,
        email: user.email,
        name: user.name ?? '',
        status: 'SKIPPED_EMAIL_NOT_VERIFIED',
        reason: 'Email не подтверждён',
      });
      continue;
    }

    if (input.respectConsent && !user.extendedProfile?.consentMailing) {
      skipped.push({
        userId,
        email: user.email,
        name: user.name ?? '',
        status: 'SKIPPED_NO_CONSENT',
        reason: 'Нет согласия на рассылку',
      });
      continue;
    }

    recipients.push({
      userId: user.id,
      email: user.email,
      name: user.name ?? '',
      status: 'READY',
    });
  }

  return {
    totalSelected: selectedIds.length,
    willSend: recipients.length,
    willSkip: skipped.length,
    recipients,
    skipped,
  };
}

export async function sendDirectEmailToUsers(input: DirectEmailInput): Promise<SendDirectEmailResult> {
  assertDirectEmailInput(input);

  const { recipients, skipped } = await previewManualRecipients({
    selectedUserIds: input.selectedUserIds,
    excludedUserIds: input.excludedUserIds ?? [],
    emailType: input.emailType,
    respectConsent: input.respectConsent,
    eventId: input.eventId,
  });

  const messages: Array<{
    userId: string;
    email: string;
    messageId: string | null;
    providerMessageId: string | null;
    status: 'PENDING' | 'SENT' | 'FAILED';
    failureReason?: string | null;
  }> = [];

  for (const recipient of recipients) {
    const personalizedText = input.text ? renderUserTemplate(input.text, recipient) : undefined;
    const personalizedHtml = input.html ? renderUserTemplate(input.html, recipient) : undefined;

    try {
      const result = await sendPlatformEmail({
        to: recipient.email,
        toUserId: recipient.userId,
        subject: input.subject,
        text: personalizedText,
        html: personalizedHtml,
        source: 'admin_direct',
      });

      messages.push({
        userId: recipient.userId,
        email: recipient.email,
        messageId: result.messageId,
        providerMessageId: result.providerMessageId,
        status: result.messageId ? 'SENT' : 'PENDING',
        failureReason: null,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      messages.push({
        userId: recipient.userId,
        email: recipient.email,
        messageId: null,
        providerMessageId: null,
        status: 'FAILED',
        failureReason: reason,
      });
    }
  }

  const sentCount = messages.filter(m => m.status === 'SENT').length;
  const pendingCount = messages.filter(m => m.status === 'PENDING').length;
  const deliveredOrQueuedCount = sentCount + pendingCount;
  const status: SendDirectEmailResult['status'] = messages.length === 0
    ? 'SKIPPED'
    : sentCount === messages.length && skipped.length === 0
      ? 'SENT'
      : pendingCount === messages.length && skipped.length === 0
        ? 'QUEUED'
      : deliveredOrQueuedCount > 0
        ? 'PARTIAL'
        : 'FAILED';

  return {
    status,
    totalSelected: input.selectedUserIds.length,
    sent: deliveredOrQueuedCount,
    skipped: skipped.length,
    messages,
    skippedRecipients: skipped,
  };
}
