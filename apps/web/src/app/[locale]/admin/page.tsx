'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, PageHeader, Panel, StatusBadge } from '@/components/ui/signal-primitives';

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

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  const scope = stats?.eventScope ? 'Event scope' : 'Platform scope';
  const isEmailAdmin = isPlatformAdmin;

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-admin-home admin-control-page">
      {/* Page header */}
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle') ?? (locale === 'ru' ? 'Операционная панель платформы' : 'Platform operational dashboard')}
        actions={<StatusBadge tone="info">{scope}</StatusBadge>}
      />

      {/* KPI row */}
      {statsLoading ? (
        <div className="signal-kpi-grid"><LoadingLines rows={4} /></div>
      ) : stats ? (
        <div className="signal-kpi-grid">
          <MetricCard tone="info" label={locale === 'ru' ? 'Всего событий' : 'Total events'} value={stats.totalEvents ?? 0} />
          <MetricCard tone="success" label={locale === 'ru' ? 'Активных регистраций' : 'Active registrations'} value={stats.totalRegistrations ?? 0} />
          <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры в ожидании' : 'Volunteers pending'} value={stats.volunteersPending ?? 0} />
          <MetricCard tone="neutral" label={locale === 'ru' ? 'Просмотров' : 'Page views'} value={stats.totalEventViews ?? 0} />
        </div>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Нет данных' : 'No data'}
          description={locale === 'ru' ? 'Данные появятся после создания событий и регистраций.' : 'Data will appear after events and registrations are created.'}
        />
      )}

      {/* Quick links */}
      <div className="admin-quick-links-row">
        <Link href={`/${locale}/admin/events`} className="signal-chip-link">{locale === 'ru' ? 'События' : 'Events'}</Link>
        <Link href={`/${locale}/admin/participants`} className="signal-chip-link">{locale === 'ru' ? 'Участники' : 'Participants'}</Link>
        <Link href={`/${locale}/admin/volunteers`} className="signal-chip-link">{locale === 'ru' ? 'Волонтёры' : 'Volunteers'}</Link>
        {isEmailAdmin && (
          <>
            <Link href={`/${locale}/admin/email/templates`} className="signal-chip-link">{locale === 'ru' ? 'Шаблоны' : 'Templates'}</Link>
            <Link href={`/${locale}/admin/email/webhooks`} className="signal-chip-link">{locale === 'ru' ? 'Webhooks' : 'Webhooks'}</Link>
          </>
        )}
        <Link href={`/${locale}/admin/analytics`} className="signal-chip-link">{locale === 'ru' ? 'Аналитика' : 'Analytics'}</Link>
        {isPlatformAdmin && (
          <Link href={`/${locale}/admin/users`} className="signal-chip-link">{locale === 'ru' ? 'Пользователи' : 'Users'}</Link>
        )}
      </div>

      {/* Two-column grid */}
      <div className="signal-two-col admin-dashboard-grid">
        {/* Top events by views */}
        <Panel variant="elevated" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Популярные события' : 'Top events by views'}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'Лидеры по просмотрам' : 'Events with most views'}</p>
            </div>
          </div>
          {statsLoading ? (
            <LoadingLines rows={5} />
          ) : stats?.topViewedEvents?.length ? (
            <div className="signal-ranked-list">
              {stats.topViewedEvents.slice(0, 6).map((event: any, index: number) => (
                <div className="signal-ranked-item" key={event.eventId ?? `${event.title}-${index}`}>
                  <span className="signal-rank">{index + 1}</span>
                  <span className="signal-overflow-ellipsis">{event.title}</span>
                  <StatusBadge tone="info">{event.viewCount}</StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={locale === 'ru' ? 'Нет данных' : 'No data'}
              description={locale === 'ru' ? 'Список появится после накопления просмотров.' : 'List appears after views accumulate.'}
            />
          )}
        </Panel>

        {/* Top events by registrations */}
        <Panel variant="elevated" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Лидеры регистраций' : 'Top events by registrations'}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'События с наибольшим числом заявок' : 'Events with most registrations'}</p>
            </div>
          </div>
          {statsLoading ? (
            <LoadingLines rows={5} />
          ) : stats?.topRegisteredEvents?.length ? (
            <div className="signal-ranked-list">
              {stats.topRegisteredEvents.slice(0, 6).map((event: any, index: number) => (
                <div className="signal-ranked-item" key={event.eventId ?? `${event.title}-${index}`}>
                  <span className="signal-rank">{index + 1}</span>
                  <span className="signal-overflow-ellipsis">{event.title}</span>
                  <StatusBadge tone="success">{event.registrationCount}</StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={locale === 'ru' ? 'Нет данных' : 'No data'}
              description={locale === 'ru' ? 'Список будет показан после накопления регистраций.' : 'List shown after registrations accumulate.'}
            />
          )}
        </Panel>
      </div>

      {/* Recent activity placeholder */}
      <Panel variant="subtle" className="admin-command-panel">
        <div className="signal-section-header">
          <div>
            <h2>{locale === 'ru' ? 'Последняя активность' : 'Recent activity'}</h2>
            <p className="signal-muted">{locale === 'ru' ? 'Недавние действия в системе' : 'Recent system actions'}</p>
          </div>
        </div>
        <div className="signal-empty-state">
          <p>{locale === 'ru' ? 'Журнал активности будет добавлен в следующих фазах.' : 'Activity log will be added in upcoming phases.'}</p>
        </div>
      </Panel>
    </div>
  );
}