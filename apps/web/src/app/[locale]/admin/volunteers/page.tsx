'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'REMOVED'] as const;

export default function AdminVolunteersPage() {
  const t = useTranslations();
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    setLoadingData(true);
    adminApi.listEvents({ limit: 100 })
      .then(result => {
        setEvents(result.data);
        setSelectedEventId(result.data[0]?.id ?? '');
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingData(false));
  }, [user, isAdmin]);

  const loadVolunteers = useCallback(() => {
    if (!selectedEventId) return;
    setLoadingVolunteers(true);
    adminApi.listEventVolunteers(selectedEventId, status)
      .then(result => setVolunteers(result.volunteers))
      .catch(() => setVolunteers([]))
      .finally(() => setLoadingVolunteers(false));
  }, [selectedEventId, status]);

  useEffect(() => {
    loadVolunteers();
  }, [loadVolunteers]);

  async function updateStatus(memberId: string, nextStatus: 'APPROVED' | 'REJECTED') {
    setActionId(memberId);
    try {
      await adminApi.updateVolunteerStatus(selectedEventId, memberId, { status: nextStatus });
      loadVolunteers();
    } finally {
      setActionId(null);
    }
  }

  if (loading || !user || !isAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('admin.volunteers')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Review volunteer applications for events you manage.
          </p>
        </div>

        {loadingData ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 48, borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No manageable events yet.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <select
                value={selectedEventId}
                onChange={event => setSelectedEventId(event.target.value)}
                style={{ minWidth: 280, height: 42, padding: '0 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'white', fontWeight: 700 }}
              >
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>

              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
                style={{ height: 42, padding: '0 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'white', fontWeight: 700 }}
              >
                {STATUS_FILTERS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>

              {selectedEventId && (
                <Link href={`/${locale}/admin/events/${selectedEventId}/edit`} style={{ display: 'inline-flex', alignItems: 'center', height: 42, padding: '0 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontWeight: 700 }}>
                  {t('common.edit')} event
                </Link>
              )}
            </div>

            {loadingVolunteers ? (
              <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
            ) : volunteers.length === 0 ? (
              <div style={{ padding: 40, borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No volunteer requests with status {status}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {volunteers.map((membership: any) => (
                  <article key={membership.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>
                      {membership.user?.avatarUrl ? <img src={membership.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : membership.user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <strong>{membership.user?.name}</strong>
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-lg)', background: 'rgba(28,100,242,0.08)', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 800 }}>
                          {membership.status}
                        </span>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{membership.user?.email}</div>
                      {membership.notes && <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{membership.notes}</p>}
                    </div>
                    {membership.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => updateStatus(membership.id, 'APPROVED')} disabled={actionId === membership.id} style={{ padding: '8px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid #16a34a', background: '#16a34a', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: actionId === membership.id ? 0.6 : 1 }}>
                          Approve
                        </button>
                        <button onClick={() => updateStatus(membership.id, 'REJECTED')} disabled={actionId === membership.id} style={{ padding: '8px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-danger)', background: 'white', color: 'var(--color-danger)', fontWeight: 800, cursor: 'pointer', opacity: actionId === membership.id ? 0.6 : 1 }}>
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
