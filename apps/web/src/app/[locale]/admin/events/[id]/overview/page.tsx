'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, MetricCard, Notice, Panel, SectionHeader, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDate, formatAdminDateTime, memberStatusTone, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function AdminEventOverviewPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
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
      const [eventResult, analyticsResult, membersResult, teamsResult, adminsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.getEventAnalytics(eventId).catch(() => null),
        adminApi.listEventMembers(eventId),
        adminApi.listEventTeams(eventId).catch(() => ({ teams: [] })),
        adminApi.listEventAdmins(eventId).catch(() => ({ eventAdmins: [] })),
      ]);

      setEvent(eventResult.data[0] ?? null);
      setAnalytics(analyticsResult);
      setMembers(membersResult.members ?? []);
      setTeams(teamsResult.teams ?? []);
      setAdmins(adminsResult.eventAdmins ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load event workspace');
      setEvent(null);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const participants = useMemo(() => members.filter((member) => member.role === 'PARTICIPANT'), [members]);
  const volunteers = useMemo(() => members.filter((member) => member.role === 'VOLUNTEER'), [members]);

  const stats = useMemo(() => {
    const pending = participants.filter((member) => member.status === 'PENDING').length;
    const approved = participants.filter((member) => member.status === 'ACTIVE').length;
    const rejected = participants.filter((member) => ['REJECTED', 'CANCELLED', 'REMOVED'].includes(member.status)).length;
    const reserve = participants.filter((member) => member.status === 'RESERVE').length;
    const volunteerPending = volunteers.filter((member) => member.status === 'PENDING').length;
    const views = Number(analytics?.views ?? 0);
    const conversion = views > 0 ? (approved / views) * 100 : null;

    return { pending, approved, rejected, reserve, volunteerPending, views, conversion };
  }, [participants, volunteers, analytics]);

  const latestRegistrations = useMemo(() => {
    return [...participants]
      .sort((left, right) => new Date(right.assignedAt ?? right.createdAt ?? 0).getTime() - new Date(left.assignedAt ?? left.createdAt ?? 0).getTime())
      .slice(0, 6);
  }, [participants]);

  const warnings = useMemo(() => {
    const items: string[] = [];
    if (event?.status !== 'PUBLISHED') items.push(locale === 'ru' ? 'Событие не опубликовано.' : 'Event is not published.');
    if (!event?.registrationDeadline) items.push(locale === 'ru' ? 'Не указан дедлайн регистрации.' : 'Registration deadline is not set.');
    if (stats.pending > 0) items.push(locale === 'ru' ? `На модерации ${stats.pending} заявок участников.` : `${stats.pending} participant applications are waiting.`);
    if (stats.volunteerPending > 0) items.push(locale === 'ru' ? `На модерации ${stats.volunteerPending} заявок волонтёров.` : `${stats.volunteerPending} volunteer applications are waiting.`);
    if (admins.length === 0) items.push(locale === 'ru' ? 'Нет назначенных администраторов события.' : 'No event admins assigned.');
    if (event?.capacity && stats.approved >= event.capacity) items.push(locale === 'ru' ? 'Лимит участников достигнут.' : 'Participant capacity has been reached.');
    return items;
  }, [event, locale, stats, admins.length]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Обзор события' : 'Event overview'}
        subtitle={event ? [event.category, event.location, formatAdminDate(event.startsAt, locale)].filter((item) => item && item !== '—').join(' · ') : ''}
        actions={event ? <Link href={`/${locale}/admin/events/${event.id}/communications`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Сообщение' : 'Message'}</Link> : null}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <>
          <div className="admin-event-summary-grid">
            <Panel variant="elevated" className="admin-command-panel admin-event-identity-panel">
              <SectionHeader title={event.title} subtitle={event.slug ? `/${event.slug}` : undefined} />
              <div className="admin-event-facts-grid">
                <div><small>{locale === 'ru' ? 'Статус' : 'Status'}</small></div>
                <div><small>{locale === 'ru' ? 'Категория' : 'Category'}</small><strong>{event.category ?? '—'}</strong></div>
                <div><small>{locale === 'ru' ? 'Старт' : 'Start'}</small><strong>{formatAdminDateTime(event.startsAt, locale)}</strong></div>
                <div><small>{locale === 'ru' ? 'Локация' : 'Location'}</small><strong>{event.location ?? '—'}</strong></div>
                <div><small>{locale === 'ru' ? 'Лимит' : 'Capacity'}</small><strong>{event.capacity ?? '—'}</strong></div>
                <div><small>{locale === 'ru' ? 'Дедлайн' : 'Deadline'}</small><strong>{formatAdminDateTime(event.registrationDeadline, locale)}</strong></div>
              </div>
              <ToolbarRow>
                <Link href={`/${locale}/admin/events/${event.id}/participants`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Участники' : 'Participants'}</Link>
                <Link href={`/${locale}/admin/events/${event.id}/volunteers`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Волонтёры' : 'Volunteers'}</Link>
                <Link href={`/${locale}/admin/events/${event.id}/teams`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Команды' : 'Teams'}</Link>
                <Link href={`/${locale}/admin/events/${event.id}/forms`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Форма' : 'Form'}</Link>
              </ToolbarRow>
            </Panel>

            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Сигналы' : 'Signals'} subtitle={locale === 'ru' ? 'Что требует внимания' : 'Items that need attention'} />
              {warnings.length === 0 ? (
                <EmptyState title={locale === 'ru' ? 'Всё спокойно' : 'All clear'} description={locale === 'ru' ? 'Критичных предупреждений нет.' : 'No critical warnings for this event.'} />
              ) : (
                <div className="signal-stack">
                  {warnings.map((warning) => (
                    <div className="signal-ranked-item" key={warning}>
                      <span>{warning}</span>
                      
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего заявок' : 'Total applications'} value={participants.length} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Ожидают' : 'Pending'} value={stats.pending} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Подтверждены' : 'Approved'} value={stats.approved} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Отклонены' : 'Rejected'} value={stats.rejected} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Волонтёры ждут' : 'Volunteers pending'} value={stats.volunteerPending} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Команды' : 'Teams'} value={teams.length} />
            <MetricCard tone="info" label={locale === 'ru' ? 'Просмотры' : 'Views'} value={stats.views} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Конверсия' : 'Conversion'} value={stats.conversion !== null ? `${stats.conversion.toFixed(1)}%` : '—'} />
          </div>

          <div className="signal-two-col admin-dashboard-grid">
            <Panel variant="elevated" className="admin-command-panel admin-data-panel">
              <SectionHeader
                title={locale === 'ru' ? 'Последние регистрации' : 'Latest registrations'}
                subtitle={locale === 'ru' ? 'Новые заявки по выбранному событию' : 'Newest applications for the selected event'}
                actions={<Link href={`/${locale}/admin/events/${event.id}/registrations`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Все' : 'All'}</Link>}
              />
              {latestRegistrations.length === 0 ? (
                <EmptyState title={locale === 'ru' ? 'Регистраций пока нет' : 'No registrations yet'} description={locale === 'ru' ? 'Здесь появятся новые заявки.' : 'New applications will appear here.'} />
              ) : (
                <TableShell>
                  <table className="signal-table">
                    <thead>
                      <tr>
                        <th>{locale === 'ru' ? 'Пользователь' : 'User'}</th>
                        <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                        <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestRegistrations.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <strong>{member.user?.name ?? member.user?.email ?? '—'}</strong>
                            <div className="signal-muted">{member.user?.email}</div>
                          </td>
                          <td></td>
                          <td className="signal-muted">{formatAdminDateTime(member.assignedAt, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </Panel>

            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={locale === 'ru' ? 'Администраторы события' : 'Event admins'} subtitle={locale === 'ru' ? 'Кто управляет этим событием' : 'People with event-level access'} />
              {admins.length === 0 ? (
                <EmptyState title={locale === 'ru' ? 'Админы не назначены' : 'No admins assigned'} description={locale === 'ru' ? 'Назначить можно в настройках события.' : 'Assign admins from event settings.'} />
              ) : (
                <div className="signal-stack">
                  {admins.slice(0, 6).map((admin) => (
                    <div className="signal-ranked-item" key={admin.id}>
                      <span>
                        <strong>{admin.user?.name ?? admin.user?.email}</strong>
                        <span className="signal-muted"> {admin.user?.email}</span>
                      </span>
                      
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
