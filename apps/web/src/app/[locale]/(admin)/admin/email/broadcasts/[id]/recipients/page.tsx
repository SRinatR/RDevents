'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar, AdminToolbarSelect } from '@/components/admin/AdminToolbar';
import { FieldInput, LoadingLines, MetricCard, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableActions,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';

const statusOptions = [
  'ALL',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'CLICKED',
  'FAILED',
  'BOUNCED',
  'COMPLAINED',
  'CANCELLED',
  'SKIPPED_NO_CONSENT',
  'SKIPPED_SUPPRESSED',
  'SKIPPED_EMAIL_NOT_VERIFIED',
  'SKIPPED_BLOCKED',
  'SKIPPED_INVALID_EMAIL',
  'SKIPPED_NO_EMAIL',
];

const toneByStatus = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (status === 'SENT' || status === 'DELIVERED' || status === 'OPENED' || status === 'CLICKED') return 'success';
  if (status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED') return 'danger';
  if (status.startsWith('SKIPPED')) return 'warning';
  return 'neutral';
};

const recipientStatusLabelRu: Record<string, string> = {
  MATCHED: 'Найден',
  QUEUED: 'В очереди',
  SENDING: 'Отправляется',
  SENT: 'Отправлено',
  DELIVERED: 'Доставлено',
  OPENED: 'Открыто',
  CLICKED: 'Клик',
  FAILED: 'Ошибка',
  BOUNCED: 'Bounce',
  COMPLAINED: 'Жалоба',
  SKIPPED_NO_CONSENT: 'Нет согласия',
  SKIPPED_NO_EMAIL: 'Нет email',
  SKIPPED_EMAIL_NOT_VERIFIED: 'Email не подтверждён',
  SKIPPED_UNSUBSCRIBED: 'Отписан',
  SKIPPED_BLOCKED: 'Заблокирован',
  SKIPPED_DUPLICATE_EMAIL: 'Дубликат email',
  SKIPPED_SUPPRESSED: 'В suppression list',
  SKIPPED_INVALID_EMAIL: 'Некорректный email',
  CANCELLED: 'Отменено',
};

export default function EmailBroadcastRecipientsPage() {
  const locale = useRouteLocale();
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number> = { page, limit };
      if (status !== 'ALL') query.status = status;
      if (search.trim()) query.search = search.trim();

      const res = await adminEmailApi.listBroadcastRecipients(id, query);
      setRows(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch {
      setRows([]);
      setMeta(null);
      setError(locale === 'ru' ? 'Не удалось загрузить получателей.' : 'Failed to load recipients.');
    } finally {
      setLoading(false);
    }
  }, [id, locale, status, search, page]);

  useEffect(() => { void load(); }, [load]);

  const retry = async (recipientId: string) => {
    setActionId(recipientId);
    setError(null);
    setNotice(null);
    try {
      await adminEmailApi.retryBroadcastRecipient(id, recipientId);
      setNotice(locale === 'ru' ? 'Retry выполнен.' : 'Retry successful.');
      await load();
    } catch {
      setError(locale === 'ru' ? 'Retry не выполнен.' : 'Retry failed.');
    } finally {
      setActionId(null);
    }
  };

  const retryAllFailed = async () => {
    setActionId('all-failed');
    setError(null);
    setNotice(null);
    try {
      await adminEmailApi.sendBroadcast(id, { mode: 'FAILED_ONLY' });
      setNotice(locale === 'ru' ? 'Retry всех failed получателей запущен.' : 'Retry for all failed recipients started.');
      await load();
    } catch {
      setError(locale === 'ru' ? 'Retry failed не выполнен.' : 'Retry failed failed.');
    } finally {
      setActionId(null);
    }
  };

  const exportCsv = async () => {
    try {
      await adminEmailApi.exportBroadcastRecipients(id);
    } catch {
      setError(locale === 'ru' ? 'Не удалось экспортировать CSV.' : 'Failed to export CSV.');
    }
  };

  const statusCounts = meta?.statusCounts ?? {};
  const totalCount = meta?.total ?? 0;
  const failedCount = statusCounts['FAILED'] ?? 0;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={locale === 'ru' ? 'Получатели рассылки' : 'Broadcast recipients'}
        subtitle={totalCount > 0 ? `${totalCount} ${locale === 'ru' ? 'получателей' : 'recipients'}` : undefined}
        actions={
          <div className="signal-row-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => void exportCsv()}>
              {locale === 'ru' ? 'Экспорт CSV' : 'Export CSV'}
            </button>
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {Object.keys(statusCounts).length > 0 && (
        <div className="signal-kpi-grid">
          {statusCounts['QUEUED'] !== undefined && (
            <MetricCard label="Queued" value={statusCounts['QUEUED']} />
          )}
          {statusCounts['SENT'] !== undefined && (
            <MetricCard label="Sent" value={statusCounts['SENT']} />
          )}
          {statusCounts['DELIVERED'] !== undefined && (
            <MetricCard label="Delivered" value={statusCounts['DELIVERED']} tone="success" />
          )}
          {statusCounts['OPENED'] !== undefined && (
            <MetricCard label="Opened" value={statusCounts['OPENED']} tone="info" />
          )}
          {statusCounts['CLICKED'] !== undefined && (
            <MetricCard label="Clicked" value={statusCounts['CLICKED']} />
          )}
          {statusCounts['FAILED'] !== undefined && (
            <MetricCard label="Failed" value={statusCounts['FAILED']} tone="danger" />
          )}
          {statusCounts['BOUNCED'] !== undefined && (
            <MetricCard label="Bounced" value={statusCounts['BOUNCED']} tone="warning" />
          )}
        </div>
      )}

      <Panel variant="elevated" className="admin-command-panel">
        <AdminToolbar
          actions={
            failedCount > 0 && status === 'FAILED' ? (
              <button
                className="btn btn-secondary btn-sm"
                disabled={actionId === 'all-failed'}
                onClick={() => void retryAllFailed()}
              >
                {actionId === 'all-failed' ? '...' : locale === 'ru' ? 'Retry всех failed' : 'Retry all failed'}
              </button>
            ) : null
          }
        >
          <AdminToolbarSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            {statusOptions.filter(s => s !== 'ALL').map(item => (
              <option value={item} key={item}>{item.replace(/_/g, ' ')}</option>
            ))}
          </AdminToolbarSelect>

          <FieldInput
            placeholder={locale === 'ru' ? 'Поиск по email или имени...' : 'Search by email or name...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="admin-filter-search admin-toolbar-search"
          />
        </AdminToolbar>

        {loading ? (
          <LoadingLines rows={8} />
        ) : rows.length === 0 ? (
          <div className="signal-muted">
            {locale === 'ru' ? 'Нет получателей' : 'No recipients'}
          </div>
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={1180}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Имя' : 'Name', width: '16%' },
                  { label: 'Email', width: '20%' },
                  { label: locale === 'ru' ? 'Статус' : 'Status', width: '12%' },
                  { label: locale === 'ru' ? 'Причина' : 'Reason', width: '18%' },
                  { label: 'Provider ID', width: '12%' },
                  { label: locale === 'ru' ? 'Отправлено' : 'Sent', width: '11%' },
                  { label: locale === 'ru' ? 'Открыто' : 'Opened', width: '11%' },
                  { label: locale === 'ru' ? 'Действия' : 'Actions', align: 'right', width: '10%' },
                ]}
              />
              <AdminDataTableBody>
                {rows.map(row => (
                  <AdminDataTableRow key={row.id}>
                    <AdminDataTableCell><AdminTableCellMain title={row.name ?? '-'} subtitle={row.email} /></AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{row.email}</AdminDataTableCell>
                    <AdminDataTableCell>
                      <StatusBadge tone={toneByStatus(row.status ?? '')}>
                        {locale === 'ru'
                          ? (recipientStatusLabelRu[row.status ?? ''] ?? (row.status ?? '').replace(/_/g, ' '))
                          : (row.status ?? '').replace(/_/g, ' ')}
                      </StatusBadge>
                    </AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{row.skipReason ?? row.failureReason ?? '-'}</AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{row.providerMessageId ?? '-'}</AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{row.sentAt ? new Date(row.sentAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-'}</AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{row.openedAt ? new Date(row.openedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-'}</AdminDataTableCell>
                    <AdminDataTableCell align="right">
                      <AdminTableActions>
                        {row.status === 'FAILED' ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={actionId === row.id}
                            onClick={() => void retry(row.id)}
                          >
                            {actionId === row.id ? '...' : locale === 'ru' ? 'Retry' : 'Retry'}
                          </button>
                        ) : null}
                      </AdminTableActions>
                    </AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {rows.map((row) => (
                <AdminMobileCard
                  key={row.id}
                  title={row.name ?? '-'}
                  subtitle={row.email}
                  badge={
                    <StatusBadge tone={toneByStatus(row.status ?? '')}>
                      {locale === 'ru'
                        ? (recipientStatusLabelRu[row.status ?? ''] ?? (row.status ?? '').replace(/_/g, ' '))
                        : (row.status ?? '').replace(/_/g, ' ')}
                    </StatusBadge>
                  }
                  meta={[
                    { label: locale === 'ru' ? 'Причина' : 'Reason', value: row.skipReason ?? row.failureReason ?? '-' },
                    { label: 'Provider ID', value: row.providerMessageId ?? '-' },
                    { label: locale === 'ru' ? 'Отправлено' : 'Sent', value: row.sentAt ? new Date(row.sentAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-' },
                    { label: locale === 'ru' ? 'Открыто' : 'Opened', value: row.openedAt ? new Date(row.openedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-' },
                  ]}
                  actions={
                    row.status === 'FAILED' ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={actionId === row.id}
                        onClick={() => void retry(row.id)}
                      >
                        {actionId === row.id ? '...' : locale === 'ru' ? 'Retry' : 'Retry'}
                      </button>
                    ) : null
                  }
                />
              ))}
            </AdminMobileList>
          </div>
        )}

        {meta && meta.pages > 1 && (
          <div className="admin-pagination">
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
            >
              ← {locale === 'ru' ? 'Назад' : 'Prev'}
            </button>
            <span className="signal-muted">
              {locale === 'ru' ? 'Страница' : 'Page'} {page} {locale === 'ru' ? 'из' : 'of'} {meta.pages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= meta.pages || loading}
              onClick={() => setPage(p => p + 1)}
            >
              {locale === 'ru' ? 'Вперёд' : 'Next'} →
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
