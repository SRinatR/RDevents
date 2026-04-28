'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_MANAGER', 'VIEWER'];

export default function WorkspaceMembersPage() {
  const locale = useRouteLocale();
  const workspaceId = useRouteParam('workspaceId');
  const isRu = locale === 'ru';
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', role: 'VIEWER' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId) return;

    setLoading(true);
    setError('');

    try {
      const result = await adminApi.listWorkspaceMembers(workspaceId);
      setMembers(result.members ?? []);
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось загрузить сотрудников.' : 'Failed to load members.'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isRu]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={isRu ? 'Сотрудники отдела' : 'Workspace members'} subtitle={workspaceId} />
      <Panel>
        <form onSubmit={submit}>
          <AdminToolbar actions={<button className="btn btn-primary" type="submit">{isRu ? 'Добавить' : 'Add'}</button>}>
            <FieldInput className="admin-toolbar-search" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} placeholder="user_id" required />
            <FieldSelect className="admin-toolbar-select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </FieldSelect>
          </AdminToolbar>
        </form>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Panel>

      {loading ? <LoadingLines rows={5} /> : null}
      {!loading && members.length === 0 ? <EmptyState title={isRu ? 'Сотрудников пока нет' : 'No members yet'} description={isRu ? 'Добавьте сотрудника по userId.' : 'Add a member by userId.'} /> : null}
      {members.length > 0 ? (
        <Panel className="admin-command-panel">
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={760}>
              <AdminDataTableHeader
                columns={[
                  { label: isRu ? 'Пользователь' : 'User', width: '42%' },
                  { label: isRu ? 'Роль' : 'Role', width: '22%' },
                  { label: isRu ? 'Статус' : 'Status', width: '18%' },
                  { label: isRu ? 'Действия' : 'Actions', width: '18%', align: 'right' },
                ]}
              />
              <AdminDataTableBody>
                {members.map((member) => (
                  <AdminDataTableRow key={member.id}>
                    <AdminDataTableCell>
                      <AdminTableCellMain title={member.user?.name || member.user?.email} subtitle={member.user?.id} />
                    </AdminDataTableCell>
                    <AdminDataTableCell>{member.role}</AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell align="right"><button className="btn btn-ghost btn-sm" onClick={() => adminApi.removeWorkspaceMember(workspaceId, member.id).then(load)} type="button">{isRu ? 'Убрать' : 'Remove'}</button></AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {members.map((member) => (
                <AdminMobileCard
                  key={member.id}
                  title={member.user?.name || member.user?.email}
                  subtitle={member.user?.id}
                  badge={<StatusBadge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</StatusBadge>}
                  meta={[{ label: isRu ? 'Роль' : 'Role', value: member.role }]}
                  actions={<button className="btn btn-ghost btn-sm" onClick={() => adminApi.removeWorkspaceMember(workspaceId, member.id).then(load)} type="button">{isRu ? 'Убрать' : 'Remove'}</button>}
                />
              ))}
            </AdminMobileList>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
