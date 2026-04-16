'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
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

  // URL-synced state
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<EventsOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  // Filters from URL
  const search = searchParams.get('search') ?? '';
  const eventFilter = searchParams.get('eventId') ?? 'ALL';
  const statusFilter = searchParams.get('status') ?? 'ALL';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Update URL with filter
  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== 'page') params.delete('page');
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Load events for filter dropdown
  useEffect(() => {
    if (!user || !isAdmin) return;
    
    adminApi.listEvents({ limit: 100 })
      .then((result) => {
        setEvents(result.data.map((e: any) => ({ id: e.id, title: e.title })));
      })
      .catch(() => setEvents([]));
  }, [user, isAdmin]);

  // Load teams with unified endpoint (no N+1!)
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
    fetchTeams();
  }, [fetchTeams]);

  // Status colors - fixed mapping
  const toneByStatus: Record<string, 'success' | 'warning' | 'neutral'> = {
    ACTIVE: 'success',
    COMPLETED: 'neutral',
    ARCHIVED: 'warning',
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
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="COMPLETED">{locale === 'ru' ? 'Завершённые' : 'Completed'}</option>
            <option value="ARCHIVED">{locale === 'ru' ? 'Архивные' : 'Archived'}</option>
          </FieldSelect>
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
                      <td><StatusBadge tone="info">{team.membersCount}</StatusBadge></td>
                      <td><StatusBadge tone={toneByStatus[team.status] ?? 'neutral'}>{team.status ?? 'ACTIVE'}</StatusBadge></td>
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
            
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => updateFilter('page', String(page - 1))}
                  disabled={page === 1}
                >
                  ← {locale === 'ru' ? 'Назад' : 'Prev'}
                </button>
                <span className="signal-muted">
                  {page} / {totalPages}
                </span>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => updateFilter('page', String(page + 1))}
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
