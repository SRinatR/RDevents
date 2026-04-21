import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let resendClient: Resend | null = null;

function getResendClient() {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export async function sendRegistrationCodeEmail(input: {
  to: string;
  code: string;
  ttlMinutes: number;
}) {
  const client = getResendClient();
  if (!client) {
    throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  }
  if (!env.RESEND_FROM_EMAIL) {
    throw new Error('EMAIL_SENDER_NOT_CONFIGURED');
  }

  const from = formatFromAddress(env.RESEND_FROM_NAME, env.RESEND_FROM_EMAIL);
  const subject = 'Код подтверждения для RDEvents';
  const text = buildRegistrationCodeText(input.code, input.ttlMinutes);
  const html = buildRegistrationCodeHtml(input.code, input.ttlMinutes);

  await client.emails.send({
    from,
    to: [input.to],
    subject,
    text,
    html,
    ...(env.RESEND_REPLY_TO_EMAIL ? { replyTo: env.RESEND_REPLY_TO_EMAIL } : {}),
  });
}

export async function sendEventNotificationEmail(input: {
  to: string;
  subject: string;
  title: string;
  body: string[];
  actionUrl?: string | null;
  actionLabel?: string;
}) {
  const client = getResendClient();
  if (!client) {
    throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  }
  if (!env.RESEND_FROM_EMAIL) {
    throw new Error('EMAIL_SENDER_NOT_CONFIGURED');
  }

  const from = formatFromAddress(env.RESEND_FROM_NAME, env.RESEND_FROM_EMAIL);
  const text = buildNotificationText(input);
  const html = buildNotificationHtml(input);

  await client.emails.send({
    from,
    to: [input.to],
    subject: input.subject,
    text,
    html,
    ...(env.RESEND_REPLY_TO_EMAIL ? { replyTo: env.RESEND_REPLY_TO_EMAIL } : {}),
  });
}

export async function sendEventNotificationEmailSafe(
  input: Parameters<typeof sendEventNotificationEmail>[0],
  context: { userId?: string; eventId?: string; action?: string } = {},
) {
  try {
    await sendEventNotificationEmail(input);
  } catch (error) {
    logger.warn('Event notification email was not sent', {
      module: 'email',
      action: context.action ?? 'event_notification_email_failed',
      userId: context.userId,
      eventId: context.eventId,
      meta: {
        to: input.to,
        subject: input.subject,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function formatFromAddress(name: string, email: string) {
  return `${name} <${email}>`;
}

function buildRegistrationCodeText(code: string, ttlMinutes: number) {
  return [
    'RDEvents',
    '',
    'RU',
    `Ваш код подтверждения: ${code}`,
    `Код действует ${ttlMinutes} минут.`,
    'Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.',
    '',
    'EN',
    `Your verification code: ${code}`,
    `This code is valid for ${ttlMinutes} minutes.`,
    'If you did not request this registration, you can safely ignore this email.',
  ].join('\n');
}

function buildRegistrationCodeHtml(code: string, ttlMinutes: number) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 12px;">RDEvents</h2>
      <div style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 8px;">RU</h3>
        <p style="margin: 0 0 12px;">Ваш код подтверждения:</p>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 0 0 12px;">${code}</div>
        <p style="margin: 0 0 8px;">Код действует ${ttlMinutes} минут.</p>
        <p style="margin: 0;">Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.</p>
      </div>
      <div>
        <h3 style="margin-bottom: 8px;">EN</h3>
        <p style="margin: 0 0 12px;">Your verification code:</p>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 0 0 12px;">${code}</div>
        <p style="margin: 0 0 8px;">This code is valid for ${ttlMinutes} minutes.</p>
        <p style="margin: 0;">If you did not request this registration, you can safely ignore this email.</p>
      </div>
    </div>
  `;
}

function buildNotificationText(input: {
  title: string;
  body: string[];
  actionUrl?: string | null;
  actionLabel?: string;
}) {
  return [
    'RDEvents',
    '',
    input.title,
    '',
    ...input.body,
    ...(input.actionUrl ? ['', `${input.actionLabel ?? 'Открыть'}: ${input.actionUrl}`] : []),
  ].join('\n');
}

function buildNotificationHtml(input: {
  title: string;
  body: string[];
  actionUrl?: string | null;
  actionLabel?: string;
}) {
  const body = input.body.map(line => `<p style="margin: 0 0 10px;">${escapeHtml(line)}</p>`).join('');
  const action = input.actionUrl
    ? `<p style="margin: 18px 0 0;"><a href="${escapeHtml(input.actionUrl)}" style="display: inline-block; background: #1f58d8; color: #ffffff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 700;">${escapeHtml(input.actionLabel ?? 'Открыть')}</a></p>`
    : '';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">RDEvents</h2>
      <h3 style="margin: 0 0 12px;">${escapeHtml(input.title)}</h3>
      ${body}
      ${action}
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendPasswordResetEmail(input: {
  to: string;
  userName: string;
  resetUrl: string;
  expiresAt: string;
  ipHint?: string;
  supportContact?: string;
}) {
  const client = getResendClient();
  if (!client) {
    throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED');
  }
  if (!env.RESEND_FROM_EMAIL) {
    throw new Error('EMAIL_SENDER_NOT_CONFIGURED');
  }

  const from = formatFromAddress(env.RESEND_FROM_NAME, env.RESEND_FROM_EMAIL);
  const subject = 'Восстановление пароля / Password Reset — RDEvents';
  const text = buildPasswordResetText(input);
  const html = buildPasswordResetHtml(input);

  await client.emails.send({
    from,
    to: [input.to],
    subject,
    text,
    html,
    ...(env.RESEND_REPLY_TO_EMAIL ? { replyTo: env.RESEND_REPLY_TO_EMAIL } : {}),
  });
}

function buildPasswordResetText(input: {
  userName: string;
  resetUrl: string;
  expiresAt: string;
  ipHint?: string;
  supportContact?: string;
}) {
  const expiryDate = new Date(input.expiresAt);
  const expiryString = expiryDate.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    'RDEvents',
    '',
    'RU',
    `Здравствуйте, ${input.userName}!`,
    '',
    'Вы запросили восстановление пароля для вашего аккаунта RDEvents.',
    '',
    'Перейдите по ссылке, чтобы задать новый пароль:',
    input.resetUrl,
    '',
    `Ссылка действительна до ${expiryString}.`,
    '',
    'Если вы не запрашивали восстановление пароля, проигнорируйте это письмо. Ваш пароль не будет изменён.',
    ...(input.ipHint ? [`\nIP-адрес запроса: ${input.ipHint}`] : []),
    ...(input.supportContact ? [`\nСлужба поддержки: ${input.supportContact}`] : []),
    '',
    '─────────────────────',
    '',
    'EN',
    '',
    `Hello, ${input.userName}!`,
    '',
    'You requested a password reset for your RDEvents account.',
    '',
    'Click the link below to set a new password:',
    input.resetUrl,
    '',
    `This link is valid until ${expiryDate.toLocaleString('en-US', { timeZone: 'Europe/Moscow', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
    '',
    'If you did not request a password reset, ignore this email. Your password will not be changed.',
    ...(input.ipHint ? [`\nRequest IP address: ${input.ipHint}`] : []),
    ...(input.supportContact ? [`\nSupport: ${input.supportContact}`] : []),
  ].join('\n');
}

function buildPasswordResetHtml(input: {
  userName: string;
  resetUrl: string;
  expiresAt: string;
  ipHint?: string;
  supportContact?: string;
}) {
  const expiryDate = new Date(input.expiresAt);
  const expiryStringRu = expiryDate.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const expiryStringEn = expiryDate.toLocaleString('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const ipInfo = input.ipHint ? `<p style="margin: 8px 0 0; font-size: 13px; color: #666;">IP-адрес запроса / Request IP: ${escapeHtml(input.ipHint)}</p>` : '';
  const supportInfo = input.supportContact ? `<p style="margin: 8px 0 0; font-size: 13px; color: #666;">Служба поддержки / Support: ${escapeHtml(input.supportContact)}</p>` : '';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto;">
      <div style="background: #1f58d8; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px;">RDEvents</h1>
      </div>

      <div style="padding: 32px 24px; background: #ffffff;">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px; color: #1f58d8;">RU</h2>
          <p style="margin: 0 0 16px; font-size: 18px;">Здравствуйте, ${escapeHtml(input.userName)}!</p>
          <p style="margin: 0 0 16px;">Вы запросили восстановление пароля для вашего аккаунта RDEvents.</p>
          <p style="margin: 0 0 20px;">Перейдите по ссылке, чтобы задать новый пароль:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(input.resetUrl)}" style="display: inline-block; background: #1f58d8; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 16px;">Восстановить пароль</a>
          </div>
          <p style="margin: 0; font-size: 14px; color: #666;">Ссылка действительна до ${expiryStringRu}</p>
          ${ipInfo}
          ${supportInfo}
          <p style="margin: 16px 0 0; font-size: 14px; color: #666;">Если вы не запрашивали восстановление пароля, проигнорируйте это письмо. Ваш пароль не будет изменён.</p>
        </div>

        <div>
          <h2 style="margin: 0 0 8px; color: #1f58d8;">EN</h2>
          <p style="margin: 0 0 16px; font-size: 18px;">Hello, ${escapeHtml(input.userName)}!</p>
          <p style="margin: 0 0 16px;">You requested a password reset for your RDEvents account.</p>
          <p style="margin: 0 0 20px;">Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(input.resetUrl)}" style="display: inline-block; background: #1f58d8; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 16px;">Reset Password</a>
          </div>
          <p style="margin: 0; font-size: 14px; color: #666;">This link is valid until ${expiryStringEn}</p>
          <p style="margin: 16px 0 0; font-size: 14px; color: #666;">If you did not request a password reset, ignore this email. Your password will not be changed.</p>
        </div>
      </div>

      <div style="padding: 16px 24px; background: #f3f4f6; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #666;">© ${new Date().getFullYear()} RDEvents</p>
      </div>
    </div>
  `;
}
