'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, TableShell } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, memberStatusTone, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function EventAuditPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
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
      const [eventResult, membersResult, teamsResult, adminsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventMembers(eventId),
        adminApi.listEventTeams(eventId).catch(() => ({ teams: [] })),
        adminApi.listEventAdmins(eventId).catch(() => ({ eventAdmins: [] })),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setMembers(membersResult.members ?? []);
      setTeams(teamsResult.teams ?? []);
      setAdmins(adminsResult.eventAdmins ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit data');
      setMembers([]);
      setTeams([]);
      setAdmins([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const timeline = useMemo(() => {
    const memberRows = members.map((member) => ({
      id: `member-${member.id}`,
      type: member.role,
      actor: member.user?.name ?? member.user?.email ?? '—',
      status: member.status,
      at: member.updatedAt ?? member.assignedAt,
      detail: locale === 'ru' ? 'Запись участника события' : 'Event membership record',
    }));

    const teamRows = teams.map((team) => ({
      id: `team-${team.id}`,
      type: 'TEAM',
      actor: team.captainUser?.name ?? team.captainUser?.email ?? '—',
      status: team.status ?? 'ACTIVE',
      at: team.updatedAt ?? team.createdAt,
      detail: team.name,
    }));

    const adminRows = admins.map((admin) => ({
      id: `admin-${admin.id}`,
      type: 'EVENT_ADMIN',
      actor: admin.user?.name ?? admin.user?.email ?? '—',
      status: admin.status,
      at: admin.updatedAt ?? admin.assignedAt,
      detail: locale === 'ru' ? 'Доступ администратора события' : 'Event admin access',
    }));

    return [...memberRows, ...teamRows, ...adminRows]
      .filter((row) => row.at)
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
      .slice(0, 80);
  }, [members, teams, admins, locale]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Аудит события' : 'Event audit'}
        subtitle={locale === 'ru' ? 'Операционная история по выбранному событию' : 'Operational history for the selected event'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <Panel variant="elevated" className="admin-command-panel admin-data-panel">
          <SectionHeader title={locale === 'ru' ? 'Лента активности' : 'Activity timeline'} subtitle={locale === 'ru' ? 'Собрано из текущих записей участников, команд и админов' : 'Built from current participant, team, and admin records'} />

          {timeline.length === 0 ? (
            <EmptyState
              title={locale === 'ru' ? 'Активности пока нет' : 'No activity yet'}
              description={locale === 'ru' ? 'История появится после регистраций, команд или назначения админов.' : 'History appears after registrations, teams, or admin assignments.'}
            />
          ) : (
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Время' : 'Time'}</th>
                    <th>{locale === 'ru' ? 'Тип' : 'Type'}</th>
                    <th>{locale === 'ru' ? 'Объект' : 'Record'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Детали' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row) => (
                    <tr key={row.id}>
                      <td className="signal-muted">{formatAdminDateTime(row.at, locale)}</td>
                      <td><StatusBadge tone="info">{row.type}</StatusBadge></td>
                      <td>{row.actor}</td>
                      <td><StatusBadge tone={memberStatusTone(row.status)}>{row.status}</StatusBadge></td>
                      <td className="signal-muted">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </Panel>
      )}

      <Notice tone="info">
        {locale === 'ru'
          ? 'Это event-scoped операционная лента на текущих данных. Полный old/new audit trail можно подключить позже отдельной таблицей без изменения маршрута.'
          : 'This is an event-scoped operational feed from current data. A full old/new audit trail can be added later without changing the route.'}
      </Notice>
    </div>
  );
}
