'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, MetricCard, Notice, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, memberStatusTone, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACTIVE', 'REJECTED', 'REMOVED'] as const;

export default function EventVolunteersPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');

    try {
      const [eventResult, volunteersResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventVolunteers(eventId, statusFilter === 'ALL' ? undefined : statusFilter),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setVolunteers(volunteersResult.volunteers ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load volunteers');
      setVolunteers([]);
    } finally {
      setLoadingData(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  const filteredVolunteers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return volunteers.filter((volunteer) => {
      if (!normalized) return true;
      return volunteer.user?.name?.toLowerCase().includes(normalized)
        || volunteer.user?.email?.toLowerCase().includes(normalized)
        || volunteer.notes?.toLowerCase().includes(normalized);
    });
  }, [volunteers, search]);

  const stats = useMemo(() => ({
    total: volunteers.length,
    pending: volunteers.filter((item) => item.status === 'PENDING').length,
    active: volunteers.filter((item) => item.status === 'ACTIVE').length,
    rejected: volunteers.filter((item) => item.status === 'REJECTED').length,
  }), [volunteers]);

  const updateStatus = async (memberId: string, nextStatus: 'ACTIVE' | 'REJECTED' | 'REMOVED') => {
    if (!eventId) return;
    setActionId(memberId);
    setError('');
    setSuccess('');

    try {
      await adminApi.updateVolunteerStatus(eventId, memberId, { status: nextStatus });
      setSuccess(locale === 'ru' ? 'Статус волонтёра обновлён.' : 'Volunteer status updated.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update volunteer');
    } finally {
      setActionId(null);
    }
  };

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Волонтёры события' : 'Event volunteers'}
        subtitle={event?.title}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего' : 'Total'} value={stats.total} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'Ожидают' : 'Pending'} value={stats.pending} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Активные' : 'Active'} value={stats.active} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Отклонены' : 'Rejected'} value={stats.rejected} />
          </div>

          <Panel variant="elevated" className="admin-command-panel admin-data-panel">
            <SectionHeader title={locale === 'ru' ? 'Заявки волонтёров' : 'Volunteer applications'} subtitle={locale === 'ru' ? 'Модерация волонтёров только выбранного события' : 'Moderate volunteers only for the selected event'} />

            <ToolbarRow>
              <FieldInput
                value={search}
                onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по имени, email или заметке' : 'Search by name, email, or note'}
                className="admin-filter-search"
              />
              <FieldSelect value={statusFilter} onChange={(selectEvent) => setStatusFilter(selectEvent.target.value as (typeof STATUS_FILTERS)[number])} className="admin-filter-select">
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>{status === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : status}</option>
                ))}
              </FieldSelect>
              <StatusBadge tone="info">{filteredVolunteers.length} {locale === 'ru' ? 'строк' : 'rows'}</StatusBadge>
            </ToolbarRow>

            {filteredVolunteers.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Заявок нет' : 'No volunteer applications'}
                description={locale === 'ru' ? 'Новые заявки волонтёров появятся здесь.' : 'New volunteer applications will appear here.'}
              />
            ) : (
              <TableShell>
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Волонтёр' : 'Volunteer'}</th>
                      <th>{locale === 'ru' ? 'Заметка' : 'Note'}</th>
                      <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                      <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                      <th className="right">{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVolunteers.map((volunteer) => (
                      <tr key={volunteer.id}>
                        <td>
                          <strong>{volunteer.user?.name ?? volunteer.user?.email ?? '—'}</strong>
                          <div className="signal-muted">{volunteer.user?.email}</div>
                        </td>
                        <td className="signal-overflow-ellipsis">{volunteer.notes ?? '—'}</td>
                        <td><StatusBadge tone={memberStatusTone(volunteer.status)}>{volunteer.status}</StatusBadge></td>
                        <td className="signal-muted">{formatAdminDateTime(volunteer.assignedAt, locale)}</td>
                        <td className="right">
                          <div className="signal-row-actions">
                            {volunteer.status === 'PENDING' ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={actionId === volunteer.id} onClick={() => updateStatus(volunteer.id, 'ACTIVE')}>{locale === 'ru' ? 'Одобрить' : 'Approve'}</button>
                                <button type="button" className="btn btn-danger btn-sm" disabled={actionId === volunteer.id} onClick={() => updateStatus(volunteer.id, 'REJECTED')}>{locale === 'ru' ? 'Отклонить' : 'Reject'}</button>
                              </>
                            ) : null}
                            {volunteer.status === 'ACTIVE' ? (
                              <button type="button" className="btn btn-ghost btn-sm" disabled={actionId === volunteer.id} onClick={() => updateStatus(volunteer.id, 'REMOVED')}>{locale === 'ru' ? 'Убрать' : 'Remove'}</button>
                            ) : null}
                          </div>
                        </td>
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
