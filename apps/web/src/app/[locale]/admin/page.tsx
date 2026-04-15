'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { adminApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, Notice, PageHeader, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';

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

  const scope = stats?.eventScope ? 'Event Scope' : 'Platform Scope';

  const quickActions = [
    { href: `/${locale}/admin/events/new`, label: t('admin.createEvent'), enabled: isPlatformAdmin },
    { href: `/${locale}/admin/events`, label: t('admin.events'), enabled: true },
    { href: `/${locale}/admin/volunteers`, label: t('admin.volunteers'), enabled: true },
    { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), enabled: true },
    { href: `/${locale}/admin/users`, label: t('admin.users'), enabled: isPlatformAdmin },
    { href: `/${locale}/admin/admins`, label: t('admin.admins'), enabled: isSuperAdmin },
  ].filter((item) => item.enabled);

  return (
    <div className="signal-page-shell">
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} actions={<StatusBadge tone="info">{scope}</StatusBadge>} />

      <ToolbarRow>
        {quickActions.map((item) => (
          <Link key={item.href} href={item.href} className="signal-chip-link">{item.label}</Link>
        ))}
      </ToolbarRow>

      <div className="signal-two-col admin-dashboard-grid">
        <Panel className="admin-command-panel">
          <SectionHeader title={locale === 'ru' ? 'Ключевые показатели' : 'Key operational KPIs'} subtitle={locale === 'ru' ? 'Текущая операционная сводка' : 'Current operational summary'} />
          {statsLoading ? (
            <LoadingLines rows={5} />
          ) : stats ? (
            <div className="signal-kpi-grid">
              <MetricCard tone="info" label={t('analytics.totalEvents')} value={stats.totalEvents ?? 0} />
              <MetricCard tone="success" label={t('analytics.totalRegistrations')} value={stats.totalRegistrations ?? 0} />
              <MetricCard tone="warning" label={t('analytics.totalEventViews')} value={stats.totalEventViews ?? 0} />
              <MetricCard tone="danger" label={locale === 'ru' ? 'В ожидании волонтёров' : 'Volunteers pending'} value={stats.volunteersPending ?? 0} />
            </div>
          ) : (
            <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Панель активируется после появления данных по событиям.' : 'Dashboard widgets activate once event data is available.'} />
          )}
        </Panel>

        <Panel className="admin-command-panel">
          <SectionHeader title={locale === 'ru' ? 'Операционная очередь' : 'Operational queue'} subtitle={locale === 'ru' ? 'Приоритеты по модулям' : 'Module-level priorities'} />
          <div className="signal-stack">
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'События в работе' : 'Active event workflows'}</span><StatusBadge tone="info">{stats?.totalEvents ?? 0}</StatusBadge></div>
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Новые регистрации' : 'Incoming registrations'}</span><StatusBadge tone="success">{stats?.totalRegistrations ?? 0}</StatusBadge></div>
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Запросы волонтёров' : 'Volunteer requests'}</span><StatusBadge tone="warning">{stats?.volunteersPending ?? 0}</StatusBadge></div>
            <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Просмотры витрины' : 'Event catalog views'}</span><StatusBadge tone="neutral">{stats?.totalEventViews ?? 0}</StatusBadge></div>
          </div>
        </Panel>
      </div>

      <div className="signal-two-col admin-dashboard-grid">
        <Panel className="admin-command-panel">
          <SectionHeader title={t('analytics.topViewedEvents')} subtitle={locale === 'ru' ? 'Лидеры по интересу аудитории' : 'Highest audience attention'} />
          {statsLoading ? <LoadingLines rows={4} /> : stats?.topViewedEvents?.length ? (
            <div className="signal-ranked-list">
              {stats.topViewedEvents.slice(0, 6).map((event: any, index: number) => (
                <div className="signal-ranked-item" key={event.eventId ?? `${event.title}-${index}`}>
                  <span className="signal-rank">{index + 1}</span>
                  <span>{event.title}</span>
                  <StatusBadge tone="info">{event.viewCount} {locale === 'ru' ? 'просм.' : 'views'}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Список появится после первых просмотров.' : 'List appears after first page views.'} />}
        </Panel>

        <Panel className="admin-command-panel">
          <SectionHeader title={t('analytics.topRegisteredEvents')} subtitle={locale === 'ru' ? 'Лидеры по заявкам' : 'Highest registration demand'} />
          {statsLoading ? <LoadingLines rows={4} /> : stats?.topRegisteredEvents?.length ? (
            <div className="signal-ranked-list">
              {stats.topRegisteredEvents.slice(0, 6).map((event: any, index: number) => (
                <div className="signal-ranked-item" key={event.eventId ?? `${event.title}-${index}`}>
                  <span className="signal-rank">{index + 1}</span>
                  <span>{event.title}</span>
                  <StatusBadge tone="success">{event.registrationCount} {locale === 'ru' ? 'рег.' : 'registered'}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Список будет показан при накоплении регистраций.' : 'List is shown once registrations accumulate.'} />}
        </Panel>
      </div>

      <Notice tone="warning">
        {locale === 'ru' ? 'Модули расширенной аналитики и автоматизации очередей запланированы следующими фазами, но структура уже готова для интеграции.' : 'Advanced analytics and queue automation modules are planned for next phases, with structure already prepared for integration.'}
      </Notice>
    </div>
  );
}
