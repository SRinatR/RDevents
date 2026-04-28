'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiError, adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { FieldInput, LoadingLines, MetricCard, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

const typeLabels: Record<string, { ru: string; en: string }> = {
  marketing: { ru: 'Маркетинг', en: 'Marketing' },
  event_announcement: { ru: 'Анонс события', en: 'Event announcement' },
  event_reminder: { ru: 'Напоминание', en: 'Event reminder' },
  system_notification: { ru: 'Системное уведомление', en: 'System notification' },
  admin_test: { ru: 'Операционная / тестовая', en: 'Operational / admin test' },
  transactional: { ru: 'Транзакционное', en: 'Transactional' },
};

const audienceLabels: Record<string, { ru: string; en: string }> = {
  mailing_consent: { ru: 'Согласие на рассылки', en: 'Mailing consent' },
  verified_users: { ru: 'Подтверждённые', en: 'Verified users' },
  active_users: { ru: 'Активные', en: 'Active users' },
  platform_admins: { ru: 'Админы платформы', en: 'Platform admins' },
};

const audienceSourceLabels: Record<string, { ru: string; en: string }> = {
  static_filter: { ru: 'Статический фильтр', en: 'Static filter' },
  event_participants: { ru: 'Участники события', en: 'Event participants' },
  event_teams: { ru: 'Команды события', en: 'Event teams' },
  manual_selection: { ru: 'Ручной выбор', en: 'Manual selection' },
  uploaded_csv: { ru: 'CSV', en: 'Uploaded CSV' },
  saved_segment: { ru: 'Сегмент', en: 'Saved segment' },
  system: { ru: 'Системный', en: 'System' },
};

const broadcastStatusLabelRu: Record<string, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирована',
  queued: 'В очереди',
  sending: 'Отправляется',
  sent: 'Отправлена',
  partial: 'Частично отправлена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
};

function getErrorMessage(error: unknown, locale: string) {
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_TEST_SEND_RATE_LIMITED') {
      return locale === 'ru'
        ? 'Лимит тестовых отправок временно исчерпан. Попробуйте позже.'
        : 'Test send rate limit reached. Try again later.';
    }
    if (error.message) {
      return error.message;
    }
  }

  return locale === 'ru' ? 'Не удалось выполнить действие.' : 'Failed to complete the action.';
}

function toneByBroadcastStatus(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'partial') return 'warning';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

export default function EmailBroadcastDetailPage() {
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [data, setData] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [testEmail, setTestEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await adminEmailApi.getBroadcast(id);
      setData(result);
    } catch (requestError) {
      setError(getErrorMessage(requestError, locale));
    } finally {
      setLoading(false);
    }
  }, [id, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const broadcast = data?.broadcast;
  const events = data?.latestEvents ?? [];
  const audienceFilter = useMemo(() => broadcast?.audienceFilterJson ?? {}, [broadcast?.audienceFilterJson]);
  const manualEmailsCount = Array.isArray(audienceFilter?.emails) ? audienceFilter.emails.length : 0;
  const manualUserIdsCount = Array.isArray(audienceFilter?.userIds) ? audienceFilter.userIds.length : 0;

  const loadPreview = useCallback(async () => {
    if (!broadcast) return;

    setPreviewLoading(true);

    try {
      const result = await adminEmailApi.previewEmail({
        subject: broadcast.subject,
        preheader: broadcast.preheader,
        textBody: broadcast.textBody,
        htmlBody: broadcast.htmlBody,
        sampleVariables: {
          name: isRu ? 'Иван Петров' : 'John Smith',
          email: testEmail.trim() || 'preview@example.com',
          unsubscribeUrl: `${window.location.origin}/${locale}/unsubscribe?token=preview`,
        },
      });
      setPreview(result);
    } catch (requestError) {
      setPreview(null);
      setError(getErrorMessage(requestError, locale));
    } finally {
      setPreviewLoading(false);
    }
  }, [broadcast, isRu, locale, testEmail]);

  useEffect(() => {
    if (!broadcast) return;
    void loadPreview();
  }, [broadcast, loadPreview]);

  const run = async (fn: () => Promise<unknown>, successMessage: string) => {
    setAction(true);
    setError(null);
    setNotice(null);

    try {
      await fn();
      setNotice(successMessage);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, locale));
    } finally {
      setAction(false);
    }
  };

  const sendTest = async () => {
    if (!broadcast) return;
    if (!testEmail.trim()) {
      setError(isRu ? 'Укажите email для тестовой отправки.' : 'Enter a test email address.');
      return;
    }

    setAction(true);
    setError(null);
    setNotice(null);

    try {
      await adminEmailApi.testSendEmail({
        toEmail: testEmail.trim(),
        subject: broadcast.subject || 'Test',
        preheader: broadcast.preheader,
        textBody: broadcast.textBody || 'Test',
        htmlBody: broadcast.htmlBody,
      });
      setNotice(isRu ? `Тест отправлен на ${testEmail.trim()}` : `Test sent to ${testEmail.trim()}`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, locale));
    } finally {
      setAction(false);
    }
  };

  if (loading || !broadcast) {
    return (
      <div className="signal-page-shell admin-control-page">
        <AdminPageHeader title={isRu ? 'Рассылка' : 'Broadcast'} />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <LoadingLines rows={8} />
      </div>
    );
  }

  const canQueue = ['draft', 'failed', 'partial', 'cancelled'].includes(broadcast.status);
  const canCancel = ['scheduled', 'queued', 'sending'].includes(broadcast.status);
  const canRetryFailed = ['failed', 'partial'].includes(broadcast.status);

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={broadcast.title}
        subtitle={broadcast.subject}
        actions={
          <div className="signal-row-actions">
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/recipients`}>
              {isRu ? 'Получатели' : 'Recipients'}
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/analytics`}>
              {isRu ? 'Аналитика' : 'Analytics'}
            </Link>
            <Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/email/broadcasts`}>
              ← {isRu ? 'Назад' : 'Back'}
            </Link>
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="signal-kpi-grid">
        <MetricCard label={isRu ? 'Найдено' : 'Matched'} value={broadcast.totalMatched} />
        <MetricCard label="Eligible" value={broadcast.totalEligible} tone="success" />
        <MetricCard label={isRu ? 'Пропущено' : 'Skipped'} value={broadcast.totalSkipped} tone="warning" />
        <MetricCard label="Queued" value={broadcast.queuedCount} />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label="Sent" value={broadcast.sentCount} />
        <MetricCard label="Delivered" value={broadcast.deliveredCount} tone="success" />
        <MetricCard label="Opened" value={broadcast.openedCount} tone="info" />
        <MetricCard label="Clicked" value={broadcast.clickedCount} />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label="Failed" value={broadcast.failedCount} tone="danger" />
        <MetricCard label="Bounced" value={broadcast.bouncedCount} tone="warning" />
        <MetricCard label="Complained" value={broadcast.complainedCount} tone="danger" />
        <MetricCard label="Unsubscribed" value={broadcast.unsubscribedCount} tone="warning" />
      </div>

      <Panel variant="elevated" className="admin-command-panel">
        <div className="admin-email-section-head">
          <div>
            <h2>{isRu ? 'Статус и действия' : 'Status and actions'}</h2>
            <p className="signal-muted">
              {typeLabels[broadcast.type]?.[isRu ? 'ru' : 'en'] ?? broadcast.type} ·{' '}
              {audienceLabels[broadcast.audienceKind]?.[isRu ? 'ru' : 'en'] ?? broadcast.audienceKind}
            </p>
          </div>
          <StatusBadge tone={toneByBroadcastStatus(broadcast.status)}>
            {isRu ? (broadcastStatusLabelRu[broadcast.status] ?? broadcast.status) : broadcast.status}
          </StatusBadge>
        </div>

        <div className="signal-row-actions">
          {canQueue ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={action}
              onClick={() => void run(
                () => adminEmailApi.sendBroadcast(id),
                isRu ? 'Рассылка поставлена в очередь.' : 'Broadcast queued.',
              )}
            >
              {action ? '...' : isRu ? 'Отправить' : 'Send'}
            </button>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={action}
              onClick={() => void run(
                () => adminEmailApi.cancelBroadcast(id),
                isRu ? 'Рассылка отменена.' : 'Broadcast cancelled.',
              )}
            >
              {action ? '...' : isRu ? 'Отменить' : 'Cancel'}
            </button>
          ) : null}

          {canRetryFailed ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={action}
              onClick={() => void run(
                () => adminEmailApi.sendBroadcast(id, { mode: 'FAILED_ONLY' }),
                isRu ? 'Повторная очередь для failed получателей создана.' : 'Retry for failed recipients queued.',
              )}
            >
              {action ? '...' : isRu ? 'Повторить failed' : 'Retry failed'}
            </button>
          ) : null}
        </div>

        <div className="admin-email-form-grid">
          <label className="admin-email-form-wide">
            <span>{isRu ? 'Тестовая отправка' : 'Test send'}</span>
            <FieldInput
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </label>
        </div>

        <div className="signal-row-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={action} onClick={() => void loadPreview()}>
            {previewLoading ? '...' : isRu ? 'Обновить preview' : 'Refresh preview'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={action} onClick={() => void sendTest()}>
            {action ? '...' : isRu ? 'Отправить тест' : 'Send test'}
          </button>
        </div>
      </Panel>

      {preview?.warnings?.length ? (
        <Notice tone="warning">
          <strong>{isRu ? 'Предупреждения:' : 'Warnings:'}</strong>{' '}
          {preview.warnings.join(' · ')}
        </Notice>
      ) : null}

      <div className="admin-email-preview-layout">
        <Panel variant="elevated" className="admin-command-panel">
          {previewLoading ? (
            <LoadingLines rows={8} />
          ) : (
            <div className="admin-email-preview-frame">
              <div className="admin-email-preview-frame-top">
                <span className="admin-email-preview-dot" />
                <span className="admin-email-preview-dot" />
                <span className="admin-email-preview-dot" />
              </div>
              <div className="admin-email-preview-frame-body">
                <div className="admin-email-preview-meta">
                  <p className="admin-email-preview-subject">{preview?.subjectPreview ?? broadcast.subject}</p>
                  {preview?.preheaderPreview ? (
                    <p className="admin-email-preview-preheader">{preview.preheaderPreview}</p>
                  ) : null}
                </div>

                {preview?.htmlPreview ? (
                  <div className="admin-email-preview-html" dangerouslySetInnerHTML={{ __html: preview.htmlPreview }} />
                ) : (
                  <div className="admin-email-preview-empty">
                    {isRu ? 'HTML preview пока недоступен.' : 'HTML preview is not available yet.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>

        <div className="admin-email-preview-side">
          <Panel variant="elevated" className="admin-command-panel">
            <h3>{isRu ? 'Текстовая версия' : 'Text version'}</h3>
            <pre className="admin-email-text-preview">{preview?.textPreview ?? broadcast.textBody}</pre>
          </Panel>

          <Panel variant="elevated" className="admin-command-panel">
            <h3>{isRu ? 'Сводка аудитории' : 'Audience summary'}</h3>
            <div className="admin-email-summary-grid">
              <div className="admin-email-summary-card">
                <div className="admin-email-keyvalue">
                  <span>{isRu ? 'Источник' : 'Source'}</span>
                  <strong>{audienceSourceLabels[broadcast.audienceSource]?.[isRu ? 'ru' : 'en'] ?? broadcast.audienceSource}</strong>
                </div>
                <div className="admin-email-keyvalue">
                  <span>{isRu ? 'Тип аудитории' : 'Audience kind'}</span>
                  <strong>{audienceLabels[broadcast.audienceKind]?.[isRu ? 'ru' : 'en'] ?? broadcast.audienceKind}</strong>
                </div>
                <div className="admin-email-keyvalue">
                  <span>{isRu ? 'Eligible' : 'Eligible'}</span>
                  <strong>{broadcast.totalEligible} / {broadcast.totalMatched}</strong>
                </div>
              </div>

              <div className="admin-email-summary-card">
                {audienceFilter?.eventId ? (
                  <div className="admin-email-keyvalue">
                    <span>{isRu ? 'Event scope' : 'Event scope'}</span>
                    <strong className="text-wrap-safe">{String(audienceFilter.eventId)}</strong>
                  </div>
                ) : null}
                {manualEmailsCount > 0 ? (
                  <div className="admin-email-keyvalue">
                    <span>{isRu ? 'Ручные email' : 'Manual emails'}</span>
                    <strong>{manualEmailsCount}</strong>
                  </div>
                ) : null}
                {manualUserIdsCount > 0 ? (
                  <div className="admin-email-keyvalue">
                    <span>{isRu ? 'Ручные user id' : 'Manual user ids'}</span>
                    <strong>{manualUserIdsCount}</strong>
                  </div>
                ) : null}
                {broadcast.scheduledAt ? (
                  <div className="admin-email-keyvalue">
                    <span>{isRu ? 'Запланировано' : 'Scheduled'}</span>
                    <strong>{new Date(broadcast.scheduledAt).toLocaleString(isRu ? 'ru-RU' : 'en-US')}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            {broadcast.audienceFilterJson && Object.keys(broadcast.audienceFilterJson).length > 0 ? (
              <pre className="admin-email-text-preview">{JSON.stringify(broadcast.audienceFilterJson, null, 2)}</pre>
            ) : null}
          </Panel>
        </div>
      </div>

      {events.length > 0 ? (
        <Panel variant="subtle" className="admin-command-panel">
          <h2>{isRu ? 'Последние события рассылки' : 'Recent broadcast events'}</h2>
          <div className="signal-ranked-list">
            {events.map((event: any, index: number) => (
              <div key={`${event.id}-${index}`} className="signal-ranked-item">
                <span className="signal-status-pill tone-neutral">{event.type}</span>
                <span className="signal-muted">
                  {new Date(event.createdAt).toLocaleString(isRu ? 'ru-RU' : 'en-US')}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {broadcast.errorText ? (
        <Panel variant="elevated" className="admin-command-panel">
          <h2>{isRu ? 'Ошибка' : 'Error'}</h2>
          <Notice tone="danger">{broadcast.errorText}</Notice>
        </Panel>
      ) : null}
    </div>
  );
}
