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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminEmailApi.getBroadcastAnalytics(id);
      setData(result);
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить аналитику.' : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [id, locale]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="signal-page-shell admin-control-page">
        <AdminPageHeader
          title={locale === 'ru' ? 'Аналитика рассылки' : 'Broadcast analytics'}
        />
        <LoadingLines rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="signal-page-shell admin-control-page">
        <AdminPageHeader
          title={locale === 'ru' ? 'Аналитика рассылки' : 'Broadcast analytics'}
          actions={<button className="btn btn-secondary btn-sm" onClick={() => void load()}>
            {locale === 'ru' ? 'Обновить' : 'Refresh'}
          </button>}
        />
        <Notice tone="danger">{error}</Notice>
      </div>
    );
  }

  if (!data) return null;

  const timeline = data.timeline ?? [];
  const errorsByReason = data.errorsByReason ?? [];

  const deliveryRate = data.deliveryRate ?? 0;
  const openRate = data.openRate ?? 0;
  const clickRate = data.clickRate ?? 0;
  const bounceRate = data.bounceRate ?? 0;
  const failureRate = data.failureRate ?? 0;
  const unsubscribeRate = data.unsubscribeRate ?? 0;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={locale === 'ru' ? 'Аналитика рассылки' : 'Broadcast analytics'}
        actions={<button className="btn btn-secondary btn-sm" onClick={() => void load()}>
          {locale === 'ru' ? 'Обновить' : 'Refresh'}
        </button>}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Matched' : 'Matched'} value={data.totalMatched ?? 0} />
        <MetricCard label={locale === 'ru' ? 'Eligible' : 'Eligible'} value={data.totalEligible ?? 0} tone="success" />
        <MetricCard label={locale === 'ru' ? 'Skipped' : 'Skipped'} value={data.totalSkipped ?? 0} tone="warning" />
        <MetricCard label={locale === 'ru' ? 'Sent' : 'Sent'} value={data.sentCount ?? 0} />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Delivered' : 'Delivered'} value={data.deliveredCount ?? 0} tone="success" />
        <MetricCard label={locale === 'ru' ? 'Opened' : 'Opened'} value={data.openedCount ?? 0} tone="info" />
        <MetricCard label={locale === 'ru' ? 'Clicked' : 'Clicked'} value={data.clickedCount ?? 0} />
        <MetricCard label={locale === 'ru' ? 'Failed' : 'Failed'} value={data.failedCount ?? 0} tone="danger" />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Bounced' : 'Bounced'} value={data.bouncedCount ?? 0} tone="warning" />
        <MetricCard label={locale === 'ru' ? 'Complained' : 'Complained'} value={data.complainedCount ?? 0} tone="danger" />
        <MetricCard label={locale === 'ru' ? 'Unsubscribed' : 'Unsubscribed'} value={data.unsubscribedCount ?? 0} tone="warning" />
        <div />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Delivery rate' : 'Delivery rate'} value={`${deliveryRate.toFixed(1)}%`} />
        <MetricCard label={locale === 'ru' ? 'Open rate' : 'Open rate'} value={`${openRate.toFixed(1)}%`} />
        <MetricCard label={locale === 'ru' ? 'Click rate' : 'Click rate'} value={`${clickRate.toFixed(1)}%`} />
        <MetricCard label={locale === 'ru' ? 'Unsubscribe rate' : 'Unsubscribe rate'} value={`${unsubscribeRate.toFixed(2)}%`} />
      </div>

      <div className="signal-kpi-grid">
        <MetricCard label={locale === 'ru' ? 'Bounce rate' : 'Bounce rate'} value={`${bounceRate.toFixed(2)}%`} />
        <MetricCard label={locale === 'ru' ? 'Failure rate' : 'Failure rate'} value={`${failureRate.toFixed(2)}%`} />
        <div />
        <div />
      </div>

      <Panel variant="elevated" className="admin-command-panel">
        <h2>{locale === 'ru' ? 'Timeline событий' : 'Event timeline'}</h2>
        {timeline.length === 0 ? (
          <div className="signal-muted" style={{ padding: '1rem 0' }}>
            {locale === 'ru' ? 'Нет событий' : 'No events'}
          </div>
        ) : (
          <div className="signal-ranked-list" style={{ marginTop: '1rem' }}>
            {timeline.map((item: any, idx: number) => (
              <div key={`${item.type}-${idx}`} className="signal-ranked-item">
                <span className="signal-status-pill tone-neutral" style={{ fontSize: '0.75rem' }}>
                  {item.type}
                </span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.9375rem' }}>
                  {item.count}
                </strong>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {errorsByReason.length > 0 && (
        <Panel variant="subtle" className="admin-command-panel">
          <h2>{locale === 'ru' ? 'Ошибки по причинам' : 'Errors by reason'}</h2>
          <div className="signal-ranked-list" style={{ marginTop: '1rem' }}>
            {errorsByReason.map((item: any, idx: number) => (
              <div key={`${item.reason}-${idx}`} className="signal-ranked-item">
                <span className="signal-danger-text" style={{ fontSize: '0.875rem' }}>
                  {item.reason}
                </span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.9375rem', color: 'var(--signal-danger)' }}>
                  {item.count}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
