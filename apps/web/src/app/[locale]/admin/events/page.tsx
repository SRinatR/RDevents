'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, SectionHeader, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminEventsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'title'>('date_desc');
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<any | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadEvents = () => {
    setEventsLoading(true);
    adminApi.listEvents({ limit: 100 })
      .then((r) => setEvents(r.data))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  };

  useEffect(() => {
    if (user && isAdmin) loadEvents();
  }, [user, isAdmin]);

  const filteredEvents = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const filtered = events.filter((event) => {
      const statusPass = statusFilter === 'ALL' || event.status === statusFilter;
      const searchPass = !normalized
        || event.title?.toLowerCase().includes(normalized)
        || event.category?.toLowerCase().includes(normalized)
        || event.slug?.toLowerCase().includes(normalized);
      return statusPass && searchPass;
    });

    return filtered.sort((left, right) => {
      if (sortMode === 'title') return (left.title ?? '').localeCompare(right.title ?? '');
      const leftDate = new Date(left.startsAt).getTime();
      const rightDate = new Date(right.startsAt).getTime();
      return sortMode === 'date_asc' ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [events, search, statusFilter, sortMode]);

  const handleDelete = async () => {
    if (!isPlatformAdmin || !pendingDeleteEvent) return;
    setDeletingId(pendingDeleteEvent.id);
    try {
      await adminApi.deleteEvent(pendingDeleteEvent.id);
      setEvents((prev) => prev.filter((event) => event.id !== pendingDeleteEvent.id));
      setPendingDeleteEvent(null);
    } catch {
      alert('Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    PUBLISHED: 'success',
    DRAFT: 'warning',
    CANCELLED: 'danger',
    COMPLETED: 'info',
  };

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell">
      <PageHeader
        title={t('admin.events')}
        subtitle={isPlatformAdmin ? `${events.length} events total` : `${events.length} managed events`}
        actions={isPlatformAdmin ? <Link href={`/${locale}/admin/events/new`} className="btn btn-primary">{t('admin.createEvent')}</Link> : null}
      />

      <Panel>
        <SectionHeader title={locale === 'ru' ? 'Управление мероприятиями' : 'Event management workspace'} subtitle={locale === 'ru' ? 'Поиск, фильтрация и действия в едином реестре' : 'Search, filtering, and actions in one registry'} />

        <ToolbarRow>
          <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === 'ru' ? 'Поиск по названию, категории или slug' : 'Search by title, category, or slug'} className="admin-filter-search" />
          <FieldSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="admin-filter-select">
            <option value="ALL">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </FieldSelect>
          <FieldSelect value={sortMode} onChange={(event) => setSortMode(event.target.value as 'date_desc' | 'date_asc' | 'title')} className="admin-filter-sort">
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="title">Title A-Z</option>
          </FieldSelect>
          <StatusBadge tone="info">{filteredEvents.length} visible</StatusBadge>
        </ToolbarRow>

        {eventsLoading ? (
          <LoadingLines rows={6} />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'События не найдены' : 'No events found'}
            description={locale === 'ru' ? 'Измените фильтры или создайте новое событие.' : 'Adjust filters or create a new event.'}
            actions={isPlatformAdmin ? <Link href={`/${locale}/admin/events/new`} className="btn btn-secondary btn-sm">{t('admin.createEvent')}</Link> : undefined}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Registered</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event: any) => (
                  <tr key={event.id}>
                    <td>
                      <div className="admin-table-primary">
                        <strong>{event.title}</strong>
                        <div className="signal-muted">/{event.slug}</div>
                      </div>
                    </td>
                    <td>{event.category}</td>
                    <td><StatusBadge tone={toneByStatus[event.status] ?? 'info'}>{event.status}</StatusBadge></td>
                    <td>{new Date(event.startsAt).toLocaleDateString()}</td>
                    <td>{event._count?.registrations ?? 0}</td>
                    <td className="right">
                      <div className="signal-row-actions">
                        <Link href={`/${locale}/events/${event.slug}`} className="btn btn-ghost btn-sm">View</Link>
                        <Link href={`/${locale}/admin/events/${event.id}/edit`} className="btn btn-secondary btn-sm">{t('common.edit')}</Link>
                        {isPlatformAdmin && (
                          <button onClick={() => setPendingDeleteEvent(event)} className="btn btn-danger btn-sm" disabled={deletingId === event.id}>
                            {deletingId === event.id ? '...' : t('common.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>

      {pendingDeleteEvent && (
        <Panel className="signal-danger-zone admin-danger-panel">
          <SectionHeader title={locale === 'ru' ? 'Подтверждение удаления' : 'Deletion confirmation'} subtitle={pendingDeleteEvent.title} />
          <ToolbarRow>
            <button onClick={handleDelete} className="btn btn-danger btn-sm" disabled={Boolean(deletingId)}>{locale === 'ru' ? 'Подтвердить удаление' : 'Confirm delete'}</button>
            <button onClick={() => setPendingDeleteEvent(null)} className="btn btn-secondary btn-sm">{t('common.cancel')}</button>
          </ToolbarRow>
        </Panel>
      )}

      <Notice tone="info">
        {locale === 'ru' ? 'Фильтры и сортировка выполняются в клиенте поверх текущего набора данных API без изменения серверной логики.' : 'Filters and sorting run client-side on the current API dataset without changing backend logic.'}
      </Notice>
    </div>
  );
}
