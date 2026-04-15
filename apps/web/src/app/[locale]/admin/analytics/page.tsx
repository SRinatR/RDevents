'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
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

  if (loading || !user || !isAdmin) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div className="spinner" />
    </div>
  );

  const scopeDesc = isPlatformAdmin
    ? (locale === 'ru' ? 'Обзор производительности платформы' : 'Platform performance overview')
    : (locale === 'ru' ? 'Обзор производительности события' : 'Event performance overview');

  const kpiItems = stats?.eventScope
    ? [
        { label: locale === 'ru' ? 'Управляемых событий' : 'Managed events',   value: stats.totalEvents ?? 0 },
        { label: locale === 'ru' ? 'Участников' : 'Participants',               value: stats.participants ?? 0 },
        { label: locale === 'ru' ? 'Ожидают волонтёры' : 'Pending volunteers',  value: stats.volunteersPending ?? 0 },
        { label: locale === 'ru' ? 'Просмотры событий' : 'Event views',         value: stats.views ?? 0 },
      ]
    : [
        { label: t('analytics.totalUsers'),         value: stats?.totalUsers ?? 0 },
        { label: t('analytics.totalEvents'),        value: stats?.totalEvents ?? 0 },
        { label: t('analytics.totalRegistrations'), value: stats?.totalRegistrations ?? 0 },
        { label: t('analytics.totalEventViews'),    value: stats?.totalEventViews ?? 0 },
      ];

  const conversionRate = stats?.totalEventViews > 0 && stats?.totalRegistrations > 0
    ? ((stats.totalRegistrations / stats.totalEventViews) * 100).toFixed(2)
    : null;

  return (
    <div className="admin-page">
      <PageHeader title={t('admin.analytics')} description={scopeDesc} />

      <div className="admin-page-body">

        {statsLoading ? (
          <>
            <div className="admin-kpi-row" style={{ marginBottom: 28 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="admin-kpi-cell">
                  <div className="admin-skeleton" style={{ height: 22, width: 70, marginBottom: 8 }} />
                  <div className="admin-skeleton" style={{ height: 11, width: 100 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} className="admin-skeleton" style={{ height: 80, borderRadius: 8 }} />)}
            </div>
          </>
        ) : !stats ? (
          <EmptyState
            title={t('common.noData')}
            description={locale === 'ru' ? 'Данные аналитики появятся после первых событий.' : 'Analytics data will appear after the first events are created.'}
          />
        ) : (
          <>
            {/* KPI row */}
            <div className="admin-kpi-row" style={{ marginBottom: 32 }}>
              {kpiItems.map(({ label, value }) => (
                <div key={label} className="admin-kpi-cell">
                  <div className="admin-kpi-value">{Number(value).toLocaleString()}</div>
                  <div className="admin-kpi-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Conversion rate – featured metric */}
            {conversionRate && (
              <div style={{ marginBottom: 32 }}>
                <SectionHeader title={t('analytics.conversion')} />
                <div className="admin-panel" style={{ maxWidth: 360 }}>
                  <div className="admin-panel-body">
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                      <div style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>
                        {conversionRate}%
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', paddingBottom: 4, lineHeight: 1.4 }}>
                        {stats.totalRegistrations.toLocaleString()} {locale === 'ru' ? 'регистраций' : 'registrations'}<br />
                        {locale === 'ru' ? 'из' : 'from'} {stats.totalEventViews.toLocaleString()} {locale === 'ru' ? 'просмотров' : 'views'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Registrations by provider */}
            {stats.registrationsByProvider && Object.keys(stats.registrationsByProvider).length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <SectionHeader title={t('analytics.registrationsByProvider')} />
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{locale === 'ru' ? 'Провайдер' : 'Provider'}</th>
                        <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Регистраций' : 'Registrations'}</th>
                        <th style={{ width: 140 }}>{locale === 'ru' ? 'Доля' : 'Share'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const entries = Object.entries(stats.registrationsByProvider) as [string, number][];
                        const total = entries.reduce((sum, [, c]) => sum + Number(c), 0) || 1;
                        return entries.map(([provider, count]) => {
                          const pct = Math.round((Number(count) / total) * 100);
                          return (
                            <tr key={provider}>
                              <td style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{provider}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{Number(count).toLocaleString()}</td>
                              <td>
                                <div className="inline-bar-wrap">
                                  <div className="inline-bar-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Logins by provider */}
            {stats.loginsByProvider && Object.keys(stats.loginsByProvider).length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <SectionHeader title={t('analytics.loginsByProvider')} />
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{locale === 'ru' ? 'Провайдер' : 'Provider'}</th>
                        <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Входов' : 'Logins'}</th>
                        <th style={{ width: 140 }}>{locale === 'ru' ? 'Доля' : 'Share'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const entries = Object.entries(stats.loginsByProvider) as [string, number][];
                        const total = entries.reduce((sum, [, c]) => sum + Number(c), 0) || 1;
                        return entries.map(([provider, count]) => {
                          const pct = Math.round((Number(count) / total) * 100);
                          return (
                            <tr key={provider}>
                              <td style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{provider}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{Number(count).toLocaleString()}</td>
                              <td>
                                <div className="inline-bar-wrap">
                                  <div className="inline-bar-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top viewed events */}
            {stats.topViewedEvents?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <SectionHeader title={t('analytics.topViewedEvents')} />
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                        <th>{locale === 'ru' ? 'Категория' : 'Category'}</th>
                        <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Просмотры' : 'Views'}</th>
                        <th style={{ width: 120 }}>{locale === 'ru' ? 'Доля' : 'Share'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topViewedEvents.map((e: any, i: number) => {
                        const maxViews = stats.topViewedEvents[0]?.viewCount || 1;
                        const pct = Math.min(100, Math.round((e.viewCount / maxViews) * 100));
                        return (
                          <tr key={e.eventId ?? `${e.title}-${i}`}>
                            <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.8rem' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{e.title}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{e.category ?? '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{e.viewCount.toLocaleString()}</td>
                            <td>
                              <div className="inline-bar-wrap">
                                <div className="inline-bar-fill" style={{ width: `${pct}%` }} />
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

            {/* Top registered events */}
            {stats.topRegisteredEvents?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <SectionHeader title={t('analytics.topRegisteredEvents')} />
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                        <th>{locale === 'ru' ? 'Категория' : 'Category'}</th>
                        <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Регистраций' : 'Registrations'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topRegisteredEvents.map((e: any, i: number) => (
                        <tr key={e.eventId ?? `${e.title}-${i}`}>
                          <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.8rem' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{e.title}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{e.category ?? '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{e.registrationCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
