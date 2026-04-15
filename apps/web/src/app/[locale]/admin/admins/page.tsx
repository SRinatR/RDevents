'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { SectionHeader } from '../../../../components/admin/SectionHeader';

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
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  const inputStyle: React.CSSProperties = {
    height: 34,
    padding: '0 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    fontSize: '0.82rem',
    color: 'var(--color-text-primary)',
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.admins')}
        description="Event-scoped admins and platform admins"
      />

      <div className="admin-page-body">

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {loadingData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="admin-skeleton" style={{ height: 52 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 36 }}>

            {/* Assign form */}
            <section>
              <SectionHeader title="Assign event admin" />
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
                <form onSubmit={handleAssign} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  <select
                    value={selectedEventId}
                    onChange={e => setSelectedEventId(e.target.value)}
                    disabled={events.length === 0}
                    style={inputStyle}
                  >
                    {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
                  </select>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    type="email"
                    placeholder="organizer@example.com"
                    style={inputStyle}
                  />
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Internal note (optional)"
                    style={inputStyle}
                  />
                  <button
                    type="submit"
                    disabled={actionId === 'assign' || !selectedEventId || !email.trim()}
                    className="btn-admin-primary"
                    style={{ height: 34 }}
                  >
                    {actionId === 'assign' ? 'Assigning...' : 'Assign event admin'}
                  </button>
                </form>
              </div>
            </section>

            {/* Event admins */}
            <section>
              <SectionHeader
                title="Event admins"
                action={
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {eventAdmins.length} total
                  </span>
                }
              />
              {eventAdmins.length === 0 ? (
                <div style={{ padding: '24px 16px', color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                  No event admins assigned yet.
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Admin</th>
                        <th>Event</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventAdmins.map(membership => (
                        <tr key={membership.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{membership.user?.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{membership.user?.email}</div>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{membership.event?.title}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleRemoveEventAdmin(membership)}
                              disabled={actionId === membership.id}
                              className="btn-admin-danger"
                            >
                              {actionId === membership.id ? '...' : 'Remove'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Platform admins */}
            <section>
              <SectionHeader
                title="Platform admins"
                action={
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {platformAdmins.length} total
                  </span>
                }
              />
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformAdmins.map(admin => (
                      <tr key={admin.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{admin.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{admin.email}</div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', padding: '2px 8px', borderRadius: 4,
                            fontSize: '0.72rem', fontWeight: 600,
                            background: 'rgba(37,99,235,0.08)', color: 'var(--color-primary)',
                          }}>
                            {admin.role}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {admin.id !== user.id && admin.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleRemovePlatformAdmin(admin.id)}
                              disabled={actionId === admin.id}
                              className="btn-admin-danger"
                            >
                              {actionId === admin.id ? '...' : 'Remove'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
