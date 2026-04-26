'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_MANAGER', 'VIEWER'];

export default function WorkspaceMembersPage() {
  const locale = useRouteLocale();
  const workspaceId = useRouteParam('workspaceId');
  const isRu = locale === 'ru';
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', role: 'VIEWER' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!workspaceId) return;
    setLoading(true);
    adminApi.listWorkspaceMembers(workspaceId)
      .then((result) => setMembers(result.members ?? []))
      .catch((err) => setError(err?.message || (isRu ? 'Не удалось загрузить сотрудников.' : 'Failed to load members.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, [workspaceId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await adminApi.addWorkspaceMember(workspaceId, { userId: form.userId, role: form.role, status: 'ACTIVE' });
      setForm({ userId: '', role: 'VIEWER' });
      await load();
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось добавить сотрудника.' : 'Failed to add member.'));
    }
  }

  return (
    <div className="admin-page">
      <PageHeader title={isRu ? 'Сотрудники отдела' : 'Workspace members'} subtitle={workspaceId} />
      <Panel>
        <form className="signal-toolbar-row" onSubmit={submit}>
          <FieldInput value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} placeholder="user_id" required />
          <FieldSelect value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </FieldSelect>
          <button className="btn btn-primary" type="submit">{isRu ? 'Добавить' : 'Add'}</button>
        </form>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Panel>

      {loading ? <LoadingLines rows={5} /> : null}
      {!loading && members.length === 0 ? <EmptyState title={isRu ? 'Сотрудников пока нет' : 'No members yet'} description={isRu ? 'Добавьте сотрудника по userId.' : 'Add a member by userId.'} /> : null}
      {members.length > 0 ? (
        <Panel>
          <TableShell>
            <table>
              <thead><tr><th>{isRu ? 'Пользователь' : 'User'}</th><th>{isRu ? 'Роль' : 'Role'}</th><th>{isRu ? 'Статус' : 'Status'}</th><th></th></tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.user?.name || member.user?.email}<div className="text-muted">{member.user?.id}</div></td>
                    <td>{member.role}</td>
                    <td><StatusBadge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</StatusBadge></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => adminApi.removeWorkspaceMember(workspaceId, member.id).then(load)} type="button">{isRu ? 'Убрать' : 'Remove'}</button></td>
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
