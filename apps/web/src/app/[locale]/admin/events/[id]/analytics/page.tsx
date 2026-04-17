'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

function statusCount(items: any[], status: string) {
  return items.filter((item) => item.status === status).length;
}

export default function EventAnalyticsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');

    try {
      const [eventResult, analyticsResult, membersResult, teamsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.getEventAnalytics(eventId),
        adminApi.listEventMembers(eventId),
        adminApi.listEventTeams(eventId).catch(() => ({ teams: [] })),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setAnalytics(analyticsResult);
      setMembers(membersResult.members ?? []);
      setTeams(teamsResult.teams ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const participants = useMemo(() => members.filter((member) => member.role === 'PARTICIPANT'), [members]);
  const volunteers = useMemo(() => members.filter((member) => member.role === 'VOLUNTEER'), [members]);

  const metrics = useMemo(() => {
    const activeParticipants = statusCount(participants, 'ACTIVE');
    const pendingParticipants = statusCount(participants, 'PENDING');
    const reserveParticipants = statusCount(participants, 'RESERVE');
    const rejectedParticipants = participants.filter((item) => ['REJECTED', 'CANCELLED', 'REMOVED'].includes(item.status)).length;
    const views = Number(analytics?.views ?? 0);
    const conversion = views > 0 ? (activeParticipants / views) * 100 : null;

    return {
      activeParticipants,
      pendingParticipants,
      reserveParticipants,
      rejectedParticipants,
      views,
      conversion,
      volunteersPending: Number(analytics?.volunteersPending ?? statusCount(volunteers, 'PENDING')),
      volunteersApproved: Number(analytics?.volunteersApproved ?? statusCount(volunteers, 'ACTIVE')),
    };
  }, [analytics, participants, volunteers]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Аналитика события' : 'Event analytics'}
        subtitle={locale === 'ru' ? 'Воронка регистраций, просмотры и операционные показатели' : 'Registration funnel, views, and operational metrics'}
        actions={event ? <Link href={`/${locale}/admin/events/${event.id}/registrations`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Заявки' : 'Applications'}</Link> : null}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : analytics ? (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Просмотры' : 'Views'} value={metrics.views} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Подтверждены' : 'Approved'} value={metrics.activeParticipants} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Ожидают' : 'Pending'} value={metrics.pendingParticipants} />
            <MetricCard tone="info" label={locale === 'ru' ? 'Резерв' : 'Reserve'} value={metrics.reserveParticipants} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Отклонены' : 'Rejected'} value={metrics.rejectedParticipants} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры ждут' : 'Volunteers pending'} value={metrics.volunteersPending} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Волонтёры активны' : 'Volunteers active'} value={metrics.volunteersApproved} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Команды' : 'Teams'} value={teams.length} />
            <MetricCard tone="info" label={locale === 'ru' ? 'Конверсия' : 'Conversion'} value={metrics.conversion !== null ? `${metrics.conversion.toFixed(1)}%` : '—'} />
          </div>

          <div className="signal-two-col admin-dashboard-grid">
            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Воронка участников' : 'Participant funnel'} subtitle={locale === 'ru' ? 'Текущие статусы заявок' : 'Current application statuses'} />
              <div className="admin-funnel-list">
                {[
                  [locale === 'ru' ? 'Все заявки' : 'All applications', participants.length, 'info'],
                  [locale === 'ru' ? 'На модерации' : 'Pending', metrics.pendingParticipants, 'warning'],
                  [locale === 'ru' ? 'Подтверждены' : 'Approved', metrics.activeParticipants, 'success'],
                  [locale === 'ru' ? 'Резерв' : 'Reserve', metrics.reserveParticipants, 'info'],
                  [locale === 'ru' ? 'Закрыты' : 'Closed', metrics.rejectedParticipants, 'danger'],
                ].map(([label, value, tone]) => (
                  <div className="signal-ranked-item" key={String(label)}>
                    <span>{label}</span>
                    <StatusBadge tone={tone as any}>{Number(value).toLocaleString()}</StatusBadge>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Команды и волонтёры' : 'Teams and volunteers'} subtitle={locale === 'ru' ? 'Операционный разрез события' : 'Operational breakdown for this event'} />
              <div className="admin-funnel-list">
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Команд' : 'Teams'}</span><StatusBadge tone="info">{teams.length}</StatusBadge></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Участников в командах' : 'Team members'}</span><StatusBadge tone="neutral">{teams.reduce((sum, team) => sum + Number(team._count?.members ?? team.members?.length ?? 0), 0)}</StatusBadge></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Волонтёров активных' : 'Active volunteers'}</span><StatusBadge tone="success">{metrics.volunteersApproved}</StatusBadge></div>
                <div className="signal-ranked-item"><span>{locale === 'ru' ? 'Волонтёров в очереди' : 'Volunteer queue'}</span><StatusBadge tone="warning">{metrics.volunteersPending}</StatusBadge></div>
              </div>
            </Panel>
          </div>

          <Notice tone="info">
            {locale === 'ru'
              ? 'Раздел использует текущие backend-метрики события и дополняет их расчётами по участникам, командам и волонтёрам.'
              : 'This section uses current event backend metrics and enriches them with participant, team, and volunteer calculations.'}
          </Notice>
        </>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Аналитика недоступна' : 'Analytics unavailable'}
          description={locale === 'ru' ? 'Метрики появятся после накопления просмотров и регистраций.' : 'Metrics will appear after views and registrations accumulate.'}
        />
      )}
    </div>
  );
}
