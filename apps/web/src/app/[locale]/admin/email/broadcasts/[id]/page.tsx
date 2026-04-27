'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LoadingLines, MetricCard, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

const typeLabels: Record<string, { ru: string; en: string }> = {
  marketing: { ru: 'Маркетинг', en: 'Marketing' },
  event_announcement: { ru: 'Анонс', en: 'Event' },
  event_reminder: { ru: 'Напоминание', en: 'Reminder' },
  system_notification: { ru: 'Системное', en: 'System' },
  admin_test: { ru: 'Тест', en: 'Test' },
  transactional: { ru: 'Транзакционное', en: 'Transactional' },
};

const audienceLabels: Record<string, { ru: string; en: string }> = {
  mailing_consent: { ru: 'Согласие на рассылки', en: 'Mailing consent' },
  verified_users: { ru: 'Подтверждённые', en: 'Verified users' },
  active_users: { ru: 'Активные', en: 'Active users' },
  platform_admins: { ru: 'Админы', en: 'Platform admins' },
};

const audienceSourceLabels: Record<string, { ru: string; en: string }> = {
  static_filter: { ru: 'Статический фильтр', en: 'Static filter' },
  event_participants: { ru: 'Участники события', en: 'Event participants' },
  event_teams: { ru: 'Команды события', en: 'Event teams' },
  manual_selection: { ru: 'Ручной выбор', en: 'Manual selection' },
  uploaded_csv: { ru: 'Загруженный CSV', en: 'Uploaded CSV' },
  saved_segment: { ru: 'Сохранённый сегмент', en: 'Saved segment' },
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

export default function EmailBroadcastDetailPage() {
  const locale = useRouteLocale();
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await adminEmailApi.getBroadcast(id);
      setData(result);
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить рассылку.' : 'Failed to load broadcast.');
    }
  }, [id, locale]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setAction(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(successMsg);
      await load();
    } catch {
      setError(locale === 'ru' ? 'Действие не выполнено.' : 'Action failed.');
    } finally {
      setAction(false);
    }
  };

  const broadcast = data?.broadcast;
  const events = data?.latestEvents ?? [];

  const canQueue = broadcast && ['draft', 'failed', 'partial', 'cancelled'].includes(broadcast.status);
  const canCancel = broadcast && ['scheduled', 'queued', 'sending'].includes(broadcast.status);
  const canRetryFailed = broadcast && ['failed', 'partial'].includes(broadcast.status);

  if (!broadcast) {
    return (
      <div className="signal-page-shell admin-control-page">
        <AdminPageHeader
          title={locale === 'ru' ? 'Рассылка' : 'Broadcast'}
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <LoadingLines rows={8} />
      </div>
    );
  }

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={broadcast.title}
        subtitle={broadcast.subject}
        actions={
          <div className="signal-row-actions">
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/recipients`}>
              {locale === 'ru' ? 'Получатели' : 'Recipients'}
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/analytics`}>
              {locale === 'ru' ? 'Аналитика' : 'Analytics'}
            </Link>
            <Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/email/broadcasts`}>
              ← {locale === 'ru' ? 'Назад' : 'Back'}
            </Link>
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Matched' : 'Matched'} value={broadcast.totalMatched} />
        <MetricCard label={locale === 'ru' ? 'Eligible' : 'Eligible'} value={broadcast.totalEligible} tone="success" />
        <MetricCard label={locale === 'ru' ? 'Skipped' : 'Skipped'} value={broadcast.totalSkipped} tone="warning" />
        <MetricCard label={locale === 'ru' ? 'Queued' : 'Queued'} value={broadcast.queuedCount} />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Sent' : 'Sent'} value={broadcast.sentCount} />
        <MetricCard label={locale === 'ru' ? 'Delivered' : 'Delivered'} value={broadcast.deliveredCount} tone="success" />
        <MetricCard label={locale === 'ru' ? 'Opened' : 'Opened'} value={broadcast.openedCount} tone="info" />
        <MetricCard label={locale === 'ru' ? 'Clicked' : 'Clicked'} value={broadcast.clickedCount} />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Failed' : 'Failed'} value={broadcast.failedCount} tone="danger" />
        <MetricCard label={locale === 'ru' ? 'Bounced' : 'Bounced'} value={broadcast.bouncedCount} tone="warning" />
        <MetricCard label={locale === 'ru' ? 'Complained' : 'Complained'} value={broadcast.complainedCount} tone="danger" />
        <MetricCard label={locale === 'ru' ? 'Unsubscribed' : 'Unsubscribed'} value={broadcast.unsubscribedCount} tone="warning" />
      </div>

      <Panel variant="elevated" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Статус и управление' : 'Status and controls'}</h2>
            <p className="signal-muted">
              {typeLabels[broadcast.type]?.[locale === 'ru' ? 'ru' : 'en'] ?? broadcast.type} ·{' '}
              {audienceLabels[broadcast.audienceKind]?.[locale === 'ru' ? 'ru' : 'en'] ?? broadcast.audienceKind}
            </p>
          </div>
          <StatusBadge tone={
            broadcast.status === 'sent' ? 'success' :
            broadcast.status === 'failed' ? 'danger' :
            broadcast.status === 'partial' ? 'warning' :
            broadcast.status === 'cancelled' ? 'neutral' : 'info'
          }>
            {locale === 'ru' ? (broadcastStatusLabelRu[broadcast.status] ?? broadcast.status) : broadcast.status}
          </StatusBadge>
        </div>

        <div className="signal-row-actions">
          {canQueue && (
            <button
              className="btn btn-primary btn-sm"
              disabled={action}
              onClick={() => void run(
                () => adminEmailApi.sendBroadcast(id),
                locale === 'ru' ? 'Рассылка поставлена в очередь.' : 'Broadcast queued.'
              )}
            >
              {action ? '...' : locale === 'ru' ? 'Отправить' : 'Send'}
            </button>
          )}
          {canCancel && (
            <button
              className="btn btn-danger btn-sm"
              disabled={action}
              onClick={() => void run(
                () => adminEmailApi.cancelBroadcast(id),
                locale === 'ru' ? 'Рассылка отменена.' : 'Broadcast cancelled.'
              )}
            >
              {action ? '...' : locale === 'ru' ? 'Отменить' : 'Cancel'}
            </button>
          )}
          {canRetryFailed && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={action}
              onClick={() => void run(
                () => adminEmailApi.sendBroadcast(id, { mode: 'FAILED_ONLY' }),
                locale === 'ru' ? 'Повтор для failed получателей.' : 'Retry for failed recipients.'
              )}
            >
              {action ? '...' : locale === 'ru' ? 'Retry failed' : 'Retry failed'}
            </button>
          )}
          <Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/recipients`}>
            {locale === 'ru' ? 'CSV получателей' : 'Export CSV'}
          </Link>
        </div>
      </Panel>

      <Panel variant="elevated" className="admin-command-panel">
        <h2>{locale === 'ru' ? 'Контент' : 'Content'}</h2>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <strong>{locale === 'ru' ? 'Тема' : 'Subject'}:</strong>
            <div>{broadcast.subject}</div>
          </div>
          {broadcast.preheader && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Preheader:</strong>
              <div className="signal-muted">{broadcast.preheader}</div>
            </div>
          )}
          {broadcast.textBody && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>{locale === 'ru' ? 'Текстовая версия' : 'Text version'}:</strong>
              <pre style={{
                background: 'var(--signal-bg-subtle)',
                padding: '1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
                maxHeight: '300px',
              }}>{broadcast.textBody}</pre>
            </div>
          )}
          {broadcast.htmlBody && (
            <div>
              <strong>HTML {locale === 'ru' ? 'версия' : 'version'}:</strong>
              <div style={{
                background: '#fff',
                border: '1px solid var(--signal-border)',
                borderRadius: '6px',
                padding: '1rem',
                fontSize: '0.875rem',
                maxHeight: '300px',
                overflow: 'auto',
              }}>
                <div dangerouslySetInnerHTML={{ __html: broadcast.htmlBody }} />
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel variant="elevated" className="admin-command-panel">
        <h2>{locale === 'ru' ? 'Аудитория' : 'Audience'}</h2>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <div className="signal-muted" style={{ fontSize: '0.75rem' }}>{locale === 'ru' ? 'Источник' : 'Source'}</div>
              <div>{audienceSourceLabels[broadcast.audienceSource]?.[locale === 'ru' ? 'ru' : 'en'] ?? broadcast.audienceSource}</div>
            </div>
            <div>
              <div className="signal-muted" style={{ fontSize: '0.75rem' }}>{locale === 'ru' ? 'Тип' : 'Kind'}</div>
              <div>{audienceLabels[broadcast.audienceKind]?.[locale === 'ru' ? 'ru' : 'en'] ?? broadcast.audienceKind}</div>
            </div>
            {broadcast.scheduledAt && (
              <div>
                <div className="signal-muted" style={{ fontSize: '0.75rem' }}>{locale === 'ru' ? 'Запланировано' : 'Scheduled'}</div>
                <div>{new Date(broadcast.scheduledAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}</div>
              </div>
            )}
            {broadcast.timezone && (
              <div>
                <div className="signal-muted" style={{ fontSize: '0.75rem' }}>{locale === 'ru' ? 'Часовой пояс' : 'Timezone'}</div>
                <div>{broadcast.timezone}</div>
              </div>
            )}
          </div>
          {broadcast.audienceFilterJson && Object.keys(broadcast.audienceFilterJson).length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div className="signal-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Filter JSON</div>
              <pre style={{
                background: 'var(--signal-bg-subtle)',
                padding: '0.75rem',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                overflow: 'auto',
              }}>
                {JSON.stringify(broadcast.audienceFilterJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Panel>

      {events.length > 0 && (
        <Panel variant="subtle" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Последние события' : 'Recent events'}</h2>
          <div className="signal-ranked-list" style={{ marginTop: '1rem' }}>
            {events.map((event: any, idx: number) => (
              <div key={`${event.id}-${idx}`} className="signal-ranked-item">
                <span className="signal-status-pill tone-neutral" style={{ fontSize: '0.75rem' }}>{event.type}</span>
                <span className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                  {new Date(event.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {broadcast.errorText && (
        <Panel variant="elevated" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Ошибка' : 'Error'}</h2>
          <div className="notice tone-danger" style={{ marginTop: '0.75rem' }}>
            {broadcast.errorText}
          </div>
        </Panel>
      )}
    </div>
  );
}
