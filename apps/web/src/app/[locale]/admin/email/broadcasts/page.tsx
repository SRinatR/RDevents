'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, FieldTextarea, LoadingLines, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSelect } from '@/components/admin/AdminToolbar';

type EmailBroadcastRow = {
  id: string;
  title: string;
  audience: string;
  audienceKind: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  errorText: string | null;
};

type EmailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  htmlBody?: string;
  textBody?: string;
  status: string;
};

type BroadcastForm = {
  title: string;
  subject: string;
  preheader: string;
  audienceKind: string;
  templateId: string;
  textBody: string;
  htmlBody: string;
  sendNow: boolean;
};

const emptyBroadcastForm: BroadcastForm = {
  title: '',
  subject: '',
  preheader: '',
  audienceKind: 'mailing_consent',
  templateId: '',
  textBody: '',
  htmlBody: '',
  sendNow: false,
};

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  sent: 'success',
  partial: 'warning',
  sending: 'info',
  scheduled: 'info',
  draft: 'warning',
  failed: 'danger',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export default function AdminEmailBroadcastsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [broadcasts, setBroadcasts] = useState<EmailBroadcastRow[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<BroadcastForm>(emptyBroadcastForm);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const [broadcastRes, templateRes] = await Promise.all([
        adminEmailApi.listBroadcasts(statusFilter === 'ALL' ? {} : { status: statusFilter }),
        adminEmailApi.listTemplates({ status: 'active', limit: 100 }),
      ]);
      setBroadcasts(broadcastRes.data);
      setTemplates(templateRes.data);
    } catch (e) {
      console.error('Load email broadcasts failed:', e);
      setBroadcasts([]);
      setTemplates([]);
      setError(locale === 'ru' ? 'Не удалось загрузить рассылки.' : 'Failed to load broadcasts.');
    } finally {
      setLoadingData(false);
    }
  }, [locale, statusFilter]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;
    void loadData();
  }, [user, isAdmin, isPlatformAdmin, loadData]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    setForm((prev) => ({
      ...prev,
      templateId,
      subject: template?.subject ?? prev.subject,
      preheader: template?.preheader ?? prev.preheader,
      textBody: template?.textBody ?? prev.textBody,
      htmlBody: template?.htmlBody ?? prev.htmlBody,
    }));
  };

  const submitBroadcast = async () => {
    const title = form.title.trim();
    const subject = form.subject.trim();
    const textBody = form.textBody.trim();

    if (!title || !subject || !textBody) {
      setError(locale === 'ru' ? 'Заполните название, тему и текст рассылки.' : 'Fill in title, subject, and text body.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await adminEmailApi.createBroadcast({
        title,
        subject,
        preheader: form.preheader.trim() || undefined,
        audienceKind: form.audienceKind,
        templateId: form.templateId || undefined,
        textBody,
        htmlBody: form.htmlBody.trim() || textToHtml(textBody),
        sendNow: form.sendNow,
      });

      if (form.sendNow && response.data.status === 'failed') {
        setError(response.data.errorText || (locale === 'ru' ? 'Рассылка не была отправлена.' : 'Broadcast was not sent.'));
      } else {
        setNotice(form.sendNow
          ? (locale === 'ru' ? `Рассылка обработана: ${response.data.sentCount}/${response.data.totalRecipients}.` : `Broadcast processed: ${response.data.sentCount}/${response.data.totalRecipients}.`)
          : (locale === 'ru' ? 'Рассылка сохранена как черновик.' : 'Broadcast saved as draft.'));
      }
      setShowComposer(false);
      setForm(emptyBroadcastForm);
      await loadData();
    } catch (e) {
      console.error('Save email broadcast failed:', e);
      setError(locale === 'ru' ? 'Не удалось сохранить или отправить рассылку.' : 'Failed to save or send broadcast.');
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async (broadcastId: string) => {
    setActionId(broadcastId);
    setError(null);
    setNotice(null);

    try {
      const response = await adminEmailApi.sendBroadcast(broadcastId);
      if (response.data.status === 'failed') {
        setError(response.data.errorText || (locale === 'ru' ? 'Рассылка не была отправлена.' : 'Broadcast was not sent.'));
      } else {
        setNotice(locale === 'ru'
          ? `Рассылка обработана: ${response.data.sentCount}/${response.data.totalRecipients}.`
          : `Broadcast processed: ${response.data.sentCount}/${response.data.totalRecipients}.`);
      }
      await loadData();
    } catch (e) {
      console.error('Send email broadcast failed:', e);
      setError(locale === 'ru' ? 'Не удалось отправить рассылку.' : 'Failed to send broadcast.');
    } finally {
      setActionId(null);
    }
  };

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Управление рассылками доступно только платформенным администраторам.' : 'Broadcast management is only available to platform administrators.'}
        />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.broadcasts') ?? 'Broadcasts'}
        subtitle={locale === 'ru' ? 'Массовые email рассылки по управляемым сегментам' : 'Mass email broadcasts for controlled segments'}
        actions={<button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyBroadcastForm); setShowComposer(true); }}>{locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}</button>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {showComposer ? (
        <Panel variant="elevated" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Новая рассылка' : 'New broadcast'}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'По умолчанию отправка идёт только пользователям с согласием на рассылку.' : 'By default, sending targets only users with mailing consent.'}</p>
            </div>
          </div>

          <div className="admin-email-form-grid">
            <label>
              <span>{locale === 'ru' ? 'Название' : 'Title'}</span>
              <FieldInput value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </label>
            <label>
              <span>{locale === 'ru' ? 'Шаблон' : 'Template'}</span>
              <FieldSelect value={form.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">{locale === 'ru' ? 'Без шаблона' : 'No template'}</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </FieldSelect>
            </label>
            <label>
              <span>{locale === 'ru' ? 'Аудитория' : 'Audience'}</span>
              <FieldSelect value={form.audienceKind} onChange={(e) => setForm((prev) => ({ ...prev, audienceKind: e.target.value }))}>
                <option value="mailing_consent">{locale === 'ru' ? 'Согласие на рассылки' : 'Mailing consent'}</option>
                <option value="verified_users">{locale === 'ru' ? 'Подтверждённые пользователи' : 'Verified users'}</option>
                <option value="active_users">{locale === 'ru' ? 'Все активные пользователи' : 'All active users'}</option>
                <option value="platform_admins">{locale === 'ru' ? 'Администраторы платформы' : 'Platform admins'}</option>
              </FieldSelect>
            </label>
            <label>
              <span>{locale === 'ru' ? 'Тема письма' : 'Subject'}</span>
              <FieldInput value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
            </label>
            <label className="admin-email-form-wide">
              <span>Preheader</span>
              <FieldInput value={form.preheader} onChange={(e) => setForm((prev) => ({ ...prev, preheader: e.target.value }))} />
            </label>
            <label className="admin-email-form-wide">
              <span>{locale === 'ru' ? 'Текст рассылки' : 'Text body'}</span>
              <FieldTextarea rows={8} value={form.textBody} onChange={(e) => setForm((prev) => ({ ...prev, textBody: e.target.value }))} placeholder="{{name}}, {{email}}" />
            </label>
            <label className="admin-email-form-wide">
              <span>HTML</span>
              <FieldTextarea rows={8} value={form.htmlBody} onChange={(e) => setForm((prev) => ({ ...prev, htmlBody: e.target.value }))} />
            </label>
            <label className="admin-email-checkbox">
              <input type="checkbox" checked={form.sendNow} onChange={(e) => setForm((prev) => ({ ...prev, sendNow: e.target.checked }))} />
              <span>{locale === 'ru' ? 'Отправить сразу после сохранения' : 'Send immediately after saving'}</span>
            </label>
          </div>

          <div className="signal-row-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void submitBroadcast()} disabled={saving}>{saving ? '...' : locale === 'ru' ? 'Сохранить' : 'Save'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowComposer(false)} disabled={saving}>{locale === 'ru' ? 'Отмена' : 'Cancel'}</button>
          </div>
        </Panel>
      ) : null}

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="draft">{locale === 'ru' ? 'Черновики' : 'Drafts'}</option>
            <option value="scheduled">{locale === 'ru' ? 'Запланированные' : 'Scheduled'}</option>
            <option value="sending">{locale === 'ru' ? 'Отправляются' : 'Sending'}</option>
            <option value="sent">{locale === 'ru' ? 'Отправленные' : 'Sent'}</option>
            <option value="partial">{locale === 'ru' ? 'Частично' : 'Partial'}</option>
            <option value="failed">{locale === 'ru' ? 'Ошибки' : 'Failed'}</option>
          </AdminToolbarSelect>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : broadcasts.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет рассылок' : 'No broadcasts'}
            description={locale === 'ru' ? 'Создайте рассылку, выберите аудиторию и отправьте её через Resend.' : 'Create a broadcast, choose an audience, and send it through Resend.'}
            actions={<button className="btn btn-secondary btn-sm" onClick={() => setShowComposer(true)}>{locale === 'ru' ? 'Создать рассылку' : 'Create broadcast'}</button>}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Title'}</th>
                  <th>{locale === 'ru' ? 'Аудитория' : 'Audience'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Прогресс' : 'Progress'}</th>
                  <th>{locale === 'ru' ? 'Завершено' : 'Finished'}</th>
                  <th>{locale === 'ru' ? 'Ошибка' : 'Error'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((bc) => (
                  <tr key={bc.id}>
                    <td><strong>{bc.title}</strong><div className="signal-muted signal-overflow-ellipsis">{bc.subject}</div></td>
                    <td className="signal-muted">{bc.audience}</td>
                    <td><StatusBadge tone={toneByStatus[bc.status] ?? 'neutral'}>{bc.status}</StatusBadge></td>
                    <td>{bc.sentCount}/{bc.totalRecipients} <span className="signal-muted">({bc.failedCount} failed)</span></td>
                    <td className="signal-muted">{bc.finishedAt ? new Date(bc.finishedAt).toLocaleString() : bc.scheduledAt ? new Date(bc.scheduledAt).toLocaleString() : '-'}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{bc.errorText ?? '-'}</td>
                    <td className="right">
                      <div className="signal-row-actions">
                        {['draft', 'scheduled', 'failed', 'partial'].includes(bc.status) ? (
                          <button className="btn btn-primary btn-sm" disabled={actionId === bc.id} onClick={() => void sendBroadcast(bc.id)}>
                            {actionId === bc.id ? '...' : locale === 'ru' ? 'Отправить' : 'Send'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}
