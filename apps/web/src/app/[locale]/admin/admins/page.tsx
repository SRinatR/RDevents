'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { SectionHeader } from '../../../../components/admin/SectionHeader';
import { RoleBadge } from '../../../../components/admin/RoleBadge';

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
      setSuccess(locale === 'ru' ? 'Администратор события назначен' : 'Event admin assigned');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign event admin');
    } finally {
      setActionId(null);
    }
  }

  async function handleRemoveEventAdmin(membership: any) {
    if (!confirm(locale === 'ru' ? 'Удалить назначение администратора события?' : 'Remove this event admin assignment?')) return;
    setActionId(membership.id);
    setError('');
    setSuccess('');
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
    if (!confirm(locale === 'ru' ? 'Убрать роль администратора платформы?' : 'Remove platform admin role from this user?')) return;
    setActionId(userId);
    setError('');
    setSuccess('');
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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.admins')}
        description={locale === 'ru' ? 'Администраторы событий и платформы' : 'Event-scoped admins and platform admins'}
      />

      <div className="admin-page-body">

        {error && (
          <div className="admin-notice admin-notice-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}
        {success && (
          <div className="admin-notice admin-notice-success" style={{ marginBottom: 16 }}>
            {success}
          </div>
        )}

        {loadingData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="admin-skeleton" style={{ height: 56 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 36 }}>

            {/* Assign form */}
            <section>
              <SectionHeader title={locale === 'ru' ? 'Назначить администратора события' : 'Assign event admin'} />
              <div className="admin-panel">
                <div className="admin-panel-body">
                  <form onSubmit={handleAssign} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    <select
                      value={selectedEventId}
                      onChange={e => setSelectedEventId(e.target.value)}
                      disabled={events.length === 0}
                      className="admin-filter-select"
                      style={{ height: 34 }}
                    >
                      {events.length === 0
                        ? <option value="">{locale === 'ru' ? 'Нет событий' : 'No events'}</option>
                        : events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
                    </select>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      placeholder="organizer@example.com"
                      className="admin-text-input"
                    />
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={locale === 'ru' ? 'Внутренняя заметка (необязательно)' : 'Internal note (optional)'}
                      className="admin-text-input"
                    />
                    <button
                      type="submit"
                      disabled={actionId === 'assign' || !selectedEventId || !email.trim()}
                      className="btn-admin-primary"
                      style={{ height: 34 }}
                    >
                      {actionId === 'assign'
                        ? (locale === 'ru' ? 'Назначение...' : 'Assigning...')
                        : (locale === 'ru' ? 'Назначить' : 'Assign event admin')}
                    </button>
                  </form>
                </div>
              </div>
            </section>

            {/* Event admins */}
            <section>
              <SectionHeader
                title={locale === 'ru' ? 'Администраторы событий' : 'Event admins'}
                action={
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {eventAdmins.length} {locale === 'ru' ? 'всего' : 'total'}
                  </span>
                }
              />
              {eventAdmins.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  {locale === 'ru' ? 'Администраторы событий ещё не назначены.' : 'No event admins assigned yet.'}
                </div>
              ) : (
                <div className="admin-panel" style={{ overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{locale === 'ru' ? 'Администратор' : 'Admin'}</th>
                        <th>{locale === 'ru' ? 'Событие' : 'Event'}</th>
                        <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventAdmins.map(membership => (
                        <tr key={membership.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{membership.user?.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{membership.user?.email}</div>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{membership.event?.title}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleRemoveEventAdmin(membership)}
                              disabled={actionId === membership.id}
                              className="btn-admin-danger"
                            >
                              {actionId === membership.id ? '...' : (locale === 'ru' ? 'Удалить' : 'Remove')}
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
                title={locale === 'ru' ? 'Администраторы платформы' : 'Platform admins'}
                action={
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    {platformAdmins.length} {locale === 'ru' ? 'всего' : 'total'}
                  </span>
                }
              />
              <div className="admin-panel" style={{ overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{locale === 'ru' ? 'Администратор' : 'Admin'}</th>
                      <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                      <th style={{ textAlign: 'right' }}>{locale === 'ru' ? 'Действия' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformAdmins.map(admin => (
                      <tr key={admin.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{admin.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{admin.email}</div>
                        </td>
                        <td>
                          <RoleBadge role={admin.role} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {admin.id !== user.id && admin.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleRemovePlatformAdmin(admin.id)}
                              disabled={actionId === admin.id}
                              className="btn-admin-danger"
                            >
                              {actionId === admin.id ? '...' : (locale === 'ru' ? 'Удалить' : 'Remove')}
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
