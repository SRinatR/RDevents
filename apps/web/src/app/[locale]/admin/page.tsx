'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi, adminEmailApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, Panel } from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SystemReportCard } from '@/components/admin/SystemReportCard';

interface EmailOverview {
  provider: string | null;
  providerStatus: string;
  sendingDomain: string | null;
  sendingDomainStatus: string;
  webhookStatus: string;
  sent24h: number;
  delivered24h: number;
  failed24h: number;
  templatesCount: number;
  automationsCount: number;
  recentActivity: Array<{ type: string; status: string; timestamp: string }>;
}

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
  const [emailOverview, setEmailOverview] = useState<EmailOverview | null>(null);
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
        const [analyticsData, emailData] = await Promise.all([
          adminApi.getAnalytics(),
          isPlatformAdmin ? adminEmailApi.getOverview() : Promise.resolve(null),
        ]);

        if (!active) return;

        setStats(analyticsData);
        if (emailData) setEmailOverview(emailData);
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
          const stats = analyticsResults[index];
          if (stats) {
            totalRegistrations += stats.participants;
            totalViews += stats.views;
            totalVolunteersPending += stats.volunteersPending;
            viewStats.push({ eventId: event.id, title: event.title, viewCount: stats.views });
            registrationStats.push({ eventId: event.id, title: event.title, registrationCount: stats.participants });
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
  const isEmailAdmin = isPlatformAdmin;

  // Calculate email delivery rate
  const deliveryRate = emailOverview && emailOverview.sent24h > 0
    ? Math.round((emailOverview.delivered24h / emailOverview.sent24h) * 100)
    : null;

  return (
    <div className="signal-page-shell admin-dashboard-shell route-shell route-admin-home admin-control-page">
      {/* Page header */}
      <AdminPageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle') ?? (locale === 'ru' ? 'Операционная панель платформы' : 'Platform operational dashboard')}
       
      />

      {/* Platform KPIs - visible to all admins */}
      {statsLoading ? (
        <div className="signal-kpi-grid"><LoadingLines rows={4} /></div>
      ) : stats ? (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего событий' : 'Total events'} value={stats.totalEvents ?? 0} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Активных регистраций' : 'Active registrations'} value={stats.totalRegistrations ?? 0} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры в ожидании' : 'Volunteers pending'} value={(stats as any).volunteersPending ?? 0} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Просмотров' : 'Page views'} value={stats.totalEventViews ?? 0} />
          </div>

          {/* Email KPIs - only for platform admins */}
          {isEmailAdmin && emailOverview && (
            <div className="signal-kpi-grid" style={{ marginTop: 'var(--space-4)' }}>
              <MetricCard tone="info" label={locale === 'ru' ? 'Email отправлено (24ч)' : 'Emails sent (24h)'} value={emailOverview.sent24h} />
              <MetricCard tone="success" label={locale === 'ru' ? 'Email доставлено (24ч)' : 'Emails delivered (24h)'} value={emailOverview.delivered24h} />
              <MetricCard tone={emailOverview.failed24h > 10 ? 'danger' : 'warning'} label={locale === 'ru' ? 'Email ошибок (24ч)' : 'Email failures (24h)'} value={emailOverview.failed24h} />
              <MetricCard
                tone={deliveryRate && deliveryRate >= 95 ? 'success' : deliveryRate && deliveryRate >= 80 ? 'warning' : 'danger'}
                label={locale === 'ru' ? 'Доставка %' : 'Delivery rate'}
                value={deliveryRate !== null ? `${deliveryRate}%` : '—'}
              />
            </div>
          )}
        </>
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
            <Link href={`/${locale}/admin/email`} className="signal-chip-link">{locale === 'ru' ? 'Email' : 'Email'}</Link>
            <Link href={`/${locale}/admin/email/templates`} className="signal-chip-link">{locale === 'ru' ? 'Шаблоны' : 'Templates'}</Link>
            <Link href={`/${locale}/admin/email/webhooks`} className="signal-chip-link">{locale === 'ru' ? 'Webhooks' : 'Webhooks'}</Link>
          </>
        )}
        <Link href={`/${locale}/admin/analytics`} className="signal-chip-link">{locale === 'ru' ? 'Аналитика' : 'Analytics'}</Link>
        {isPlatformAdmin && (
          <Link href={`/${locale}/admin/users`} className="signal-chip-link">{locale === 'ru' ? 'Пользователи' : 'Users'}</Link>
        )}
      </div>

      {/* Email health status - only for platform admins */}
      {isEmailAdmin && emailOverview && (
        <Panel variant="subtle" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Статус Email системы' : 'Email system status'}</h2>
              <p className="signal-muted">
                {emailOverview.provider && emailOverview.sendingDomain
                  ? (locale === 'ru'
                      ? `Провайдер: ${emailOverview.provider} • Домен: ${emailOverview.sendingDomain}`
                      : `Provider: ${emailOverview.provider} • Domain: ${emailOverview.sendingDomain}`)
                  : (locale === 'ru' ? 'Email система не настроена' : 'Email system not configured')}
              </p>
            </div>
            <div className="signal-row-gap">
              
              
            </div>
          </div>
        </Panel>
      )}

      {/* System report - only for platform admins */}
      {isPlatformAdmin && (
        <SystemReportCard locale={locale} />
      )}

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

      {/* Recent activity from email system */}
      {isEmailAdmin && emailOverview && emailOverview.recentActivity && emailOverview.recentActivity.length > 0 && (
        <Panel variant="subtle" className="admin-command-panel">
          <div className="signal-section-header">
            <div>
              <h2>{locale === 'ru' ? 'Последняя Email активность' : 'Recent email activity'}</h2>
              <p className="signal-muted">{locale === 'ru' ? 'Последние события email системы' : 'Latest email system events'}</p>
            </div>
          </div>
          <div className="signal-ranked-list">
            {emailOverview.recentActivity.slice(0, 5).map((activity, index) => (
              <div className="signal-ranked-item" key={`${activity.type}-${index}`}>
                <span className="signal-rank">{new Date(activity.timestamp).toLocaleTimeString()}</span>
                <span className="signal-overflow-ellipsis">{activity.type}</span>
                
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
