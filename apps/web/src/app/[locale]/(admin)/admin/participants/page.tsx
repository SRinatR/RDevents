'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi, adminExportsApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  EmptyState,
  FieldInput,
  FieldSelect,
  LoadingLines,
  Panel,
  StatusBadge,
} from '@/components/ui/signal-primitives';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableActions,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';

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

const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  RESERVE: 'info',
  REJECTED: 'danger',
  REMOVED: 'neutral',
  CANCELLED: 'neutral',
};

const EXCLUDED_STATUSES = ['REJECTED', 'CANCELLED', 'REMOVED'];

export default function AdminParticipantsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [events, setEvents] = useState<EventsOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const searchFromUrl = searchParams.get('search') ?? '';
  const eventFilter = searchParams.get('eventId') ?? 'ALL';
  const roleFilter = searchParams.get('role') ?? 'ALL';
  const statusFilter = searchParams.get('status') ?? 'ALL';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [rawSearch, setRawSearch] = useState(searchFromUrl);

  useEffect(() => {
    setRawSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('search') ?? '';
      const next = rawSearch.trim();
      if (next === current) return;

      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set('search', next);
      } else {
        params.delete('search');
      }
      params.delete('page');
      router.replace(`?${params.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timer);
  }, [rawSearch, searchParams, router]);

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

  const fetchParticipants = useCallback(async () => {
    if (!user || !isAdmin) return;

    setLoadingData(true);
    try {
      const result = await adminApi.listParticipants({
        search: searchFromUrl || undefined,
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
  }, [user, isAdmin, searchFromUrl, eventFilter, roleFilter, statusFilter, page]);

  useEffect(() => {
    void fetchParticipants();
  }, [fetchParticipants]);

  const handleRejectParticipant = async (eventId: string, memberId: string) => {
    if (!confirm(t('admin.participantActions.confirmReject'))) {
      return;
    }

    const notesRaw = locale === 'ru' ? prompt('Комментарий (необязательно)') : prompt('Comment (optional)');
    const notes = notesRaw?.trim() || undefined;

    setActionLoadingId(memberId);
    try {
      await adminApi.rejectParticipant(eventId, memberId, notes);
      await fetchParticipants();
    } catch {
      alert(t('admin.participantActions.error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveParticipant = async (eventId: string, memberId: string) => {
    if (!confirm(t('admin.participantActions.confirmRemove'))) {
      return;
    }

    const notesRaw = locale === 'ru' ? prompt('Причина удаления (необязательно)') : prompt('Removal reason (optional)');
    const notes = notesRaw?.trim() || undefined;

    setActionLoadingId(memberId);
    try {
      await adminApi.removeParticipant(eventId, memberId, notes);
      await fetchParticipants();
    } catch {
      alert(t('admin.participantActions.error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    const key = `admin.roles.${role}` as const;
    const translated = t(key as any);
    return translated === key ? role : translated;
  };

  const getStatusLabel = (status: string) => {
    const key = `admin.statuses.${status}` as const;
    const translated = t(key as any);
    return translated === key ? status : translated;
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.participants') ?? 'Participants'}
        subtitle={locale === 'ru' ? 'Участники событий' : 'Event participants'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <AdminToolbar
          actions={
            eventFilter !== 'ALL' ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void adminExportsApi.downloadParticipants(eventFilter, 'csv', {
                    ...(statusFilter !== 'ALL' ? { status: [statusFilter] } : {}),
                    includeRejected: statusFilter === 'REJECTED',
                    includeCancelled: statusFilter === 'CANCELLED',
                    includeRemoved: statusFilter === 'REMOVED',
                  })}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void adminExportsApi.downloadParticipants(eventFilter, 'json', {
                    ...(statusFilter !== 'ALL' ? { status: [statusFilter] } : {}),
                    includeRejected: statusFilter === 'REJECTED',
                    includeCancelled: statusFilter === 'CANCELLED',
                    includeRemoved: statusFilter === 'REMOVED',
                  })}
                >
                  JSON
                </button>
              </>
            ) : null
          }
        >
          <FieldInput
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'}
            className="admin-filter-search admin-toolbar-search"
          />
          <FieldSelect
            value={eventFilter}
            onChange={(e) => updateFilter('eventId', e.target.value)}
            className="admin-filter-select admin-toolbar-select"
          >
            <option value="ALL">{locale === 'ru' ? 'Все события' : 'All events'}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </FieldSelect>
          <FieldSelect
            value={roleFilter}
            onChange={(e) => updateFilter('role', e.target.value)}
            className="admin-filter-select admin-toolbar-select"
          >
            <option value="ALL">{locale === 'ru' ? 'Все роли' : 'All roles'}</option>
            <option value="PARTICIPANT">{locale === 'ru' ? 'Участник' : 'Participant'}</option>
            <option value="VOLUNTEER">{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</option>
          </FieldSelect>
          <FieldSelect
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="admin-filter-select admin-toolbar-select"
          >
            <option value="ALL">{locale === 'ru' ? 'Активные по умолчанию' : 'Active by default'}</option>
            <option value="ACTIVE">{locale === 'ru' ? 'Активные' : 'Active'}</option>
            <option value="PENDING">{locale === 'ru' ? 'В ожидании' : 'Pending'}</option>
            <option value="RESERVE">{locale === 'ru' ? 'В резерве' : 'Reserve'}</option>
            <option value="REJECTED">{locale === 'ru' ? 'Отклонённые' : 'Rejected'}</option>
            <option value="CANCELLED">{locale === 'ru' ? 'Отменённые' : 'Cancelled'}</option>
            <option value="REMOVED">{locale === 'ru' ? 'Удалённые админом' : 'Removed by admin'}</option>
          </FieldSelect>
        </AdminToolbar>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : participants.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет участников' : 'No participants'}
            description={locale === 'ru' ? 'Участники появятся после регистраций на события.' : 'Participants will appear after event registrations.'}
          />
        ) : (
          <>
            <div className="admin-table-mobile-cards">
              <AdminDataTable minWidth={980}>
                <AdminDataTableHeader
                  columns={[
                    { label: locale === 'ru' ? 'Пользователь' : 'User', width: '24%' },
                    { label: locale === 'ru' ? 'Событие' : 'Event', width: '24%' },
                    { label: locale === 'ru' ? 'Роль' : 'Role', width: '13%' },
                    { label: locale === 'ru' ? 'Статус' : 'Status', width: '13%' },
                    { label: locale === 'ru' ? 'Дата' : 'Date', width: '12%' },
                    { label: locale === 'ru' ? 'Действия' : 'Actions', align: 'right', width: '14%' },
                  ]}
                />
                <AdminDataTableBody>
                  {participants.map((p) => {
                    const canPerformAction = !EXCLUDED_STATUSES.includes(p.status);
                    return (
                      <AdminDataTableRow key={p.id}>
                        <AdminDataTableCell>
                          <AdminTableCellMain title={p.userName ?? '—'} subtitle={p.userEmail} />
                        </AdminDataTableCell>
                        <AdminDataTableCell truncate>{p.eventTitle}</AdminDataTableCell>
                        <AdminDataTableCell>
                          <StatusBadge tone={p.role === 'VOLUNTEER' ? 'info' : 'neutral'}>
                            {getRoleLabel(p.role)}
                          </StatusBadge>
                        </AdminDataTableCell>
                        <AdminDataTableCell>
                          <StatusBadge tone={toneByStatus[p.status] ?? 'neutral'}>
                            {getStatusLabel(p.status)}
                          </StatusBadge>
                        </AdminDataTableCell>
                        <AdminDataTableCell className="signal-muted">
                          {new Date(p.assignedAt).toLocaleDateString()}
                        </AdminDataTableCell>
                        <AdminDataTableCell align="right">
                          <AdminTableActions>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => router.push(`/${locale}/admin/users/${p.userId}?eventId=${p.eventId}`)}
                            >
                              {t('admin.participantActions.view')}
                            </button>
                            {canPerformAction ? (
                              <>
                                <button
                                  className="btn btn-warning btn-sm"
                                  onClick={() => void handleRejectParticipant(p.eventId, p.id)}
                                  disabled={actionLoadingId === p.id}
                                >
                                  {actionLoadingId === p.id ? '...' : t('admin.participantActions.reject')}
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void handleRemoveParticipant(p.eventId, p.id)}
                                  disabled={actionLoadingId === p.id}
                                >
                                  {actionLoadingId === p.id ? '...' : t('admin.participantActions.remove')}
                                </button>
                              </>
                            ) : null}
                          </AdminTableActions>
                        </AdminDataTableCell>
                      </AdminDataTableRow>
                    );
                  })}
                </AdminDataTableBody>
              </AdminDataTable>

              <AdminMobileList>
                {participants.map((p) => {
                  const canPerformAction = !EXCLUDED_STATUSES.includes(p.status);
                  return (
                    <AdminMobileCard
                      key={p.id}
                      title={p.userName ?? '—'}
                      subtitle={p.userEmail}
                      badge={
                        <StatusBadge tone={toneByStatus[p.status] ?? 'neutral'}>
                          {getStatusLabel(p.status)}
                        </StatusBadge>
                      }
                      meta={[
                        { label: locale === 'ru' ? 'Событие' : 'Event', value: p.eventTitle },
                        { label: locale === 'ru' ? 'Роль' : 'Role', value: getRoleLabel(p.role) },
                        { label: locale === 'ru' ? 'Дата' : 'Date', value: new Date(p.assignedAt).toLocaleDateString() },
                      ]}
                      actions={
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => router.push(`/${locale}/admin/users/${p.userId}?eventId=${p.eventId}`)}
                          >
                            {t('admin.participantActions.view')}
                          </button>
                          {canPerformAction ? (
                            <>
                              <button
                                className="btn btn-warning btn-sm"
                                onClick={() => void handleRejectParticipant(p.eventId, p.id)}
                                disabled={actionLoadingId === p.id}
                              >
                                {actionLoadingId === p.id ? '...' : t('admin.participantActions.reject')}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => void handleRemoveParticipant(p.eventId, p.id)}
                                disabled={actionLoadingId === p.id}
                              >
                                {actionLoadingId === p.id ? '...' : t('admin.participantActions.remove')}
                              </button>
                            </>
                          ) : null}
                        </>
                      }
                    />
                  );
                })}
              </AdminMobileList>
            </div>

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
