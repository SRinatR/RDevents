'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, FieldInput, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function EventTeamsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');

    try {
      const [eventResult, teamsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventTeams(eventId),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setTeams(teamsResult.teams ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load teams');
      setTeams([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const filteredTeams = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return teams;
    return teams.filter((team) => team.name?.toLowerCase().includes(normalized)
      || team.captainUser?.name?.toLowerCase().includes(normalized)
      || team.captainUser?.email?.toLowerCase().includes(normalized));
  }, [teams, search]);

  const activeTeams = teams.filter((team) => (team.status ?? 'ACTIVE') === 'ACTIVE').length;
  const totalMembers = teams.reduce((sum, team) => sum + Number(team._count?.members ?? team.members?.length ?? 0), 0);
  const teamsWithCaptain = teams.filter((team) => team.captainUser).length;

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Команды события' : 'Event teams'}
        subtitle={event?.title}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего команд' : 'Total teams'} value={teams.length} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Активные' : 'Active'} value={activeTeams} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Участники в командах' : 'Team members'} value={totalMembers} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'С капитаном' : 'With captain'} value={teamsWithCaptain} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader title={locale === 'ru' ? 'Состав команд' : 'Team roster'} subtitle={locale === 'ru' ? 'Команды, капитаны и размер состава' : 'Teams, captains, and roster size'} />

            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по команде или капитану' : 'Search by team or captain'}
                className="admin-filter-search"
              />
              <StatusBadge tone="info">{filteredTeams.length} {locale === 'ru' ? 'строк' : 'rows'}</StatusBadge>
            </ToolbarRow>

            {filteredTeams.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Команд нет' : 'No teams'}
                description={locale === 'ru' ? 'Команды появятся после создания участниками.' : 'Teams will appear after participants create them.'}
              />
            ) : (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Команда' : 'Team'}</th>
                      <th>{locale === 'ru' ? 'Капитан' : 'Captain'}</th>
                      <th>{locale === 'ru' ? 'Участников' : 'Members'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Создана' : 'Created'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => (
                      <tr key={team.id}>
                        <td>
                          <strong>{team.name}</strong>
                          {team.description ? <div className="signal-muted signal-overflow-ellipsis">{team.description}</div> : null}
                        </td>
                        <td>
                          <strong>{team.captainUser?.name ?? '—'}</strong>
                          {team.captainUser?.email ? <div className="signal-muted">{team.captainUser.email}</div> : null}
                        </td>
                        <td><StatusBadge tone="info">{team._count?.members ?? team.members?.length ?? 0}</StatusBadge></td>
                        <td><StatusBadge tone={(team.status ?? 'ACTIVE') === 'ACTIVE' ? 'success' : 'neutral'}>{team.status ?? 'ACTIVE'}</StatusBadge></td>
                        <td className="signal-muted">{formatAdminDateTime(team.createdAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
