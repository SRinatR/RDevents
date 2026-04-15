'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, Notice, PageHeader, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';

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

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  const conversion = stats?.totalEventViews > 0
    ? ((stats.totalRegistrations / stats.totalEventViews) * 100)
    : null;

  return (
    <div className="signal-page-shell">
      <PageHeader
        title={t('admin.analytics')}
        subtitle={isPlatformAdmin ? 'Platform performance overview' : 'Event performance overview'}
        actions={<StatusBadge tone="info">{stats?.eventScope ? 'Event scope' : 'Platform scope'}</StatusBadge>}
      />

      <Panel className="admin-command-panel">
        <SectionHeader title={locale === 'ru' ? 'Сводные метрики' : 'Core metrics'} subtitle={locale === 'ru' ? 'Ключевые показатели конверсии и трафика' : 'Key conversion and traffic indicators'} />
        {statsLoading ? <LoadingLines rows={5} /> : !stats ? (
          <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Данные аналитики появятся после накопления активности.' : 'Analytics widgets appear after activity is accumulated.'} />
        ) : (
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={t('analytics.totalUsers')} value={stats.totalUsers ?? 0} />
            <MetricCard tone="neutral" label={t('analytics.totalEvents')} value={stats.totalEvents ?? 0} />
            <MetricCard tone="success" label={t('analytics.totalRegistrations')} value={stats.totalRegistrations ?? 0} />
            <MetricCard tone="warning" label={t('analytics.totalEventViews')} value={stats.totalEventViews ?? 0} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Волонтёры в очереди' : 'Volunteer queue'} value={stats.volunteersPending ?? 0} />
            <MetricCard tone="info" label={locale === 'ru' ? 'Конверсия' : 'Conversion'} value={conversion !== null ? `${conversion.toFixed(2)}%` : '—'} />
          </div>
        )}
      </Panel>

      <div className="signal-two-col admin-dashboard-grid">
        <Panel className="admin-command-panel">
          <SectionHeader title={t('analytics.registrationsByProvider')} subtitle={locale === 'ru' ? 'Каналы регистраций' : 'Registration channels'} />
          {statsLoading ? <LoadingLines rows={4} /> : stats?.registrationsByProvider && Object.keys(stats.registrationsByProvider).length > 0 ? (
            <div className="signal-stack">
              {Object.entries(stats.registrationsByProvider).map(([provider, count]) => (
                <div key={provider} className="signal-ranked-item">
                  <span>{provider}</span>
                  <StatusBadge tone="info">{Number(count).toLocaleString()}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Нет данных по каналам регистрации.' : 'No provider registration breakdown yet.'} />}
        </Panel>

        <Panel className="admin-command-panel">
          <SectionHeader title={t('analytics.loginsByProvider')} subtitle={locale === 'ru' ? 'Каналы входа' : 'Login channels'} />
          {statsLoading ? <LoadingLines rows={4} /> : stats?.loginsByProvider && Object.keys(stats.loginsByProvider).length > 0 ? (
            <div className="signal-stack">
              {Object.entries(stats.loginsByProvider).map(([provider, count]) => (
                <div key={provider} className="signal-ranked-item">
                  <span>{provider}</span>
                  <StatusBadge tone="neutral">{Number(count).toLocaleString()}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Нет данных по каналам входа.' : 'No provider login breakdown yet.'} />}
        </Panel>
      </div>

      <div className="signal-two-col admin-dashboard-grid">
        <Panel className="admin-command-panel">
          <SectionHeader title={t('analytics.topViewedEvents')} subtitle={locale === 'ru' ? 'Лидеры по просмотрам' : 'Most viewed events'} />
          {statsLoading ? <LoadingLines rows={5} /> : stats?.topViewedEvents?.length ? (
            <div className="signal-ranked-list">
              {stats.topViewedEvents.map((event: any, index: number) => (
                <div className="signal-ranked-item" key={event.eventId ?? `${event.title}-${index}`}>
                  <span className="signal-rank">{index + 1}</span>
                  <span>{event.title}</span>
                  <StatusBadge tone="info">{Number(event.viewCount).toLocaleString()}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Нет лидеров по просмотрам.' : 'No top viewed events available.'} />}
        </Panel>

        <Panel className="admin-command-panel">
          <SectionHeader title={t('analytics.topRegisteredEvents')} subtitle={locale === 'ru' ? 'Лидеры по регистрациям' : 'Most registered events'} />
          {statsLoading ? <LoadingLines rows={5} /> : stats?.topRegisteredEvents?.length ? (
            <div className="signal-ranked-list">
              {stats.topRegisteredEvents.map((event: any, index: number) => (
                <div className="signal-ranked-item" key={event.eventId ?? `${event.title}-${index}`}>
                  <span className="signal-rank">{index + 1}</span>
                  <span>{event.title}</span>
                  <StatusBadge tone="success">{Number(event.registrationCount).toLocaleString()}</StatusBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState title={t('common.noData')} description={locale === 'ru' ? 'Нет лидеров по регистрациям.' : 'No top registered events available.'} />}
        </Panel>
      </div>

      <Notice tone="warning">
        {locale === 'ru' ? 'Визуальная аналитическая структура готова к подключению расширенных метрик и графиков при появлении backend-возможностей.' : 'Analytics workspace structure is ready for expanded metrics and charts as backend capabilities grow.'}
      </Notice>
    </div>
  );
}
