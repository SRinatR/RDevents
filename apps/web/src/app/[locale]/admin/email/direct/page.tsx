'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, adminApi, adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { UserRecipientPicker, type SelectedUser } from '@/components/admin/email/UserRecipientPicker';
import { FieldInput, FieldTextarea, LoadingLines, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

type EmailType = 'ADMIN_DIRECT' | 'SYSTEM_NOTIFICATION' | 'MARKETING';

type DirectEmailForm = {
  selectedUsers: SelectedUser[];
  subject: string;
  preheader: string;
  text: string;
  html: string;
  emailType: EmailType;
  reason: string;
  respectConsent: boolean;
};

const emptyForm: DirectEmailForm = {
  selectedUsers: [],
  subject: '',
  preheader: '',
  text: [
    'Здравствуйте, {{user.name}}!',
    '',
    'Текст письма.',
  ].join('\n'),
  html: [
    '<p>Здравствуйте, {{user.name}}!</p>',
    '<p>Текст письма.</p>',
  ].join('\n'),
  emailType: 'ADMIN_DIRECT',
  reason: '',
  respectConsent: false,
};

type PreviewResult = {
  totalSelected: number;
  willSend: number;
  willSkip: number;
  recipients: Array<{ userId: string; email: string; name: string; status: string }>;
  skipped: Array<{ userId: string; email: string; name: string; status: string; reason?: string }>;
};

type SendResult = {
  status: string;
  sent: number;
  skipped: number;
  messages: Array<{ email: string; status: string; failureReason?: string | null }>;
  skippedRecipients: Array<{ userId: string; email: string; name: string; status: string; reason?: string }>;
};

function getEmailErrorMessage(error: unknown, locale: string) {
  const code = error instanceof ApiError ? error.code : undefined;
  const fallback = locale === 'ru' ? 'Не удалось выполнить действие.' : 'Action failed.';
  const messages: Record<string, { ru: string; en: string }> = {
    EMAIL_DELIVERY_NOT_CONFIGURED: {
      ru: 'Email-провайдер не настроен. Проверьте RESEND_API_KEY.',
      en: 'Email provider is not configured. Check RESEND_API_KEY.',
    },
    EMAIL_SENDER_NOT_CONFIGURED: {
      ru: 'Отправитель не настроен. Проверьте RESEND_FROM_EMAIL.',
      en: 'Sender is not configured. Check RESEND_FROM_EMAIL.',
    },
    EMAIL_REQUIRED: {
      ru: 'Укажите email получателя.',
      en: 'Enter recipient email.',
    },
    EMAIL_CONTENT_REQUIRED: {
      ru: 'Заполните текст или HTML письма.',
      en: 'Fill text or HTML body.',
    },
  };

  if (code && messages[code]) return messages[code][locale === 'ru' ? 'ru' : 'en'];
  return error instanceof Error ? error.message : fallback;
}

function getEmailFailureReason(reason: string | null | undefined, locale: string) {
  const messages: Record<string, { ru: string; en: string }> = {
    EMAIL_DELIVERY_NOT_CONFIGURED: {
      ru: 'Email-провайдер не настроен',
      en: 'Email provider is not configured',
    },
    EMAIL_SENDER_NOT_CONFIGURED: {
      ru: 'Отправитель не настроен',
      en: 'Sender is not configured',
    },
    EMAIL_CONTENT_REQUIRED: {
      ru: 'Нет текста письма',
      en: 'Email body is empty',
    },
  };
  const key = String(reason ?? '').trim();
  return messages[key]?.[locale === 'ru' ? 'ru' : 'en'] ?? key;
}

export default function DirectEmailPage() {
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<DirectEmailForm>(emptyForm);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const prefillEmail = searchParams.get('to');
  const prefillName = searchParams.get('name');

  useEffect(() => {
    let alive = true;

    adminEmailApi.getOverview()
      .then((data) => {
        if (alive) setOverview(data);
      })
      .catch(() => {
        if (alive) setOverview(null);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const hydratePrefillRecipient = async () => {
      if (!prefillEmail) return;
      const decodedEmail = decodeURIComponent(prefillEmail).trim();
      const decodedName = prefillName ? decodeURIComponent(prefillName).trim() : null;
      if (!decodedEmail) return;

      try {
        const result = await adminApi.searchUsers({ q: decodedEmail, limit: 5 });
        const exactMatch = result.users.find((user) => user.email?.toLowerCase() === decodedEmail.toLowerCase());

        if (exactMatch) {
          const recipient: SelectedUser = {
            id: exactMatch.id,
            email: exactMatch.email,
            name: exactMatch.name ?? decodedName,
            phone: exactMatch.phone ?? null,
          };
          setForm(prev => ({ ...prev, selectedUsers: [recipient] }));
          setError(null);
          return;
        }

        setError(locale === 'ru'
          ? 'Пользователь с этим email не найден. Найдите его через поиск получателей.'
          : 'User with this email was not found. Search and select the recipient manually.');
      } catch {
        setError(locale === 'ru'
          ? 'Пользователь с этим email не найден. Найдите его через поиск получателей.'
          : 'User with this email was not found. Search and select the recipient manually.');
      }
    };

    void hydratePrefillRecipient();
  }, [prefillEmail, prefillName, locale]);

  const updateForm = useCallback((updates: Partial<DirectEmailForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
    setPreview(null);
  }, []);

  const loadPreview = useCallback(async () => {
    if (form.selectedUsers.length === 0) {
      setPreview(null);
      return;
    }

    setLoadingPreview(true);
    setError(null);

    try {
      const result = await adminEmailApi.previewManualRecipients({
        selectedUserIds: form.selectedUsers.map(u => u.id),
        excludedUserIds: [],
        emailType: form.emailType,
        respectConsent: form.respectConsent,
      });
      setPreview(result);
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить предпросмотр.' : 'Failed to load preview.');
    } finally {
      setLoadingPreview(false);
    }
  }, [form.selectedUsers, form.emailType, form.respectConsent, locale]);

  const validate = useCallback((): string | null => {
    if (form.selectedUsers.length === 0) {
      return locale === 'ru' ? 'Выберите хотя бы одного получателя.' : 'Select at least one recipient.';
    }

    if (!form.subject.trim()) {
      return locale === 'ru' ? 'Укажите тему письма.' : 'Enter email subject.';
    }

    if (!form.text.trim() && !form.html.trim()) {
      return locale === 'ru' ? 'Заполните текст или HTML письма.' : 'Fill text or HTML body.';
    }

    if (!form.reason.trim()) {
      return locale === 'ru' ? 'Укажите причину отправки.' : 'Enter reason for sending.';
    }

    if (form.respectConsent && preview && preview.willSend === 0) {
      return locale === 'ru' ? 'Нет получателей с согласием на рассылку.' : 'No recipients with mailing consent.';
    }

    if (preview && preview.willSend === 0) {
      return locale === 'ru' ? 'Нет готовых получателей для отправки.' : 'No ready recipients to send.';
    }

    return null;
  }, [form, preview, locale]);

  const handleSend = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSending(true);
    setError(null);

    try {
      const result = await adminEmailApi.sendDirectEmail({
        selectedUserIds: form.selectedUsers.map(u => u.id),
        excludedUserIds: [],
        subject: form.subject.trim(),
        preheader: form.preheader.trim() || undefined,
        text: form.text || undefined,
        html: form.html || undefined,
        emailType: form.emailType,
        reason: form.reason.trim(),
        respectConsent: form.respectConsent,
      });

      setSent(true);
      setSendResult({
        status: result.status,
        sent: result.sent,
        skipped: result.skipped,
        messages: result.messages.map(m => ({
          email: m.email,
          status: m.status,
          failureReason: m.failureReason ?? null,
        })),
        skippedRecipients: result.skippedRecipients ?? [],
      });
    } catch (e) {
      setError(getEmailErrorMessage(e, locale));
    } finally {
      setSending(false);
    }
  }, [form, validate, locale]);

  const readyToSendCount = preview?.willSend ?? form.selectedUsers.length;
  const sendDisabled = sending || form.selectedUsers.length === 0 || (preview?.willSend === 0);
  const providerNotice = overview?.provider === 'log-only'
    ? (locale === 'ru'
        ? 'Локальный режим: письма не уходят наружу, но сохраняются в истории как отправленные.'
        : 'Local mode: emails are not delivered externally, but are stored in history as sent.')
    : overview && overview.providerStatus !== 'connected'
      ? (locale === 'ru'
          ? 'Email-провайдер не настроен. Отправка завершится ошибкой, пока не заданы RESEND_API_KEY и RESEND_FROM_EMAIL.'
          : 'Email provider is not configured. Sending will fail until RESEND_API_KEY and RESEND_FROM_EMAIL are set.')
      : null;

  const contentPreview = useMemo(() => {
    const text = form.text.trim();
    const html = form.html.trim();
    return {
      subject: form.subject.trim() || (locale === 'ru' ? 'Без темы' : 'No subject'),
      preheader: form.preheader.trim(),
      body: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    };
  }, [form.subject, form.preheader, form.text, form.html, locale]);

  if (sent && sendResult) {
    const resultTone = sendResult.status === 'FAILED' || sendResult.status === 'SKIPPED'
      ? 'danger'
      : sendResult.status === 'PARTIAL'
        ? 'warning'
        : 'success';
    const resultText = locale === 'ru'
      ? sendResult.status === 'FAILED'
        ? 'Письмо не отправлено. Проверьте ошибки ниже.'
        : sendResult.status === 'SKIPPED'
          ? `Отправка не выполнена: все выбранные получатели пропущены (${sendResult.skipped}).`
          : `Письмо отправлено ${sendResult.sent} получателям${sendResult.skipped > 0 ? `, пропущено ${sendResult.skipped}` : ''}.`
      : sendResult.status === 'FAILED'
        ? 'Email was not sent. Check errors below.'
        : sendResult.status === 'SKIPPED'
          ? `Email was not sent: all selected recipients were skipped (${sendResult.skipped}).`
          : `Email sent to ${sendResult.sent} recipient(s)${sendResult.skipped > 0 ? `, ${sendResult.skipped} skipped` : ''}.`;

    return (
      <div className="signal-page-shell">
        <AdminPageHeader
          title={resultTone === 'success'
            ? (locale === 'ru' ? 'Письмо отправлено' : 'Email sent')
            : (locale === 'ru' ? 'Результат отправки' : 'Send result')}
        />

        <Panel variant="elevated" className="admin-command-panel">
          <div className="space-y-4">
            <Notice tone={resultTone}>{resultText}</Notice>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {locale === 'ru' ? 'Статус отправки' : 'Delivery status'}
              </h3>
              <div className="space-y-1">
                {sendResult.messages.map((msg, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[300px]">{msg.email}</span>
                    <StatusBadge
                      tone={msg.status === 'SENT' || msg.status === 'PENDING' ? 'success' : 'danger'}
                    >
                      {msg.status}
                    </StatusBadge>
                    {msg.failureReason ? (
                      <span className="text-xs text-red-600">{getEmailFailureReason(msg.failureReason, locale)}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {sendResult.skippedRecipients.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {locale === 'ru' ? 'Пропущенные получатели' : 'Skipped recipients'}
                </h3>
                <div className="space-y-1">
                  {sendResult.skippedRecipients.map((recipient) => (
                    <div key={recipient.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[300px]">{recipient.name || recipient.email || recipient.userId}</span>
                      <StatusBadge tone="warning">{recipient.status.replace('SKIPPED_', '')}</StatusBadge>
                      {recipient.reason ? (
                        <span className="text-xs text-yellow-700">{recipient.reason}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 pt-4">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSent(false);
                  setSendResult(null);
                  setForm(emptyForm);
                }}
              >
                {locale === 'ru' ? 'Отправить ещё' : 'Send another'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => router.push(`/${locale}/admin/email/messages`)}
              >
                {locale === 'ru' ? 'К истории сообщений' : 'View message history'}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="signal-page-shell">
      <AdminPageHeader
        title={locale === 'ru' ? 'Прямое письмо' : 'Direct email'}
        subtitle={locale === 'ru' ? 'Отправка email конкретным пользователям' : 'Send email to specific users'}
      />

      {providerNotice ? (
        <Notice tone={overview?.provider === 'log-only' ? 'warning' : 'danger'}>{providerNotice}</Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Panel variant="elevated" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Получатели' : 'Recipients'}</h2>
            <p className="signal-muted" style={{ marginTop: 4, marginBottom: 12 }}>
              {locale === 'ru'
                ? 'Найдите пользователя, выберите получателя и обновите предпросмотр перед отправкой.'
                : 'Search for users, select recipients, then refresh the preview before sending.'}
            </p>

            <UserRecipientPicker
              selectedUsers={form.selectedUsers}
              onChange={(users) => updateForm({ selectedUsers: users })}
            />
          </Panel>

          <Panel variant="elevated" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Письмо' : 'Email'}</h2>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  {locale === 'ru' ? 'Тип письма' : 'Email type'}
                </span>
                <select
                  value={form.emailType}
                  onChange={(e) => updateForm({ emailType: e.target.value as EmailType })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ADMIN_DIRECT">
                    {locale === 'ru' ? 'Прямое письмо администратора' : 'Admin direct'}
                  </option>
                  <option value="SYSTEM_NOTIFICATION">
                    {locale === 'ru' ? 'Системное уведомление' : 'System notification'}
                  </option>
                  <option value="MARKETING">
                    {locale === 'ru' ? 'Маркетинговое' : 'Marketing'}
                  </option>
                </select>
              </label>

              {form.emailType !== 'ADMIN_DIRECT' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.respectConsent}
                    onChange={(e) => updateForm({ respectConsent: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {locale === 'ru' ? 'Учитывать согласие на рассылку' : 'Respect mailing consent'}
                  </span>
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  {locale === 'ru' ? 'Тема письма' : 'Subject'} *
                </span>
                <FieldInput
                  value={form.subject}
                  onChange={(e) => updateForm({ subject: e.target.value })}
                  placeholder={locale === 'ru' ? 'Тема письма' : 'Email subject'}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  {locale === 'ru' ? 'Preheader' : 'Preheader'}
                </span>
                <FieldInput
                  value={form.preheader}
                  onChange={(e) => updateForm({ preheader: e.target.value })}
                  placeholder={locale === 'ru' ? 'Краткое описание (необязательно)' : 'Brief description (optional)'}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  {locale === 'ru' ? 'Текст письма' : 'Text body'}
                </span>
                <FieldTextarea
                  value={form.text}
                  onChange={(e) => updateForm({ text: e.target.value })}
                  rows={8}
                  placeholder={locale === 'ru' ? 'Текст письма...' : 'Email text...'}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {locale === 'ru' ? 'Доступные переменные:' : 'Available variables:'} {'{{user.name}}'}, {'{{user.email}}'}
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  {locale === 'ru' ? 'HTML версия' : 'HTML version'} ({locale === 'ru' ? 'необязательно' : 'optional'})
                </span>
                <FieldTextarea
                  value={form.html}
                  onChange={(e) => updateForm({ html: e.target.value })}
                  rows={8}
                  placeholder={locale === 'ru' ? '<p>HTML код...</p>' : '<p>HTML code...</p>'}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  {locale === 'ru' ? 'Причина отправки' : 'Reason for sending'} *
                </span>
                <FieldTextarea
                  value={form.reason}
                  onChange={(e) => updateForm({ reason: e.target.value })}
                  rows={3}
                  placeholder={
                    locale === 'ru'
                      ? 'Например: Информирование участников о изменении расписания'
                      : 'e.g. Informing participants about schedule changes'
                  }
                />
              </label>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel variant="elevated" className="admin-command-panel">
            <div className="flex items-center justify-between mb-4">
              <h2>{locale === 'ru' ? 'Предпросмотр' : 'Preview'}</h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => void loadPreview()}
                disabled={form.selectedUsers.length === 0 || loadingPreview}
              >
                {locale === 'ru' ? 'Обновить' : 'Refresh'}
              </button>
            </div>

            {loadingPreview && (
              <div className="py-8">
                <LoadingLines />
              </div>
            )}

            {!loadingPreview && preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{preview.totalSelected}</div>
                    <div className="text-xs text-gray-500">
                      {locale === 'ru' ? 'Выбрано' : 'Selected'}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{preview.willSend}</div>
                    <div className="text-xs text-gray-500">
                      {locale === 'ru' ? 'Будет отправлено' : 'Will send'}
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{preview.willSkip}</div>
                    <div className="text-xs text-gray-500">
                      {locale === 'ru' ? 'Пропущено' : 'Skipped'}
                    </div>
                  </div>
                </div>

                {preview.skipped.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {locale === 'ru' ? 'Пропущенные получатели' : 'Skipped recipients'}
                    </h3>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {preview.skipped.map((s) => (
                        <div key={s.userId} className="flex items-start justify-between text-sm bg-yellow-50 px-3 py-2 rounded">
                          <div>
                            <div className="font-medium truncate max-w-[200px]">
                              {s.name || s.email || s.userId}
                            </div>
                            {s.reason && (
                              <div className="text-xs text-yellow-700">{s.reason}</div>
                            )}
                          </div>
                          <StatusBadge tone="warning">
                            {s.status.replace('SKIPPED_', '')}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.recipients.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {locale === 'ru' ? 'Получатели' : 'Recipients'}
                    </h3>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {preview.recipients.slice(0, 10).map((r) => (
                        <div key={r.userId} className="flex items-center gap-2 text-sm bg-green-50 px-3 py-2 rounded">
                          <span className="truncate flex-1">
                            {r.name || r.email}
                          </span>
                          <StatusBadge tone="success">READY</StatusBadge>
                        </div>
                      ))}
                      {preview.recipients.length > 10 && (
                        <div className="text-sm text-gray-500 text-center py-2">
                          {locale === 'ru' ? `и ещё ${preview.recipients.length - 10}` : `and ${preview.recipients.length - 10} more`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loadingPreview && form.selectedUsers.length > 0 && !preview && (
              <Notice tone="warning">
                {locale === 'ru'
                  ? 'Обновите предпросмотр, чтобы увидеть, кому письмо действительно уйдёт.'
                  : 'Refresh preview to see who will actually receive the email.'}
              </Notice>
            )}

            {!loadingPreview && !preview && form.selectedUsers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                {locale === 'ru' ? 'Выберите получателей для предпросмотра' : 'Select recipients to preview'}
              </p>
            )}
          </Panel>

          <Panel variant="subtle" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Как будет выглядеть' : 'Email content'}</h2>
            <div style={{ border: '1px solid var(--signal-border)', borderRadius: 8, padding: '1rem', background: '#fff' }}>
              <p style={{ fontWeight: 700, margin: 0 }}>{contentPreview.subject}</p>
              {contentPreview.preheader ? (
                <p className="signal-muted" style={{ margin: '0.25rem 0 0.75rem' }}>{contentPreview.preheader}</p>
              ) : null}
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                {contentPreview.body || (locale === 'ru' ? 'Текст письма пока пуст.' : 'Email body is empty.')}
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-3">
            <button
              className="btn btn-primary w-full"
              onClick={() => void handleSend()}
              disabled={sendDisabled}
            >
              {sending
                ? (locale === 'ru' ? 'Отправка...' : 'Sending...')
                : locale === 'ru'
                  ? `Отправить ${readyToSendCount} получателям`
                  : `Send to ${readyToSendCount} recipient(s)`}
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/${locale}/admin/email`)}
            >
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
