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
    return () => {
      active = false;
    };
  }, [user, isAdmin, isPlatformAdmin]);

  const navItems = [
    { href: `/${locale}/admin/events`, label: t('admin.events'), icon: '🎪' },
    ...(isPlatformAdmin ? [{ href: `/${locale}/admin/users`, label: t('admin.users'), icon: '👥' }] : []),
    { href: `/${locale}/admin/volunteers`, label: t('admin.volunteers'), icon: '🙋' },
    { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), icon: '📊' },
  ];

  const summaryCards = stats?.eventScope
    ? [
        { label: 'Managed events', value: stats.totalEvents ?? 0, icon: '🎪' },
        { label: 'Participants', value: stats.participants ?? 0, icon: '📝' },
        { label: 'Pending volunteers', value: stats.volunteersPending ?? 0, icon: '🙋' },
        { label: 'Event views', value: stats.views ?? 0, icon: '👁' },
      ]
    : [
        { label: t('analytics.totalUsers'), value: stats?.totalUsers ?? 0, icon: '👥' },
        { label: t('analytics.totalEvents'), value: stats?.totalEvents ?? 0, icon: '🎪' },
        { label: t('analytics.totalRegistrations'), value: stats?.totalRegistrations ?? 0, icon: '📝' },
        { label: t('analytics.totalEventViews'), value: stats?.totalEventViews ?? 0, icon: '👁' },
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
            {t('admin.title')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('admin.subtitle')}</p>
        </div>

        {/* Quick nav */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
          {navItems.map(({ href, label, icon }) => (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)', background: 'var(--color-surface)', textDecoration: 'none' }}>
              <span>{icon}</span> {label}
            </Link>
          ))}
        </div>

        {/* Stats grid */}
        <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem', fontWeight: 800 }}>{t('admin.analytics')}</h2>
        {statsLoading ? (
          <div style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>{t('common.loading')}</div>
        ) : stats ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {summaryCards.map(({ label, value, icon }) => (
                <div key={label} style={{ padding: 22, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: 0 }}>{Number(value).toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Top events */}
            {stats.topViewedEvents?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700 }}>{t('analytics.topViewedEvents')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topViewedEvents.slice(0, 5).map((e: any, index: number) => (
                    <div key={e.eventId ?? e.slug ?? `${e.title}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{e.viewCount} views</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top registered */}
            {stats.topRegisteredEvents?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700 }}>{t('analytics.topRegisteredEvents')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topRegisteredEvents.slice(0, 5).map((e: any, index: number) => (
                    <div key={e.eventId ?? e.slug ?? `${e.title}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{e.registrationCount} registered</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>{t('common.noData')}</div>
        )}
      </div>
    </div>
  );
}
