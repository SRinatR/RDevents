'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { StatusBadge } from '../../../../components/admin/StatusBadge';
import { EmptyState } from '../../../../components/admin/EmptyState';

export default function AdminEventsPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  if (loading || !user || !isAdmin) return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  const countLabel = isPlatformAdmin
    ? `${events.length} events total`
    : `${events.length} managed events`;

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.events')}
        description={eventsLoading ? undefined : countLabel}
        actions={
          isPlatformAdmin ? (
            <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
              {t('admin.createEvent')}
            </Link>
          ) : undefined
        }
      />

      <div className="admin-page-body">
        {eventsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="admin-skeleton" style={{ height: 48 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No events yet"
            description="Create your first event to get started."
            action={
              isPlatformAdmin ? (
                <Link href={`/${locale}/admin/events/new`} className="btn-admin-primary">
                  {t('admin.createEvent')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Название' : 'Title'}</th>
                  <th>{locale === 'ru' ? 'Категория' : 'Category'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                  <th>{locale === 'ru' ? 'Дата' : 'Date'}</th>
                  <th>{locale === 'ru' ? 'Участников' : 'Registered'}</th>
                  <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {event.title}
                      </span>
                    </td>
                    <td>{event.category ?? '—'}</td>
                    <td>
                      <StatusBadge status={event.status} />
                    </td>
                    <td>{new Date(event.startsAt).toLocaleDateString()}</td>
                    <td>{event._count?.registrations ?? 0}</td>
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
