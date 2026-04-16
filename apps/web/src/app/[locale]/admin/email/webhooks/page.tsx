'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldSelect, LoadingLines, MetricCard, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminEmailWebhooksPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [webhooks, setWebhooks] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin || !isPlatformAdmin) return;

    adminEmailApi.getWebhooks()
      .then(setWebhooks)
      .catch(() => setWebhooks(null))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin, isPlatformAdmin]);

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

  const filteredLogs = webhooks?.logs?.filter((log: any) => {
    return statusFilter === 'ALL' || log.processingStatus === statusFilter;
  }) ?? [];

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    processed: 'success',
    processing: 'info',
    failed: 'danger',
    pending: 'warning',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.webhooks') ?? 'Webhooks'}
        subtitle={locale === 'ru' ? 'Webhook интеграция и логи' : 'Webhook integration and logs'}
      />

      {/* Status cards */}
      {loadingData ? (
        <div className="signal-kpi-grid"><LoadingLines rows={6} /></div>
      ) : webhooks ? (
        <div className="signal-kpi-grid">
          <MetricCard tone="info" label={locale === 'ru' ? 'Endpoint' : 'Endpoint'} value={webhooks.endpoint ?? 'Not configured'} />
          <MetricCard tone={webhooks.signatureStatus === 'valid' ? 'success' : 'warning'} label={locale === 'ru' ? 'Подпись' : 'Signature'} value={webhooks.signatureStatus ?? 'unknown'} />
          <MetricCard tone="neutral" label={locale === 'ru' ? 'Подписки' : 'Subscriptions'} value={webhooks.subscribedEvents?.length ?? 0} />
          <MetricCard tone="neutral" label={locale === 'ru' ? 'Получено' : 'Received'} value={webhooks.totalReceived ?? 0} />
          <MetricCard tone="success" label={locale === 'ru' ? 'Успешно' : 'Success'} value={webhooks.totalSuccess ?? 0} />
          <MetricCard tone="danger" label={locale === 'ru' ? 'Ошибок' : 'Errors'} value={webhooks.totalFailed ?? 0} />
        </div>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Нет данных' : 'No data'}
          description={locale === 'ru' ? 'Webhook данные будут загружены после настройки.' : 'Webhook data will be loaded after configuration.'}
        />
      )}

      {/* Event types */}
      {webhooks?.subscribedEvents?.length ? (
        <Panel variant="subtle" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Подписанные события' : 'Subscribed events'}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'Типы webhook событий' : 'Webhook event types'}</p>
            </div>
          </div>
          <div className="signal-row-actions">
            {webhooks.subscribedEvents.map((event: string) => (
              <StatusBadge key={event} tone="info">{event}</StatusBadge>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Event log table */}
      <Panel variant="elevated" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Журнал событий' : 'Event log'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Последние webhook события' : 'Recent webhook events'}</p>
          </div>
        </div>

        <ToolbarRow>
          <FieldSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="processed">{locale === 'ru' ? 'Обработано' : 'Processed'}</option>
            <option value="processing">{locale === 'ru' ? 'В процессе' : 'Processing'}</option>
            <option value="failed">{locale === 'ru' ? 'Ошибка' : 'Failed'}</option>
            <option value="pending">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
          </FieldSelect>
          <StatusBadge tone="info">{filteredLogs.length} {locale === 'ru' ? 'записей' : 'records'}</StatusBadge>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет событий' : 'No events'}
            description={locale === 'ru' ? 'Webhook события будут появляться после подключения провайдера.' : 'Webhook events will appear after provider connection.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Тип события' : 'Event type'}</th>
                  <th>{locale === 'ru' ? 'ID провайдера' : 'Provider ID'}</th>
                  <th>{locale === 'ru' ? 'Получено' : 'Received'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Сущность' : 'Entity'}</th>
                  <th>{locale === 'ru' ? 'Ошибка' : 'Error'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td><StatusBadge tone="neutral">{log.eventType}</StatusBadge></td>
                    <td className="signal-muted signal-overflow-ellipsis">{log.providerEventId ?? '—'}</td>
                    <td className="signal-muted">{new Date(log.receivedAt).toLocaleString()}</td>
                    <td><StatusBadge tone={toneByStatus[log.processingStatus] ?? 'neutral'}>{log.processingStatus}</StatusBadge></td>
                    <td className="signal-muted">{log.relatedEntity ?? '—'}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{log.errorMessage ?? '—'}</td>
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