'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { adminApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { PageHeader } from '../../../components/admin/PageHeader';
import { MetricCard } from '../../../components/admin/MetricCard';
import { SectionHeader } from '../../../components/admin/SectionHeader';
import { EmptyState } from '../../../components/admin/EmptyState';

export default function AdminPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin, isSuperAdmin } = useAuth();
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

  const summaryCards = stats?.eventScope
    ? [
        { label: locale === 'ru' ? 'Управляемых событий' : 'Managed events',    value: stats.totalEvents ?? 0 },
        { label: locale === 'ru' ? 'Участников' : 'Participants',                value: stats.participants ?? 0 },
        { label: locale === 'ru' ? 'Заявок волонтёров' : 'Pending volunteers',   value: stats.volunteersPending ?? 0 },
        { label: locale === 'ru' ? 'Просмотров события' : 'Event views',         value: stats.views ?? 0 },
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

  const scopeLabel = isPlatformAdmin
    ? (locale === 'ru' ? 'Обзор платформы' : 'Platform overview')
    : (locale === 'ru' ? 'Обзор событий' : 'Event overview');

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.title')}
        description={scopeLabel}
        actions={
          isPlatformAdmin ? (
            <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
              {t('admin.createEvent')}
            </Link>
          ) : undefined
        }
      />

      <div className="admin-page-body">

        {/* Metrics */}
        <SectionHeader title={t('admin.analytics')} />

        {statsLoading ? (
          <div className="metrics-grid" style={{ marginBottom: 32 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="admin-skeleton" style={{ height: 80 }} />
            ))}
          </div>
        ) : stats ? (
          <div className="metrics-grid" style={{ marginBottom: 36 }}>
            {summaryCards.map(({ label, value }) => (
              <MetricCard key={label} label={label} value={value} />
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 36 }}>
            <EmptyState
              title={t('common.noData')}
              description={locale === 'ru' ? 'Данные аналитики появятся после первых событий.' : 'Analytics data will appear after the first events.'}
            />
          </div>
        )}

        {/* Top viewed */}
        {stats?.topViewedEvents?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader title={t('analytics.topViewedEvents')} />
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                    <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Просмотры' : 'Views'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topViewedEvents.slice(0, 5).map((e: any, index: number) => (
                    <tr key={e.eventId ?? `${e.title}-${index}`}>
                      <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.8rem' }}>{index + 1}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{e.title}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="status-badge status-published">
                          {e.viewCount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top registered */}
        {stats?.topRegisteredEvents?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader title={t('analytics.topRegisteredEvents')} />
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                    <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Регистраций' : 'Registrations'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topRegisteredEvents.slice(0, 5).map((e: any, index: number) => (
                    <tr key={e.eventId ?? `${e.title}-${index}`}>
                      <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.8rem' }}>{index + 1}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{e.title}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="status-badge status-completed">
                          {e.registrationCount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
