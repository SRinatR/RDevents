'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSelect } from '@/components/admin/AdminToolbar';
import { FieldInput, LoadingLines, MetricCard, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

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
        <div className="signal-kpi-grid" style={{ marginBottom: '1rem' }}>
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
        <ToolbarRow>
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
            style={{ marginLeft: 'auto', minWidth: '250px' }}
          />

          {failedCount > 0 && status === 'FAILED' && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={actionId === 'all-failed'}
              onClick={() => void retryAllFailed()}
              style={{ marginLeft: '0.5rem' }}
            >
              {actionId === 'all-failed' ? '...' : locale === 'ru' ? 'Retry всех failed' : 'Retry all failed'}
            </button>
          )}
        </ToolbarRow>

        {loading ? (
          <LoadingLines rows={8} />
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--signal-muted)' }}>
            {locale === 'ru' ? 'Нет получателей' : 'No recipients'}
          </div>
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Имя' : 'Name'}</th>
                  <th>Email</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Причина' : 'Reason'}</th>
                  <th>Provider ID</th>
                  <th>{locale === 'ru' ? 'Отправлено' : 'Sent'}</th>
                  <th>{locale === 'ru' ? 'Открыто' : 'Opened'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>{row.name ?? '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{row.email}</td>
                    <td>
                      <StatusBadge tone={toneByStatus(row.status ?? '')}>
                        {(row.status ?? '').replace(/_/g, ' ')}
                      </StatusBadge>
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.8125rem', maxWidth: '200px' }}>
                      <span title={row.skipReason ?? row.failureReason ?? '-'}>
                        {row.skipReason ?? row.failureReason ?? '-'}
                      </span>
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {row.providerMessageId ?? '-'}
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                      {row.sentAt ? new Date(row.sentAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-'}
                    </td>
                    <td className="signal-muted" style={{ fontSize: '0.8125rem' }}>
                      {row.openedAt ? new Date(row.openedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : '-'}
                    </td>
                    <td className="right">
                      {row.status === 'FAILED' ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={actionId === row.id}
                          onClick={() => void retry(row.id)}
                        >
                          {actionId === row.id ? '...' : locale === 'ru' ? 'Retry' : 'Retry'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}

        {meta && meta.pages > 1 && (
          <div className="signal-toolbar-row" style={{ marginTop: '1rem', justifyContent: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
            >
              ← {locale === 'ru' ? 'Назад' : 'Prev'}
            </button>
            <span className="signal-muted" style={{ margin: '0 1rem', fontSize: '0.875rem' }}>
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
