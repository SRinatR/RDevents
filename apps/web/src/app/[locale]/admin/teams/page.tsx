'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi, adminExportsApi } from '@/lib/api';
import { downloadCsv, formatCsvDate } from '@/lib/exportCsv';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

interface Team {
  id: string;
  name: string;
  eventId: string;
  eventTitle: string;
  captainUserId: string | null;
  captainUserName: string | null;
  membersCount: number;
  status: string;
  createdAt: string;
}

interface EventsOption {
  id: string;
  title: string;
}

export default function AdminTeamsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<EventsOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const search = searchParams.get('search') ?? '';
  const eventFilter = searchParams.get('eventId') ?? 'ALL';
  const statusFilter = searchParams.get('status') ?? 'ALL';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete('page');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const goToPage = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    
    adminApi.listEvents({ limit: 100 })
      .then((result) => {
        setEvents(result.data.map((e: any) => ({ id: e.id, title: e.title })));
      })
      .catch(() => setEvents([]));
  }, [user, isAdmin]);

  const fetchTeams = useCallback(async () => {
    if (!user || !isAdmin) return;

    setLoadingData(true);
    try {
      const result = await adminApi.listTeams({
        search: debouncedSearch || undefined,
        eventId: eventFilter !== 'ALL' ? eventFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        limit: 50,
      });
      setTeams(result.data);
      setTotalPages(result.meta.pages);
    } catch {
      setTeams([]);
    } finally {
      setLoadingData(false);
    }
  }, [user, isAdmin, debouncedSearch, eventFilter, statusFilter, page]);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  const handleArchiveTeam = async (teamId: string) => {
    if (!confirm(locale === 'ru'
      ? 'Архивировать команду? Она исчезнет из списка по умолчанию, но история и профили участников сохранятся.'
      : 'Archive this team? It will disappear from the default list, but team history and user profiles will remain.'
    )) {
      return;
    }

    setRemovingId(teamId);
    try {
      await adminApi.archiveTeam(teamId);
      await fetchTeams();
    } catch {
      alert(locale === 'ru' ? 'Не удалось архивировать команду' : 'Failed to archive team');
    } finally {
      setRemovingId(null);
    }
  };

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    ACTIVE: 'success',
    PENDING: 'warning',
    CHANGES_PENDING: 'info',
    DRAFT: 'neutral',
    REJECTED: 'danger',
    ARCHIVED: 'neutral',
  };

  const exportTeamRows = (entries: Team[]) => {
    downloadCsv(`admin-teams-${new Date().toISOString().slice(0, 10)}.csv`, entries.map((team) => ({
      id: team.id,
      name: team.name,
      eventId: team.eventId,
      eventTitle: team.eventTitle,
      captainUserId: team.captainUserId || '',
      captainUserName: team.captainUserName || '',
      membersCount: team.membersCount,
      status: team.status,
      createdAt: formatCsvDate(team.createdAt, locale),
    })));
  };

  const handleExportTeams = async () => {
    setExporting(true);
    try {
      const result = await adminApi.listTeams({
        search: debouncedSearch || undefined,
        eventId: eventFilter !== 'ALL' ? eventFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page: 1,
        limit: 1000,
      });
      exportTeamRows(result.data || []);
    } catch {
      exportTeamRows(teams);
    } finally {
      setExporting(false);
    }
  };

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
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по названию команды...' : 'Search by team name...'}
            className="admin-filter-search"
          />
          <FieldSelect value={eventFilter} onChange={(e) => updateFilter('eventId', e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все события' : 'All events'}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </FieldSelect>
          <FieldSelect value={statusFilter} onChange={(e) => updateFilter('status', e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Активные по умолчанию' : 'Active by default'}</option>
            <option value="DRAFT">{locale === 'ru' ? 'Черновик' : 'Draft'}</option>
            <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="PENDING">{locale === 'ru' ? 'На проверке' : 'Pending'}</option>
            <option value="CHANGES_PENDING">{locale === 'ru' ? 'Изменения на проверке' : 'Changes pending'}</option>
            <option value="SUBMITTED">{locale === 'ru' ? 'Отправлены' : 'Submitted'}</option>
            <option value="REJECTED">{locale === 'ru' ? 'Отклонённые' : 'Rejected'}</option>
            <option value="ARCHIVED">{locale === 'ru' ? 'Архивные' : 'Archived'}</option>
          </FieldSelect>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleExportTeams()} disabled={teams.length === 0 || exporting}>
            {exporting ? (locale === 'ru' ? 'Готовим...' : 'Preparing...') : (locale === 'ru' ? 'Выгрузить CSV' : 'Export CSV')}
          </button>
          {eventFilter !== 'ALL' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void adminExportsApi.downloadTeams(eventFilter, 'csv', {
                  ...(statusFilter !== 'ALL' ? { status: [statusFilter] } : {}),
                  includeArchived: statusFilter === 'ARCHIVED',
                  includeRejected: statusFilter === 'REJECTED',
                })}
              >
                {locale === 'ru' ? 'Полная выгрузка команд CSV' : 'Full teams CSV'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void adminExportsApi.downloadTeamMembers(eventFilter, 'csv', {
                  ...(statusFilter !== 'ALL' ? { status: [statusFilter] } : {}),
                  includeArchived: statusFilter === 'ARCHIVED',
                  includeRejected: statusFilter === 'REJECTED',
                })}
              >
                {locale === 'ru' ? 'Составы команд CSV' : 'Team members CSV'}
              </button>
            </>
          )}
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={6} />
        ) : teams.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет команд' : 'No teams'}
            description={locale === 'ru' ? 'Команды будут созданы участниками событий.' : 'Teams will be created by event participants.'}
          />
        ) : (
          <>
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
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <td><strong>{team.name}</strong></td>
                      <td className="signal-muted signal-overflow-ellipsis">{team.eventTitle}</td>
                      <td>{team.captainUserName ?? '—'}</td>
                      <td>{team.membersCount}</td>
                      <td><StatusBadge tone={toneByStatus[team.status] ?? 'neutral'}>{formatTeamStatus(team.status, locale)}</StatusBadge></td>
                      <td className="signal-muted">{new Date(team.createdAt).toLocaleDateString()}</td>
                      <td className="right">
                        <div className="signal-row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => router.push(`/${locale}/admin/teams/${team.id}`)}
                          >
                            {locale === 'ru' ? 'Просмотр' : 'View'}
                          </button>
                          {team.captainUserId && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => router.push(`/${locale}/admin/users/${team.captainUserId}?eventId=${team.eventId}`)}
                            >
                              {locale === 'ru' ? 'Профиль' : 'Profile'}
                            </button>
                          )}
                          {team.status !== 'ARCHIVED' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleArchiveTeam(team.id)}
                              disabled={removingId === team.id}
                            >
                              {removingId === team.id ? '...' : (locale === 'ru' ? 'Архивировать' : 'Archive')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
            
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >
                  ← {locale === 'ru' ? 'Назад' : 'Prev'}
                </button>
                <span className="signal-muted">
                  {page} / {totalPages}
                </span>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >
                  {locale === 'ru' ? 'Вперёд' : 'Next'} →
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function formatTeamStatus(status: string, locale: string) {
  const ru: Record<string, string> = {
    DRAFT: 'Черновик',
    PENDING: 'На проверке',
    CHANGES_PENDING: 'Изменения на проверке',
    ACTIVE: 'Активна',
    REJECTED: 'Отклонена',
    ARCHIVED: 'Архив',
  };
  const en: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    CHANGES_PENDING: 'Changes pending',
    ACTIVE: 'Active',
    REJECTED: 'Rejected',
    ARCHIVED: 'Archived',
  };
  return (locale === 'ru' ? ru : en)[status] ?? status;
}
