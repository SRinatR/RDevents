'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

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
        if (!firstEvent) {
          if (active) setStats(null);
          return;
        }

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
    return () => {
      active = false;
    };
  }, [user, isAdmin, isPlatformAdmin]);

  const summaryCards = stats?.eventScope
    ? [
        { label: 'Managed events', value: stats.totalEvents ?? 0, icon: '🎪', color: '#2563eb' },
        { label: 'Participants', value: stats.participants ?? 0, icon: '📝', color: '#0891b2' },
        { label: 'Pending volunteers', value: stats.volunteersPending ?? 0, icon: '🙋', color: '#dc2626' },
        { label: 'Event views', value: stats.views ?? 0, icon: '👁', color: '#16a34a' },
      ]
    : [
        { label: t('analytics.totalUsers'), value: stats?.totalUsers ?? 0, icon: '👥', color: '#2563eb' },
        { label: t('analytics.totalEvents'), value: stats?.totalEvents ?? 0, icon: '🎪', color: '#7c3aed' },
        { label: t('analytics.totalRegistrations'), value: stats?.totalRegistrations ?? 0, icon: '📝', color: '#0891b2' },
        { label: t('analytics.totalEventViews'), value: stats?.totalEventViews ?? 0, icon: '👁', color: '#16a34a' },
      ];

  if (loading || !user || !isAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('admin.analytics')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            {isPlatformAdmin ? 'Platform performance overview' : 'Event performance overview'}
          </p>
        </div>

        {statsLoading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : !stats ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.noData')}</div>
        ) : (
          <>
            {/* Main stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 40 }}>
              {summaryCards.map(({ label, value, icon, color }) => (
                <div key={label} style={{ padding: 24, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: 0, color }}>{Number(value).toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Registrations by provider */}
            {stats.registrationsByProvider && Object.keys(stats.registrationsByProvider).length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem', fontWeight: 800 }}>{t('analytics.registrationsByProvider')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {Object.entries(stats.registrationsByProvider).map(([provider, count]) => (
                    <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <span style={{ fontWeight: 600 }}>{provider}</span>
                      <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--color-primary)' }}>{Number(count).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logins by provider */}
            {stats.loginsByProvider && Object.keys(stats.loginsByProvider).length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem', fontWeight: 800 }}>{t('analytics.loginsByProvider')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {Object.entries(stats.loginsByProvider).map(([provider, count]) => (
                    <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <span style={{ fontWeight: 600 }}>{provider}</span>
                      <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--color-primary)' }}>{Number(count).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top viewed events */}
            {stats.topViewedEvents?.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem', fontWeight: 800 }}>{t('analytics.topViewedEvents')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topViewedEvents.map((e: any, i: number) => (
                    <div key={e.eventId ?? e.slug ?? `${e.title}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#f59e0b' : i === 1 ? '#6b7280' : i === 2 ? '#92400e' : 'var(--color-bg-subtle)', color: i < 3 ? '#fff' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{e.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{e.category}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{e.viewCount.toLocaleString()}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>views</div>
                      </div>
                      {stats.totalEventViews > 0 && (
                        <div style={{ width: 80, height: 6, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-subtle)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (e.viewCount / (stats.topViewedEvents[0]?.viewCount || 1)) * 100)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 'var(--radius-lg)' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top registered events */}
            {stats.topRegisteredEvents?.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem', fontWeight: 800 }}>{t('analytics.topRegisteredEvents')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topRegisteredEvents.map((e: any, i: number) => (
                    <div key={e.eventId ?? e.slug ?? `${e.title}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#22c55e' : i === 1 ? '#6b7280' : i === 2 ? '#16a34a' : 'var(--color-bg-subtle)', color: i < 3 ? '#fff' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{e.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{e.category}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{e.registrationCount.toLocaleString()}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>registered</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversion */}
            {stats.totalEventViews > 0 && stats.totalRegistrations > 0 && (
              <div style={{ padding: 24, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', maxWidth: 400 }}>
                <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700 }}>{t('analytics.conversion')}</h2>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: 0 }}>
                  {((stats.totalRegistrations / stats.totalEventViews) * 100).toFixed(2)}%
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {stats.totalRegistrations.toLocaleString()} registrations from {stats.totalEventViews.toLocaleString()} views
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
