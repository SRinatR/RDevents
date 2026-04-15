'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { adminApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { PageHeader } from '../../../components/admin/PageHeader';
import { SectionHeader } from '../../../components/admin/SectionHeader';
import { EmptyState } from '../../../components/admin/EmptyState';
import {
  CalendarIcon, UsersIcon, ShieldIcon, HandIcon, ChartIcon, PlusIcon,
} from '../../../components/admin/icons';

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

  if (loading || !user || !isAdmin) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div className="spinner" />
    </div>
  );

  const isEvent = stats?.eventScope;

  const kpiItems = isEvent
    ? [
        { label: locale === 'ru' ? 'Управляемых событий' : 'Managed events',  value: stats.totalEvents ?? 0 },
        { label: locale === 'ru' ? 'Участников' : 'Participants',              value: stats.participants ?? 0 },
        { label: locale === 'ru' ? 'Заявок волонтёров' : 'Volunteers pending', value: stats.volunteersPending ?? 0 },
        { label: locale === 'ru' ? 'Просмотров' : 'Event views',               value: stats.views ?? 0 },
      ]
    : [
        { label: t('analytics.totalUsers'),         value: stats?.totalUsers ?? 0 },
        { label: t('analytics.totalEvents'),        value: stats?.totalEvents ?? 0 },
        { label: t('analytics.totalRegistrations'), value: stats?.totalRegistrations ?? 0 },
        { label: t('analytics.totalEventViews'),    value: stats?.totalEventViews ?? 0 },
      ];

  const quickActions = [
    {
      href: `/${locale}/admin/events`,
      label: locale === 'ru' ? 'События' : 'Events',
      icon: <CalendarIcon size={14} />,
      count: stats?.totalEvents ?? null,
    },
    {
      href: `/${locale}/admin/volunteers`,
      label: locale === 'ru' ? 'Волонтёры' : 'Volunteers',
      icon: <HandIcon size={14} />,
      count: stats?.volunteersPending ?? null,
    },
    ...(isPlatformAdmin ? [
      {
        href: `/${locale}/admin/users`,
        label: locale === 'ru' ? 'Пользователи' : 'Users',
        icon: <UsersIcon size={14} />,
        count: stats?.totalUsers ?? null,
      },
      {
        href: `/${locale}/admin/analytics`,
        label: locale === 'ru' ? 'Аналитика' : 'Analytics',
        icon: <ChartIcon size={14} />,
        count: null,
      },
    ] : []),
    ...(isSuperAdmin ? [
      {
        href: `/${locale}/admin/admins`,
        label: locale === 'ru' ? 'Доступ' : 'Access',
        icon: <ShieldIcon size={14} />,
        count: null,
      },
    ] : []),
  ];

  const scopeLabel = isPlatformAdmin
    ? (locale === 'ru' ? 'Обзор платформы' : 'Platform overview')
    : (locale === 'ru' ? 'Обзор событий' : 'Event overview');

  const hasTopData = stats?.topViewedEvents?.length > 0 || stats?.topRegisteredEvents?.length > 0;

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.title')}
        description={scopeLabel}
        actions={
          isPlatformAdmin ? (
            <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
              <PlusIcon /> {t('admin.createEvent')}
            </Link>
          ) : undefined
        }
      />

      <div className="admin-page-body">

        {/* KPI row */}
        {statsLoading ? (
          <div className="admin-kpi-row">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="admin-kpi-cell">
                <div className="admin-skeleton" style={{ height: 18, width: 80, marginBottom: 8 }} />
                <div className="admin-skeleton" style={{ height: 11, width: 100 }} />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="admin-kpi-row">
            {kpiItems.map(({ label, value }) => (
              <div key={label} className="admin-kpi-cell">
                <div className="admin-kpi-value">{Number(value).toLocaleString()}</div>
                <div className="admin-kpi-label">{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-kpi-row" style={{ marginBottom: 28 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="admin-kpi-cell">
                <div className="admin-kpi-value" style={{ color: 'var(--color-text-faint)' }}>—</div>
                <div className="admin-kpi-label">No data</div>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title={locale === 'ru' ? 'Разделы' : 'Sections'} />
          <div className="admin-quick-actions">
            {quickActions.map(({ href, label, icon, count }) => (
              <Link key={href} href={href} className="admin-quick-action">
                <div className="admin-quick-action-icon">{icon}</div>
                <div className="admin-quick-action-value">
                  {statsLoading ? '—' : count !== null ? Number(count).toLocaleString() : '—'}
                </div>
                <div className="admin-quick-action-label">{label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top performance tables */}
        {!statsLoading && hasTopData && (
          <div className="admin-2col">

            {stats.topViewedEvents?.length > 0 && (
              <div>
                <SectionHeader
                  title={t('analytics.topViewedEvents')}
                  action={
                    <Link href={`/${locale}/admin/analytics`} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {locale === 'ru' ? 'Вся аналитика' : 'Full analytics'}
                    </Link>
                  }
                />
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}>#</th>
                        <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                        <th style={{ textAlign: 'right', width: 120 }}>{locale === 'ru' ? 'Просмотры' : 'Views'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topViewedEvents.slice(0, 5).map((e: any, i: number) => {
                        const maxVal = stats.topViewedEvents[0]?.viewCount || 1;
                        const pct = Math.min(100, Math.round((e.viewCount / maxVal) * 100));
                        return (
                          <tr key={e.eventId ?? `${e.title}-${i}`}>
                            <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.78rem' }}>{i + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem', marginBottom: 4 }}>
                                {e.title}
                              </div>
                              <div className="inline-bar-wrap">
                                <div className="inline-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                              {e.viewCount.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stats.topRegisteredEvents?.length > 0 && (
              <div>
                <SectionHeader
                  title={t('analytics.topRegisteredEvents')}
                  action={
                    <Link href={`/${locale}/admin/events`} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {locale === 'ru' ? 'Все события' : 'All events'}
                    </Link>
                  }
                />
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}>#</th>
                        <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                        <th style={{ textAlign: 'right', width: 120 }}>{locale === 'ru' ? 'Регистраций' : 'Registered'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topRegisteredEvents.slice(0, 5).map((e: any, i: number) => (
                        <tr key={e.eventId ?? `${e.title}-${i}`}>
                          <td style={{ color: 'var(--color-text-faint)', fontWeight: 600, fontSize: '0.78rem' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{e.title}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                            {e.registrationCount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* No data state */}
        {!statsLoading && !stats && (
          <EmptyState
            title={t('common.noData')}
            description={
              locale === 'ru'
                ? 'Данные появятся после первых событий.'
                : 'Data will appear after the first events are created.'
            }
            action={
              isPlatformAdmin ? (
                <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
                  {t('admin.createEvent')}
                </Link>
              ) : undefined
            }
          />
        )}

      </div>
    </div>
  );
}
