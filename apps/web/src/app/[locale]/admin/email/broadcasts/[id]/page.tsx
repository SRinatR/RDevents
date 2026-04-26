'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LoadingLines, MetricCard, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function EmailBroadcastDetailPage() {
  const locale = useRouteLocale();
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminEmailApi.getBroadcast(id));
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить рассылку.' : 'Failed to load broadcast.');
    }
  }, [id, locale]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setAction(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch {
      setError(locale === 'ru' ? 'Действие не выполнено.' : 'Action failed.');
    } finally {
      setAction(false);
    }
  };

  const broadcast = data?.broadcast;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={broadcast?.title ?? (locale === 'ru' ? 'Рассылка' : 'Broadcast')}
        subtitle={broadcast?.subject}
        actions={<div className="signal-row-actions"><Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/recipients`}>Recipients</Link><Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/email/broadcasts/${id}/analytics`}>Analytics</Link></div>}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!broadcast ? <LoadingLines rows={8} /> : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard label="Matched" value={broadcast.totalMatched} />
            <MetricCard label="Eligible" value={broadcast.totalEligible} />
            <MetricCard label="Skipped" value={broadcast.totalSkipped} />
            <MetricCard label="Sent" value={broadcast.sentCount} />
            <MetricCard label="Failed" value={broadcast.failedCount} />
          </div>

          <Panel variant="elevated" className="admin-command-panel">
            <div className="signal-section-header"><div><h2>{locale === 'ru' ? 'Статус' : 'Status'}</h2><p className="signal-muted">{broadcast.audienceSource} · {broadcast.audienceKind}</p></div><StatusBadge tone="info">{broadcast.status}</StatusBadge></div>
            <div className="signal-row-actions">
              {['draft', 'failed', 'partial', 'cancelled'].includes(broadcast.status) ? <button className="btn btn-primary btn-sm" disabled={action} onClick={() => void run(() => adminEmailApi.sendBroadcast(id))}>{locale === 'ru' ? 'В очередь' : 'Queue'}</button> : null}
              {['scheduled', 'queued', 'sending'].includes(broadcast.status) ? <button className="btn btn-danger btn-sm" disabled={action} onClick={() => void run(() => adminEmailApi.cancelBroadcast(id))}>{locale === 'ru' ? 'Отменить' : 'Cancel'}</button> : null}
              {['failed', 'partial'].includes(broadcast.status) ? <button className="btn btn-secondary btn-sm" disabled={action} onClick={() => void run(() => adminEmailApi.sendBroadcast(id, { mode: 'FAILED_ONLY' }))}>Retry failed</button> : null}
            </div>
          </Panel>

          <Panel variant="subtle" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Контент' : 'Content'}</h2>
            <p><strong>{broadcast.subject}</strong></p>
            <p className="signal-muted">{broadcast.preheader ?? '-'}</p>
            <pre className="signal-muted" style={{ whiteSpace: 'pre-wrap' }}>{broadcast.textBody}</pre>
          </Panel>

          <Panel variant="subtle" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'События' : 'Events'}</h2>
            <div className="signal-ranked-list">{(data.latestEvents ?? []).map((event: any) => <div className="signal-ranked-item" key={event.id}><span>{event.type}</span><span className="signal-muted">{new Date(event.createdAt).toLocaleString()}</span></div>)}</div>
          </Panel>
        </>
      )}
    </div>
  );
}
