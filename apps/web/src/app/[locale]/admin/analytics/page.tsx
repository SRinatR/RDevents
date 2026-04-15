'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { MetricCard } from '../../../../components/admin/MetricCard';
import { SectionHeader } from '../../../../components/admin/SectionHeader';
import { EmptyState } from '../../../../components/admin/EmptyState';

export default function AdminAnalyticsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    let active = true;

    async function loadStats() {
      setStatsLoading(true);
      try {
        if (isPlatformAdmin) {
          const platformStats = await adminApi.getAnalytics();
          if (active) setStats(platformStats);
          return;
        }
        const eventsResult = await adminApi.listEvents({ limit: 1 });
        const firstEvent = eventsResult.data[0];
        if (!firstEvent) { if (active) setStats(null); return; }
        const eventStats = await adminApi.getEventAnalytics(firstEvent.id);
        if (active) {
          setStats({
            ...eventStats,
            eventScope: true,
            totalEvents: 1,
            totalRegistrations: eventStats.participants,
            totalEventViews: eventStats.views,
            topViewedEvents: [{ eventId: firstEvent.id, title: firstEvent.title, category: firstEvent.category, viewCount: eventStats.views }],
            topRegisteredEvents: [{ eventId: firstEvent.id, title: firstEvent.title, category: firstEvent.category, registrationCount: eventStats.participants }],
          });
        }
      } catch {
        if (active) setStats(null);
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    loadStats();
    return () => { active = false; };
  }, [user, isAdmin, isPlatformAdmin]);

  const summaryCards = stats?.eventScope
    ? [
        { label: 'Managed events',     value: stats.totalEvents ?? 0 },
        { label: 'Participants',        value: stats.participants ?? 0 },
        { label: 'Pending volunteers',  value: stats.volunteersPending ?? 0 },
        { label: 'Event views',         value: stats.views ?? 0 },
      ]
    : [
        { label: t('analytics.totalUsers'),         value: stats?.totalUsers ?? 0 },
        { label: t('analytics.totalEvents'),        value: stats?.totalEvents ?? 0 },
        { label: t('analytics.totalRegistrations'), value: stats?.totalRegistrations ?? 0 },
        { label: t('analytics.totalEventViews'),    value: stats?.totalEventViews ?? 0 },
      ];

  if (loading || !user || !isAdmin) return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  const scopeDesc = isPlatformAdmin ? 'Platform performance overview' : 'Event performance overview';

  return (
    <div className="admin-page">
      <PageHeader title={t('admin.analytics')} description={scopeDesc} />

      <div className="admin-page-body">

        {statsLoading ? (
          <div className="metrics-grid" style={{ marginBottom: 32 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="admin-skeleton" style={{ height: 80 }} />
            ))}
          </div>
        ) : !stats ? (
          <EmptyState title={t('common.noData')} description="No analytics data available yet." />
        ) : (
          <>
            {/* KPIs */}
            <div className="metrics-grid" style={{ marginBottom: 36 }}>
              {summaryCards.map(({ label, value }) => (
                <MetricCard key={label} label={label} value={value} />
              ))}
            </div>

            {/* Registrations by provider */}
            {stats.registrationsByProvider && Object.keys(stats.registrationsByProvider).length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <SectionHeader title={t('analytics.registrationsByProvider')} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {Object.entries(stats.registrationsByProvider).map(([provider, count]) => (
                    <div key={provider} className="metric-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{provider}</span>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{Number(count).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logins by provider */}
            {stats.loginsByProvider && Object.keys(stats.loginsByProvider).length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <SectionHeader title={t('analytics.loginsByProvider')} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {Object.entries(stats.loginsByProvider).map(([provider, count]) => (
                    <div key={provider} className="metric-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{provider}</span>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{Number(count).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top viewed */}
            {stats.topViewedEvents?.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <SectionHeader title={t('analytics.topViewedEvents')} />
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Event</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Views</th>
                        <th style={{ width: 120 }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topViewedEvents.map((e: any, i: number) => {
                        const maxViews = stats.topViewedEvents[0]?.viewCount || 1;
                        const pct = Math.min(100, Math.round((e.viewCount / maxViews) * 100));
                        return (
                          <tr key={e.eventId ?? `${e.title}-${i}`}>
                            <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.8rem' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{e.title}</td>
                            <td style={{ fontSize: '0.82rem' }}>{e.category ?? '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>{e.viewCount.toLocaleString()}</td>
                            <td>
                              <div style={{ height: 4, background: 'var(--color-bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 2 }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top registered */}
            {stats.topRegisteredEvents?.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <SectionHeader title={t('analytics.topRegisteredEvents')} />
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Event</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Registrations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topRegisteredEvents.map((e: any, i: number) => (
                        <tr key={e.eventId ?? `${e.title}-${i}`}>
                          <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.8rem' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{e.title}</td>
                          <td style={{ fontSize: '0.82rem' }}>{e.category ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>{e.registrationCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Conversion */}
            {stats.totalEventViews > 0 && stats.totalRegistrations > 0 && (
              <div style={{ maxWidth: 340 }}>
                <SectionHeader title={t('analytics.conversion')} />
                <div className="metric-card">
                  <div className="metric-value">
                    {((stats.totalRegistrations / stats.totalEventViews) * 100).toFixed(2)}%
                  </div>
                  <div className="metric-label">
                    {stats.totalRegistrations.toLocaleString()} registrations from {stats.totalEventViews.toLocaleString()} views
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
