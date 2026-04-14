'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function AdminAdminsPage() {
  const t = useTranslations();
  const { user, loading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [platformAdmins, setPlatformAdmins] = useState<any[]>([]);
  const [eventAdmins, setEventAdmins] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) router.push(`/${locale}`);
  }, [user, loading, isSuperAdmin, router, locale]);

  async function loadData() {
    setLoadingData(true);
    setError('');
    try {
      const [adminsResult, eventsResult] = await Promise.all([
        adminApi.listAdmins(),
        adminApi.listEvents({ limit: 100 }),
      ]);
      setPlatformAdmins(adminsResult.platformAdmins ?? adminsResult.admins ?? []);
      setEventAdmins(adminsResult.eventAdmins ?? []);
      setEvents(eventsResult.data);
      setSelectedEventId(current => current || eventsResult.data[0]?.id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (user && isSuperAdmin) loadData();
  }, [user, isSuperAdmin]);

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!selectedEventId || !email.trim()) return;
    setActionId('assign');
    setError('');
    setSuccess('');
    try {
      await adminApi.assignEventAdmin(selectedEventId, { email: email.trim(), notes: notes.trim() || undefined });
      setEmail('');
      setNotes('');
      setSuccess('Event admin assigned');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign event admin');
    } finally {
      setActionId(null);
    }
  }

  async function handleRemoveEventAdmin(membership: any) {
    if (!confirm('Remove this event admin assignment?')) return;
    setActionId(membership.id);
    setError('');
    try {
      await adminApi.removeEventAdmin(membership.eventId, membership.userId);
      setEventAdmins(prev => prev.filter(item => item.id !== membership.id));
    } catch (err: any) {
      setError(err.message || 'Failed to remove event admin');
    } finally {
      setActionId(null);
    }
  }

  async function handleRemovePlatformAdmin(userId: string) {
    if (!confirm('Remove platform admin role from this user?')) return;
    setActionId(userId);
    setError('');
    try {
      await adminApi.updateUserRole(userId, 'USER');
      setPlatformAdmins(prev => prev.filter(admin => admin.id !== userId));
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setActionId(null);
    }
  }

  if (loading || !user || !isSuperAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('admin.admins')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Event-scoped admins and platform admins
          </p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {loadingData ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 32 }}>
            <section style={{ padding: 22, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 800 }}>Assign event admin</h2>
              <form onSubmit={handleAssign} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(220px, 1fr)', gap: 12 }}>
                <select
                  value={selectedEventId}
                  onChange={event => setSelectedEventId(event.target.value)}
                  className="input-field"
                  disabled={events.length === 0}
                >
                  {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
                <input
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  type="email"
                  className="input-field"
                  placeholder="organizer@example.com"
                />
                <input
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  className="input-field"
                  placeholder="Internal note"
                />
                <button type="submit" disabled={actionId === 'assign' || !selectedEventId || !email.trim()} className="btn btn-primary">
                  {actionId === 'assign' ? 'Assigning...' : 'Assign event admin'}
                </button>
              </form>
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Event admins</h2>
                <span className="badge badge-primary">{eventAdmins.length}</span>
              </div>
              {eventAdmins.length === 0 ? (
                <div className="empty-state" style={{ padding: 36 }}>No event admins assigned yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {eventAdmins.map(membership => (
                    <div key={membership.id} className="table-row">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{membership.user?.name}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>{membership.user?.email}</div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.86rem', marginTop: 4 }}>
                          {membership.event?.title}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveEventAdmin(membership)}
                        disabled={actionId === membership.id}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      >
                        {actionId === membership.id ? '...' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Platform admins</h2>
                <span className="badge badge-primary">{platformAdmins.length}</span>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {platformAdmins.map(admin => (
                  <div key={admin.id} className="table-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{admin.name}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.86rem' }}>{admin.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="badge badge-primary">{admin.role}</span>
                      {admin.id !== user.id && admin.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleRemovePlatformAdmin(admin.id)}
                          disabled={actionId === admin.id}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        >
                          {actionId === admin.id ? '...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
