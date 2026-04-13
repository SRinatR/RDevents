'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

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

  const statusColors: Record<string, string> = {
    PUBLISHED: '#22c55e',
    DRAFT: '#f59e0b',
    CANCELLED: '#ef4444',
    COMPLETED: '#6366f1',
  };

  if (loading || !user || !isAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
              {t('admin.events')}
            </h1>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
              {isPlatformAdmin ? `${events.length} events total` : `${events.length} managed events`}
            </p>
          </div>
          {isPlatformAdmin && (
            <Link href={`/${locale}/admin/events/new`} style={{ padding: '12px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
              + {t('admin.createEvent')}
            </Link>
          )}
        </div>

        {/* Events table */}
        {eventsLoading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : events.length === 0 ? (
          <div style={{ padding: '48px', borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No events yet. Create your first event!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Title</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Registered</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{event.title}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{event.category}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', fontWeight: 700, background: statusColors[event.status] + '20', color: statusColors[event.status] }}>
                        {event.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      {new Date(event.startsAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      {event._count?.registrations ?? 0}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link href={`/${locale}/events/${event.slug}`} style={{ padding: '6px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                          View
                        </Link>
                        <Link href={`/${locale}/admin/events/${event.id}/edit`} style={{ padding: '6px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                          {t('common.edit')}
                        </Link>
                        {isPlatformAdmin && (
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={deletingId === event.id}
                            style={{ padding: '6px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid #ef4444', fontSize: '0.8rem', color: '#ef4444', background: 'transparent', cursor: 'pointer', opacity: deletingId === event.id ? 0.5 : 1 }}
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
