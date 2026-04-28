'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, adminEmailApi } from '@/lib/api';
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

export default function DirectEmailPage() {
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<DirectEmailForm>(emptyForm);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    skipped: number;
    messages: Array<{ email: string; status: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prefillEmail = searchParams.get('to');
  const prefillName = searchParams.get('name');

  useEffect(() => {
    if (prefillEmail) {
      const recipient: SelectedUser = {
        id: `prefill-${Date.now()}`,
        email: decodeURIComponent(prefillEmail),
        name: prefillName ? decodeURIComponent(prefillName) : null,
      };
      setForm(prev => ({ ...prev, selectedUsers: [recipient] }));
    }
  }, [prefillEmail, prefillName]);

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
        sent: result.sent,
        skipped: result.skipped,
        messages: result.messages.map(m => ({
          email: m.email,
          status: m.status,
        })),
      });
    } catch (e: any) {
      setError(e?.message || (locale === 'ru' ? 'Не удалось отправить письмо.' : 'Failed to send email.'));
    } finally {
      setSending(false);
    }
  }, [form, validate, locale]);

  if (sent && sendResult) {
    return (
      <div className="signal-page-shell">
        <AdminPageHeader
        title={locale === 'ru' ? 'Письмо отправлено' : 'Email sent'}
      />

        <Panel variant="elevated" className="admin-command-panel">
          <div className="space-y-4">
            <Notice tone="success">
              {locale === 'ru'
                ? `Письмо отправлено ${sendResult.sent} получателям${sendResult.skipped > 0 ? `, пропущено ${sendResult.skipped}` : ''}.`
                : `Email sent to ${sendResult.sent} recipient(s)${sendResult.skipped > 0 ? `, ${sendResult.skipped} skipped` : ''}.`
              }
            </Notice>

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
                  </div>
                ))}
              </div>
            </div>

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

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Panel variant="elevated" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Получатели' : 'Recipients'}</h2>

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

            {!loadingPreview && !preview && form.selectedUsers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                {locale === 'ru' ? 'Выберите получателей для предпросмотра' : 'Select recipients to preview'}
              </p>
            )}
          </Panel>

          <div className="flex flex-col gap-3">
            <button
              className="btn btn-primary w-full"
              onClick={() => void handleSend()}
              disabled={sending || form.selectedUsers.length === 0}
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingLines />
                  {locale === 'ru' ? 'Отправка...' : 'Sending...'}
                </span>
              ) : (
                locale === 'ru' ? `Отправить ${form.selectedUsers.length} получателям` : `Send to ${form.selectedUsers.length} recipient(s)`
              )}
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
