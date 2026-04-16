'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

interface Participant {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  eventId: string;
  eventTitle: string;
  role: string;
  status: string;
  assignedAt: string;
}

interface EventsOption {
  id: string;
  title: string;
}

export default function AdminParticipantsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const locale = useRouteLocale();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [events, setEvents] = useState<EventsOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchParticipants = useCallback(async () => {
    if (!user || !isAdmin) return;

    try {
      const result = await adminApi.listParticipants({
        search: search || undefined,
        eventId: eventFilter !== 'ALL' ? eventFilter : undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        limit: 50,
      });
      setParticipants(result.data);
      setTotalPages(result.meta.pages);
    } catch {
      setParticipants([]);
    } finally {
      setLoadingData(false);
    }
  }, [user, isAdmin, search, eventFilter, roleFilter, statusFilter, page]);

  // Load events for filter dropdown
  useEffect(() => {
    if (!user || !isAdmin) return;
    
    adminApi.listEvents({ limit: 100 })
      .then((result) => {
        setEvents(result.data.map((e: any) => ({ id: e.id, title: e.title })));
      })
      .catch(() => setEvents([]));
  }, [user, isAdmin]);

  // Load participants with unified endpoint (no N+1!)
  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchParticipants();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    ACTIVE: 'success',
    PENDING: 'warning',
    REJECTED: 'danger',
    REMOVED: 'neutral',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.participants') ?? 'Participants'}
        subtitle={locale === 'ru' ? 'Все участия и регистрации' : 'All participations and registrations'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <FieldInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'}
            className="admin-filter-search"
          />
          <FieldSelect value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setPage(1); }} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все события' : 'All events'}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </FieldSelect>
          <FieldSelect value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все роли' : 'All roles'}</option>
            <option value="PARTICIPANT">{locale === 'ru' ? 'Участник' : 'Participant'}</option>
            <option value="VOLUNTEER">{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</option>
          </FieldSelect>
          <FieldSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
            <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="PENDING">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
            <option value="REJECTED">{locale === 'ru' ? 'Отклонённые' : 'Rejected'}</option>
            <option value="REMOVED">{locale === 'ru' ? 'Удалённые' : 'Removed'}</option>
          </FieldSelect>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : participants.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет участников' : 'No participants'}
            description={locale === 'ru' ? 'Участники появятся после регистраций на события.' : 'Participants will appear after event registrations.'}
          />
        ) : (
          <>
            <TableShell>
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>{locale === 'ru' ? 'Пользователь' : 'User'}</th>
                    <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                    <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                    <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                    <th>{locale === 'ru' ? 'Зарегистрирован' : 'Registered'}</th>
                    <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.userName ?? '—'}</strong>
                        <div className="signal-muted">{p.userEmail}</div>
                      </td>
                      <td className="signal-overflow-ellipsis">{p.eventTitle}</td>
                      <td><StatusBadge tone="info">{p.role}</StatusBadge></td>
                      <td><StatusBadge tone={toneByStatus[p.status] ?? 'neutral'}>{p.status}</StatusBadge></td>
                      <td className="signal-muted">{new Date(p.assignedAt).toLocaleDateString()}</td>
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
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← {locale === 'ru' ? 'Назад' : 'Prev'}
                </button>
                <span className="signal-muted">
                  {page} / {totalPages}
                </span>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
