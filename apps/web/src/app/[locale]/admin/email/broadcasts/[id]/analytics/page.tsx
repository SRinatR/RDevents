'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LoadingLines, MetricCard, Notice, Panel } from '@/components/ui/signal-primitives';

export default function EmailBroadcastAnalyticsPage() {
  const locale = useRouteLocale();
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminEmailApi.getBroadcastAnalytics(id));
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить аналитику.' : 'Failed to load analytics.');
    }
  }, [id, locale]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={locale === 'ru' ? 'Аналитика рассылки' : 'Broadcast analytics'} actions={<button className="btn btn-secondary btn-sm" onClick={() => void load()}>{locale === 'ru' ? 'Обновить' : 'Refresh'}</button>} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!data ? <LoadingLines rows={8} /> : (
        <>
          <div className="signal-kpi-grid">
            {['totalMatched', 'totalEligible', 'totalSkipped', 'sentCount', 'deliveredCount', 'openedCount', 'clickedCount', 'failedCount', 'bouncedCount', 'complainedCount', 'unsubscribedCount'].map(key => <MetricCard key={key} label={key} value={data[key] ?? 0} />)}
          </div>
          <div className="signal-kpi-grid">
            <MetricCard label="Delivery rate" value={`${data.deliveryRate ?? 0}%`} />
            <MetricCard label="Open rate" value={`${data.openRate ?? 0}%`} />
            <MetricCard label="Click rate" value={`${data.clickRate ?? 0}%`} />
            <MetricCard label="Unsubscribe rate" value={`${data.unsubscribeRate ?? 0}%`} />
          </div>
          <Panel variant="elevated" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'События' : 'Timeline'}</h2>
            <div className="signal-ranked-list">{(data.timeline ?? []).map((item: any) => <div className="signal-ranked-item" key={item.type}><span>{item.type}</span><strong>{item.count}</strong></div>)}</div>
          </Panel>
          <Panel variant="subtle" className="admin-command-panel">
            <h2>{locale === 'ru' ? 'Ошибки' : 'Errors'}</h2>
            <div className="signal-ranked-list">{(data.errorsByReason ?? []).map((item: any) => <div className="signal-ranked-item" key={item.reason}><span>{item.reason}</span><strong>{item.count}</strong></div>)}</div>
          </Panel>
        </>
      )}
    </div>
  );
}
