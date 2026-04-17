'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, Panel, StatusBadge } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

interface PlatformStats {
  totalUsers: number;
  totalEvents: number;
  totalRegistrations: number;
  totalEventViews: number;
  conversionViewToRegistration: number;
  volunteersPending: number;
  topViewedEvents: Array<{ eventId: string; title: string; viewCount: number }>;
  topRegisteredEvents: Array<{ eventId: string; title: string; registrationCount: number }>;
}

interface EventScopedStats {
  totalEvents: number;
  totalRegistrations: number;
  totalEventViews: number;
  volunteersPending: number;
  topViewedEvents: Array<{ eventId: string; title: string; viewCount: number }>;
  topRegisteredEvents: Array<{ eventId: string; title: string; registrationCount: number }>;
}

export default function AdminPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [stats, setStats] = useState<PlatformStats | EventScopedStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  // Load stats based on role
  useEffect(() => {
    if (!user || !isAdmin) return;
    let active = true;

    async function loadPlatformStats() {
      setStatsLoading(true);
      try {
        const analyticsData = await adminApi.getAnalytics();
        if (active) setStats(analyticsData);
      } catch {
        if (active) setStats(null);
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    async function loadEventScopedStats() {
      setStatsLoading(true);
      try {
        // Get ALL events managed by this event admin
        const eventsResult = await adminApi.listEvents({ limit: 100 });
        const events = eventsResult.data;
        
        if (!active) return;

        if (events.length === 0) {
          setStats({ totalEvents: 0, totalRegistrations: 0, totalEventViews: 0, volunteersPending: 0, topViewedEvents: [], topRegisteredEvents: [] });
          setStatsLoading(false);
          return;
        }

        // Aggregate analytics for ALL managed events
        const eventIds = events.map(e => e.id);
        
        // Fetch analytics for each event in parallel
        const analyticsResults = await Promise.all(
          eventIds.map(id => adminApi.getEventAnalytics(id).catch(() => null))
        );
        
        if (!active) return;

        // Aggregate stats
        let totalRegistrations = 0;
        let totalViews = 0;
        let totalVolunteersPending = 0;
        const viewStats: { eventId: string; title: string; viewCount: number }[] = [];
        const registrationStats: { eventId: string; title: string; registrationCount: number }[] = [];

        events.forEach((event, index) => {
          const evtStats = analyticsResults[index];
          if (evtStats) {
            totalRegistrations += evtStats.participants;
            totalViews += evtStats.views;
            totalVolunteersPending += evtStats.volunteersPending;
            viewStats.push({ eventId: event.id, title: event.title, viewCount: evtStats.views });
            registrationStats.push({ eventId: event.id, title: event.title, registrationCount: evtStats.participants });
          }
        });

        // Sort and take top 6
        viewStats.sort((a, b) => b.viewCount - a.viewCount);
        registrationStats.sort((a, b) => b.registrationCount - a.registrationCount);

        setStats({
          totalEvents: events.length,
          totalRegistrations,
          totalEventViews: totalViews,
          volunteersPending: totalVolunteersPending,
          topViewedEvents: viewStats.slice(0, 6),
          topRegisteredEvents: registrationStats.slice(0, 6),
        });
      } catch {
        if (active) setStats(null);
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    if (isPlatformAdmin) {
      loadPlatformStats();
    } else {
      loadEventScopedStats();
    }

    return () => { active = false; };
  }, [user, isAdmin, isPlatformAdmin]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  const scopeLabel = isPlatformAdmin ? 'Platform scope' : 'Event scope';

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-admin-home admin-control-page">
      {/* Page header */}
      <AdminPageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle') ?? (locale === 'ru' ? 'Операционная панель платформы' : 'Platform operational dashboard')}
        actions={<StatusBadge tone="info">{scopeLabel}</StatusBadge>}
      />

      {/* Platform KPIs - visible to all admins */}
      {statsLoading ? (
        <div className="signal-kpi-grid"><LoadingLines rows={4} /></div>
      ) : stats ? (
        <div className="signal-kpi-grid">
          <MetricCard tone="info" label={locale === 'ru' ? 'Всего событий' : 'Total events'} value={stats.totalEvents ?? 0} />
          <MetricCard tone="success" label={locale === 'ru' ? 'Активных регистраций' : 'Active registrations'} value={stats.totalRegistrations ?? 0} />
          <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры в ожидании' : 'Volunteers pending'} value={(stats as EventScopedStats).volunteersPending ?? 0} />
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
              {stats.topViewedEvents.slice(0, 6).map((event, index) => (
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
              {stats.topRegisteredEvents.slice(0, 6).map((event, index) => (
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
    </div>
  );
}