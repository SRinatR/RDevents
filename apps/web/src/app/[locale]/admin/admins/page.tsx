'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';

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
      setSelectedEventId((current) => current || eventsResult.data[0]?.id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (user && isSuperAdmin) loadData();
  }, [user, isSuperAdmin]);

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!selectedEventId || !email.trim()) return;
    setActionId('assign');
    setError('');
    setSuccess('');
    try {
      await adminApi.assignEventAdmin(selectedEventId, { email: email.trim(), notes: notes.trim() || undefined });
      setEmail('');
      setNotes('');
      setSuccess(locale === 'ru' ? 'Назначение выполнено' : 'Event admin assigned');
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
    try {
      await adminApi.removeEventAdmin(membership.eventId, membership.userId);
      setEventAdmins((previous) => previous.filter((entry) => entry.id !== membership.id));
      setSuccess(locale === 'ru' ? 'Назначение удалено' : 'Assignment removed');
    } catch (err: any) {
      setError(err.message || 'Failed to remove event admin');
    } finally {
      setActionId(null);
    }
  }

  async function handleRemovePlatformAdmin(userId: string) {
    if (!confirm(locale === 'ru' ? 'Снять роль platform admin у пользователя?' : 'Remove platform admin role from this user?')) return;
    setActionId(userId);
    setError('');
    try {
      await adminApi.updateUserRole(userId, 'USER');
      setPlatformAdmins((previous) => previous.filter((admin) => admin.id !== userId));
      setSuccess(locale === 'ru' ? 'Роль обновлена' : 'Role updated');
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setActionId(null);
    }
  }

  if (loading || !user || !isSuperAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader title={t('admin.admins')} subtitle={locale === 'ru' ? 'Управление доступом и зонами ответственности' : 'Access control and responsibility scopes'} />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <div className="admin-control-strip">
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Платформа' : 'Platform'}</small><strong>{platformAdmins.length} {locale === 'ru' ? 'админов' : 'admins'}</strong></div>
        <div className="admin-control-card"><small>{locale === 'ru' ? 'События' : 'Events'}</small><strong>{eventAdmins.length} {locale === 'ru' ? 'назначений' : 'assignments'}</strong></div>
      </div>

      <div className="signal-two-col admin-dashboard-grid">
        <Panel variant="elevated" className="admin-command-panel admin-data-panel">
          <SectionHeader title={locale === 'ru' ? 'Назначить администратора события' : 'Assign event admin'} subtitle={locale === 'ru' ? 'Назначение по email в выбранное событие' : 'Assign by email into selected event scope'} />
          {loadingData ? <LoadingLines rows={4} /> : (
            <form onSubmit={handleAssign} className="signal-stack">
              <FieldSelect value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} disabled={events.length === 0}>
                {events.length === 0 ? <option value="">No events available</option> : events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </FieldSelect>
              <FieldInput value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="organizer@example.com" />
              <FieldInput value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={locale === 'ru' ? 'Внутренняя заметка (необязательно)' : 'Internal note (optional)'} />
              <ToolbarRow>
                <button type="submit" disabled={actionId === 'assign' || !selectedEventId || !email.trim()} className="btn btn-primary btn-sm">{actionId === 'assign' ? '...' : locale === 'ru' ? 'Назначить' : 'Assign'}</button>
                
              </ToolbarRow>
            </form>
          )}
        </Panel>

        <Panel variant="elevated" className="admin-command-panel admin-data-panel">
          <SectionHeader title={locale === 'ru' ? 'Администраторы платформы' : 'Platform admins'} subtitle={locale === 'ru' ? 'Глобальные административные роли' : 'Global administrative roles'} />
          {loadingData ? <LoadingLines rows={4} /> : platformAdmins.length === 0 ? (
            <EmptyState title={locale === 'ru' ? 'Нет администраторов платформы' : 'No platform admins'} description={locale === 'ru' ? 'Пока нет назначенных пользователей.' : 'No users assigned yet.'} />
          ) : (
            <div className="signal-stack">
              {platformAdmins.map((admin) => (
                <div key={admin.id} className="signal-ranked-item admin-list-item">
                  <div>
                    <strong>{admin.name || admin.email}</strong>
                    <div className="signal-muted">{admin.email}</div>
                  </div>
                  <ToolbarRow>
                    
                    {admin.id !== user.id && admin.role !== 'SUPER_ADMIN' ? (
                      <button onClick={() => handleRemovePlatformAdmin(admin.id)} className="btn btn-danger btn-sm" disabled={actionId === admin.id}>{actionId === admin.id ? '...' : locale === 'ru' ? 'Снять роль' : 'Remove role'}</button>
                    ) : null}
                  </ToolbarRow>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <SectionHeader title={locale === 'ru' ? 'Администраторы событий' : 'Event admins'} subtitle={locale === 'ru' ? 'Назначения по конкретным мероприятиям' : 'Assignments tied to specific events'} />
        {loadingData ? <LoadingLines rows={5} /> : eventAdmins.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Нет назначений' : 'No assignments'} description={locale === 'ru' ? 'Назначения появятся после первой выдачи роли event admin.' : 'Assignments appear after first event-admin grant.'} />
        ) : (
          <div className="signal-stack">
            {eventAdmins.map((membership) => (
              <div key={membership.id} className="signal-ranked-item admin-list-item">
                <div>
                  <strong>{membership.user?.name || membership.user?.email}</strong>
                  <div className="signal-muted">{membership.user?.email}</div>
                  <div className="signal-muted">{membership.event?.title || 'Unknown event'}</div>
                </div>
                <ToolbarRow>
                  
                  <button onClick={() => handleRemoveEventAdmin(membership)} className="btn btn-danger btn-sm" disabled={actionId === membership.id}>{actionId === membership.id ? '...' : locale === 'ru' ? 'Удалить' : 'Remove'}</button>
                </ToolbarRow>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
