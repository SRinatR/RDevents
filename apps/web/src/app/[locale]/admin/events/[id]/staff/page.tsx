'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_OPERATOR', 'VIEWER'];

export default function EventStaffPage() {
  const locale = useRouteLocale();
  const eventId = useRouteParam('id');
  const isRu = locale === 'ru';
  const [grants, setGrants] = useState<any[]>([]);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [form, setForm] = useState({ email: '', role: 'ADMIN', reason: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!eventId) return;
    setLoading(true);
    adminApi.listEventStaff(eventId)
      .then((result) => {
        setGrants(result.grants ?? []);
        setAccesses(result.accesses ?? []);
      })
      .catch((err) => setError(err?.message || (isRu ? 'Не удалось загрузить staff.' : 'Failed to load staff.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, [eventId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await adminApi.createEventStaffGrant(eventId, { email: form.email, role: form.role, reason: form.reason || null });
      setForm({ email: '', role: 'ADMIN', reason: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось выдать доступ.' : 'Failed to grant access.'));
    }
  }

  return (
    <div className="admin-page">
      <PageHeader title={isRu ? 'Staff мероприятия' : 'Event staff'} subtitle={eventId} />
      <Panel>
        <form className="signal-toolbar-row" onSubmit={submit}>
          <FieldInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="user@example.com" required />
          <FieldSelect value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {STAFF_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </FieldSelect>
          <FieldInput value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder={isRu ? 'Причина' : 'Reason'} />
          <button className="btn btn-primary" type="submit">{isRu ? 'Выдать доступ' : 'Grant access'}</button>
        </form>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Panel>

      {loading ? <LoadingLines rows={5} /> : null}
      {!loading && grants.length === 0 ? <EmptyState title={isRu ? 'Staff ещё не назначен' : 'No staff grants yet'} description={isRu ? 'Добавьте сотрудника по email.' : 'Add a user by email.'} /> : null}
      {grants.length > 0 ? (
        <Panel>
          <TableShell>
            <table>
              <thead><tr><th>{isRu ? 'Пользователь' : 'User'}</th><th>{isRu ? 'Роль' : 'Role'}</th><th>{isRu ? 'Источник' : 'Source'}</th><th>{isRu ? 'Статус' : 'Status'}</th><th></th></tr></thead>
              <tbody>
                {grants.map((grant) => (
                  <tr key={grant.id}>
                    <td>{grant.user?.name || grant.user?.email}<div className="text-muted">{grant.user?.id}</div></td>
                    <td>{grant.role}</td>
                    <td>{grant.source}</td>
                    <td><StatusBadge tone={grant.status === 'ACTIVE' ? 'success' : 'warning'}>{grant.status}</StatusBadge></td>
                    <td><button className="btn btn-ghost btn-sm" type="button" onClick={() => adminApi.revokeEventStaffGrant(eventId, grant.id).then(load)}>{isRu ? 'Отозвать' : 'Revoke'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </Panel>
      ) : null}

      {accesses.length > 0 ? (
        <Panel>
          <TableShell>
            <table>
              <thead><tr><th>{isRu ? 'Эффективный доступ' : 'Effective access'}</th><th>{isRu ? 'Роли' : 'Roles'}</th><th>{isRu ? 'Permissions' : 'Permissions'}</th></tr></thead>
              <tbody>
                {accesses.map((access) => (
                  <tr key={access.id}>
                    <td>{access.user?.name || access.user?.email}</td>
                    <td>{access.roles?.join(', ')}</td>
                    <td>{access.permissions?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </Panel>
      ) : null}
    </div>
  );
}
