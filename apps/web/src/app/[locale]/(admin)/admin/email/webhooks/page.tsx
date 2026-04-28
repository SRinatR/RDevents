'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminDataTable, AdminDataTableBody, AdminDataTableCell, AdminDataTableHeader, AdminDataTableRow } from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar, AdminToolbarSelect } from '@/components/admin/AdminToolbar';
import { EmptyState, LoadingLines, MetricCard, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  processed: 'success',
  processing: 'info',
  failed: 'danger',
  pending: 'warning',
};

export default function AdminEmailWebhooksPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [webhooks, setWebhooks] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  const loadWebhooks = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const data = await adminEmailApi.getWebhooks(statusFilter === 'ALL' ? {} : { status: statusFilter });
      setWebhooks(data);
    } catch (e) {
      console.error('Load email webhooks failed:', e);
      setWebhooks(null);
      setError(locale === 'ru' ? 'Не удалось загрузить webhooks.' : 'Failed to load webhooks.');
    } finally {
      setLoadingData(false);
    }
  }, [locale, statusFilter]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;
    void loadWebhooks();
  }, [user, isAdmin, isPlatformAdmin, loadWebhooks]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Управление webhooks доступно только платформенным администраторам.' : 'Webhook management is only available to platform administrators.'}
        />
      </div>
    );
  }

  const logs = webhooks?.logs ?? [];

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.webhooks') ?? 'Webhooks'}
        subtitle={locale === 'ru' ? 'Webhook интеграция Resend и журнал обработки' : 'Resend webhook integration and processing log'}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => void loadWebhooks()} disabled={loadingData}>{locale === 'ru' ? 'Обновить' : 'Refresh'}</button>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <div className="signal-kpi-grid"><LoadingLines rows={6} /></div>
      ) : webhooks ? (
        <div className="signal-kpi-grid">
          <MetricCard tone="info" label="Endpoint" value={webhooks.endpoint ?? 'Not configured'} />
          <MetricCard tone={webhooks.signatureStatus === 'valid' ? 'success' : 'warning'} label={locale === 'ru' ? 'Подпись' : 'Signature'} value={webhooks.signatureStatus ?? 'unknown'} />
          <MetricCard tone="neutral" label={locale === 'ru' ? 'Подписки' : 'Subscriptions'} value={webhooks.subscribedEvents?.length ?? 0} />
          <MetricCard tone="neutral" label={locale === 'ru' ? 'Получено' : 'Received'} value={webhooks.totalReceived ?? 0} />
          <MetricCard tone="success" label={locale === 'ru' ? 'Успешно' : 'Success'} value={webhooks.totalSuccess ?? 0} />
          <MetricCard tone="danger" label={locale === 'ru' ? 'Ошибок' : 'Errors'} value={webhooks.totalFailed ?? 0} />
        </div>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Нет данных' : 'No data'}
          description={locale === 'ru' ? 'Webhook данные появятся после настройки Resend.' : 'Webhook data will appear after Resend is configured.'}
        />
      )}

      {webhooks?.subscribedEvents?.length ? (
        <Panel variant="subtle" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Подписанные события' : 'Subscribed events'}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'Типы событий, которые обновляют статусы сообщений.' : 'Event types that update message statuses.'}</p>
            </div>
          </div>
          <div className="admin-email-chip-row">
            {webhooks.subscribedEvents.map((eventType: string) => (
              <StatusBadge key={eventType} tone="neutral">{eventType}</StatusBadge>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel variant="elevated" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Журнал событий' : 'Event log'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Последние webhook события с результатом обработки.' : 'Recent webhook events with processing result.'}</p>
          </div>
        </div>

        <AdminToolbar>
          <AdminToolbarSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="processed">{locale === 'ru' ? 'Обработано' : 'Processed'}</option>
            <option value="processing">{locale === 'ru' ? 'В процессе' : 'Processing'}</option>
            <option value="failed">{locale === 'ru' ? 'Ошибка' : 'Failed'}</option>
            <option value="pending">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
          </AdminToolbarSelect>
        </AdminToolbar>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : logs.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет событий' : 'No events'}
            description={locale === 'ru' ? 'Webhook события будут появляться после доставки писем.' : 'Webhook events will appear after emails are delivered.'}
          />
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={1080}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Тип события' : 'Event type', width: '18%' },
                  { label: locale === 'ru' ? 'ID события' : 'Event ID', width: '18%' },
                  { label: locale === 'ru' ? 'Получено' : 'Received', width: '18%' },
                  { label: locale === 'ru' ? 'Статус' : 'Status', width: '14%' },
                  { label: locale === 'ru' ? 'Связь' : 'Related', width: '16%' },
                  { label: locale === 'ru' ? 'Ошибка' : 'Error', width: '16%' },
                ]}
              />
              <AdminDataTableBody>
                {logs.map((log: any) => (
                  <AdminDataTableRow key={log.id}>
                    <AdminDataTableCell><StatusBadge tone="neutral">{log.eventType}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{log.providerEventId ?? '-'}</AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{new Date(log.receivedAt).toLocaleString()}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone={toneByStatus[log.processingStatus] ?? 'neutral'}>{log.processingStatus}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{log.relatedEntity ?? '-'}</AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{log.errorMessage ?? '-'}</AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {logs.map((log: any) => (
                <AdminMobileCard
                  key={log.id}
                  title={log.eventType}
                  subtitle={log.providerEventId ?? '-'}
                  badge={<StatusBadge tone={toneByStatus[log.processingStatus] ?? 'neutral'}>{log.processingStatus}</StatusBadge>}
                  meta={[
                    { label: locale === 'ru' ? 'Получено' : 'Received', value: new Date(log.receivedAt).toLocaleString() },
                    { label: locale === 'ru' ? 'Связь' : 'Related', value: log.relatedEntity ?? '-' },
                    { label: locale === 'ru' ? 'Ошибка' : 'Error', value: log.errorMessage ?? '-' },
                  ]}
                />
              ))}
            </AdminMobileList>
          </div>
        )}
      </Panel>
    </div>
  );
}
