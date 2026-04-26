'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbarSelect } from '@/components/admin/AdminToolbar';
import { LoadingLines, Notice, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function EmailBroadcastRecipientsPage() {
  const locale = useRouteLocale();
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminEmailApi.listBroadcastRecipients(id, status === 'ALL' ? {} : { status });
      setRows(res.data);
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить получателей.' : 'Failed to load recipients.');
    } finally {
      setLoading(false);
    }
  }, [id, locale, status]);

  useEffect(() => { void load(); }, [load]);

  const retry = async (recipientId: string) => {
    setActionId(recipientId);
    try {
      await adminEmailApi.retryBroadcastRecipient(id, recipientId);
      await load();
    } catch {
      setError(locale === 'ru' ? 'Retry не выполнен.' : 'Retry failed.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={locale === 'ru' ? 'Получатели рассылки' : 'Broadcast recipients'} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <AdminToolbarSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            {['ALL', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'BOUNCED', 'COMPLAINED', 'SKIPPED_NO_CONSENT', 'SKIPPED_SUPPRESSED', 'CANCELLED'].map(item => <option value={item} key={item}>{item}</option>)}
          </AdminToolbarSelect>
        </ToolbarRow>
        {loading ? <LoadingLines rows={8} /> : (
          <TableShell>
            <table className="signal-table">
              <thead><tr><th>{locale === 'ru' ? 'Имя' : 'Name'}</th><th>Email</th><th>Status</th><th>{locale === 'ru' ? 'Причина' : 'Reason'}</th><th>Provider</th><th>Sent</th><th>Opened</th><th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td>{row.name ?? '-'}</td>
                    <td>{row.email}</td>
                    <td><StatusBadge tone={row.status?.startsWith('SKIPPED') || row.status === 'FAILED' ? 'warning' : 'neutral'}>{row.status}</StatusBadge></td>
                    <td className="signal-muted">{row.skipReason ?? row.failureReason ?? '-'}</td>
                    <td className="signal-muted">{row.providerMessageId ?? '-'}</td>
                    <td className="signal-muted">{row.sentAt ? new Date(row.sentAt).toLocaleString() : '-'}</td>
                    <td className="signal-muted">{row.openedAt ? new Date(row.openedAt).toLocaleString() : '-'}</td>
                    <td className="right">{row.status === 'FAILED' ? <button className="btn btn-secondary btn-sm" disabled={actionId === row.id} onClick={() => void retry(row.id)}>Retry</button> : null}</td>
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
