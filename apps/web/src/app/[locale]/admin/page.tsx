'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { adminApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function AdminPage() {
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
            topViewedEvents: [{ eventId: firstEvent.id, title: firstEvent.title, viewCount: eventStats.views }],
            topRegisteredEvents: [{ eventId: firstEvent.id, title: firstEvent.title, registrationCount: eventStats.participants }],
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

  const navItems = [
    { href: `/${locale}/admin/events`,    label: t('admin.events'),    icon: '🎪', color: 'var(--color-primary-subtle)',   accent: 'var(--color-primary)' },
    ...(isPlatformAdmin ? [{ href: `/${locale}/admin/users`, label: t('admin.users'), icon: '👥', color: 'rgba(168,85,247,0.08)', accent: '#a855f7' }] : []),
    { href: `/${locale}/admin/volunteers`, label: t('admin.volunteers'), icon: '🙋', color: 'var(--color-success-subtle)',  accent: 'var(--color-success)' },
    { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), icon: '📊', color: 'var(--color-warning-subtle)',   accent: 'var(--color-warning)' },
  ];

  const summaryCards = stats?.eventScope
    ? [
        { label: locale === 'ru' ? 'Управляемых событий' : 'Managed events', value: stats.totalEvents ?? 0, icon: '🎪', color: 'var(--color-primary-subtle)', accent: 'var(--color-primary)' },
        { label: locale === 'ru' ? 'Участников' : 'Participants',           value: stats.participants ?? 0, icon: '📝', color: 'rgba(168,85,247,0.08)', accent: '#a855f7' },
        { label: locale === 'ru' ? 'Заявок волонтёров' : 'Pending volunteers', value: stats.volunteersPending ?? 0, icon: '🙋', color: 'var(--color-success-subtle)', accent: 'var(--color-success)' },
        { label: locale === 'ru' ? 'Просмотров события' : 'Event views',    value: stats.views ?? 0,        icon: '👁️', color: 'var(--color-warning-subtle)', accent: 'var(--color-warning)' },
      ]
    : [
        { label: t('analytics.totalUsers'),         value: stats?.totalUsers ?? 0,         icon: '👥', color: 'var(--color-primary-subtle)', accent: 'var(--color-primary)' },
        { label: t('analytics.totalEvents'),        value: stats?.totalEvents ?? 0,        icon: '🎪', color: 'rgba(168,85,247,0.08)', accent: '#a855f7' },
        { label: t('analytics.totalRegistrations'), value: stats?.totalRegistrations ?? 0, icon: '📝', color: 'var(--color-success-subtle)', accent: 'var(--color-success)' },
        { label: t('analytics.totalEventViews'),    value: stats?.totalEventViews ?? 0,    icon: '👁️', color: 'var(--color-warning-subtle)', accent: 'var(--color-warning)' },
      ];

  if (loading || !user || !isAdmin) return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '48px 0 80px' }}>
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 36, animation: 'fadeIn 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-primary), #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', boxShadow: 'var(--shadow-primary)',
            }}>
              ⚙️
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em' }}>
              {t('admin.title')}
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Quick nav */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 44 }}>
          {navItems.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="nav-chip">
              {icon} {label}
            </Link>
          ))}
        </div>

        {/* Stats section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
            📊 {t('admin.analytics')}
          </h2>
        </div>

        {statsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-2xl)' }} />
            ))}
          </div>
        ) : stats ? (
          <>
            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
              {summaryCards.map(({ label, value, icon, color, accent }, i) => (
                <div
                  key={label}
                  className="stat-card"
                  style={{ animationDelay: `${i * 0.07}s`, animation: 'slideUp 0.4s ease both' }}
                >
                  <div className="stat-card-icon" style={{ background: color }}>
                    <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                  </div>
                  <div className="stat-card-value" style={{ color: accent }}>
                    {typeof value === 'number' ? Number(value).toLocaleString() : value}
                  </div>
                  <div className="stat-card-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Top viewed */}
            {stats.topViewedEvents?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  👁️ {t('analytics.topViewedEvents')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topViewedEvents.slice(0, 5).map((e: any, index: number) => (
                    <div
                      key={e.eventId ?? e.slug ?? `${e.title}-${index}`}
                      className="table-row"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 'var(--radius-md)',
                          background: 'var(--color-primary-subtle)',
                          color: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.78rem', fontWeight: 800, flexShrink: 0,
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {e.title}
                        </span>
                      </div>
                      <span className="badge badge-primary">
                        {e.viewCount} {locale === 'ru' ? 'просм.' : 'views'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top registered */}
            {stats.topRegisteredEvents?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  📝 {t('analytics.topRegisteredEvents')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topRegisteredEvents.slice(0, 5).map((e: any, index: number) => (
                    <div
                      key={e.eventId ?? e.slug ?? `${e.title}-${index}`}
                      className="table-row"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 'var(--radius-md)',
                          background: 'var(--color-success-subtle)',
                          color: 'var(--color-success)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.78rem', fontWeight: 800, flexShrink: 0,
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {e.title}
                        </span>
                      </div>
                      <span className="badge badge-success">
                        {e.registrationCount} {locale === 'ru' ? 'регистр.' : 'registered'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">{t('common.noData')}</h3>
            <p className="empty-state-text">
              {locale === 'ru' ? 'Данные аналитики появятся после первых событий.' : 'Analytics data will appear after the first events.'}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
