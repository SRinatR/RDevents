'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminTeamsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    adminApi.listEvents({ limit: 100 })
      .then(async (eventsResult) => {
        const teams: any[] = [];
        for (const event of eventsResult.data) {
          try {
            const teamsData = await adminApi.listEventTeams(event.id);
            teams.push(...teamsData.teams.map((team: any) => ({
              ...team,
              eventTitle: event.title,
            })));
          } catch {
            // skip
          }
        }
        setAllTeams(teams);
      })
      .catch(() => setAllTeams([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  const filteredTeams = allTeams.filter((team) => {
    const searchPass = !search || 
      team.name?.toLowerCase().includes(search.toLowerCase()) ||
      team.eventTitle?.toLowerCase().includes(search.toLowerCase());
    const statusPass = statusFilter === 'ALL' || team.status === statusFilter;
    return searchPass && statusPass;
  });

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.teams') ?? 'Teams'}
        subtitle={locale === 'ru' ? 'Управление командами' : 'Team management'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <FieldInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по названию команды...' : 'Search by team name...'}
            className="admin-filter-search"
          />
          <FieldSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="COMPLETED">{locale === 'ru' ? 'Завершённые' : 'Completed'}</option>
            <option value="ARCHIVED">{locale === 'ru' ? 'Архивные' : 'Archived'}</option>
          </FieldSelect>
          <StatusBadge tone="info">{filteredTeams.length} {locale === 'ru' ? 'команд' : 'teams'}</StatusBadge>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет команд' : 'No teams'}
            description={locale === 'ru' ? 'Команды будут созданы участниками событий.' : 'Teams will be created by event participants.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название команды' : 'Team name'}</th>
                  <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                  <th>{locale === 'ru' ? 'Капитан' : 'Captain'}</th>
                  <th>{locale === 'ru' ? 'Участников' : 'Members'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Создано' : 'Created'}</th>
                  <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.id}>
                    <td><strong>{team.name}</strong></td>
                    <td className="signal-muted signal-overflow-ellipsis">{team.eventTitle}</td>
                    <td>{team.captainUser?.name ?? '—'}</td>
                    <td><StatusBadge tone="info">{team._count?.members ?? team.members?.length ?? 0}</StatusBadge></td>
                    <td><StatusBadge tone="success">{team.status ?? 'ACTIVE'}</StatusBadge></td>
                    <td className="signal-muted">{new Date(team.createdAt).toLocaleDateString()}</td>
                    <td className="right">
                      <div className="signal-row-actions">
                        <button className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Просмотр' : 'View'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}