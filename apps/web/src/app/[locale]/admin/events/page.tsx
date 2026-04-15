'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { StatusBadge } from '../../../../components/admin/StatusBadge';
import { EmptyState } from '../../../../components/admin/EmptyState';
import { SearchIcon, PlusIcon } from '../../../../components/admin/icons';

const STATUS_OPTIONS = ['ALL', 'PUBLISHED', 'DRAFT', 'CANCELLED', 'COMPLETED'] as const;

export default function AdminEventsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadEvents = () => {
    setEventsLoading(true);
    adminApi.listEvents({ limit: 100 })
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  };

  useEffect(() => {
    if (user && isAdmin) loadEvents();
  }, [user, isAdmin]);

  const handleDelete = async (id: string) => {
    if (!isPlatformAdmin) return;
    if (!confirm('Are you sure you want to delete this event?')) return;
    setDeletingId(id);
    try {
      await adminApi.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch {
      alert('Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    let result = events;
    if (statusFilter !== 'ALL') {
      result = result.filter(e => e.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(e => e.title?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q));
    }
    return result;
  }, [events, search, statusFilter]);

  if (loading || !user || !isAdmin) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div className="spinner" />
    </div>
  );

  const totalLabel = eventsLoading
    ? undefined
    : filteredEvents.length < events.length
      ? `${filteredEvents.length} of ${events.length} ${isPlatformAdmin ? 'events' : 'managed events'}`
      : `${events.length} ${isPlatformAdmin ? 'events total' : 'managed events'}`;

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.events')}
        description={totalLabel}
        actions={
          isPlatformAdmin ? (
            <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
              <PlusIcon /> {t('admin.createEvent')}
            </Link>
          ) : undefined
        }
      />

      <div className="admin-page-body">
        {/* Toolbar */}
        <div className="admin-toolbar" style={{ marginBottom: 20 }}>
          <div className="admin-search-wrap">
            <SearchIcon size={13} />
            <input
              className="admin-search-input"
              placeholder={locale === 'ru' ? 'Поиск событий...' : 'Search events...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? (locale === 'ru' ? 'Все статусы' : 'All statuses') : s}</option>
            ))}
          </select>
        </div>

        {eventsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="admin-skeleton" style={{ height: 56 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Событий нет' : 'No events yet'}
            description={locale === 'ru' ? 'Создайте первое событие.' : 'Create your first event to get started.'}
            action={
              isPlatformAdmin ? (
                <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
                  {t('admin.createEvent')}
                </Link>
              ) : undefined
            }
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет результатов' : 'No results'}
            description={locale === 'ru' ? 'Попробуйте изменить фильтры.' : 'Try adjusting your filters or search query.'}
          />
        ) : (
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                  <th>{locale === 'ru' ? 'Категория' : 'Category'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Участников' : 'Registered'}</th>
                  <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event: any) => (
                  <tr key={event.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                        {event.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {event.startsAt ? new Date(event.startsAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                    </td>
                    <td>
                      {event.category
                        ? <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle)', padding: '2px 7px', borderRadius: 4 }}>{event.category}</span>
                        : <span style={{ color: 'var(--color-text-faint)', fontSize: '0.82rem' }}>—</span>}
                    </td>
                    <td>
                      <StatusBadge status={event.status} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                      {(event._count?.registrations ?? 0).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link href={`/${locale}/events/${event.slug}`} className="btn-admin-secondary">
                          {locale === 'ru' ? 'Открыть' : 'View'}
                        </Link>
                        <Link href={`/${locale}/admin/events/${event.id}/edit`} className="btn-admin-secondary">
                          {t('common.edit')}
                        </Link>
                        {isPlatformAdmin && (
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={deletingId === event.id}
                            className="btn-admin-danger"
                          >
                            {deletingId === event.id ? '...' : t('common.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
