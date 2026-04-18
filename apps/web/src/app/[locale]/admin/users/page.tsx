'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, SectionHeader, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminUsersPage() {
  const t = useTranslations();
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [user, loading, isPlatformAdmin, router, locale]);

  const loadUsers = () => {
    setUsersLoading(true);
    adminApi.listUsers({ limit: 100 })
      .then((response) => setUsers(response.data))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    if (user && isPlatformAdmin) loadUsers();
  }, [user, isPlatformAdmin]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const { user: updated } = await adminApi.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((currentUser) => currentUser.id === userId ? { ...currentUser, role: updated.role } : currentUser));
    } catch {
      alert('Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return users.filter((entry) => {
      const rolePass = roleFilter === 'ALL' || entry.role === roleFilter;
      const searchPass = !normalized
        || entry.name?.toLowerCase().includes(normalized)
        || entry.email?.toLowerCase().includes(normalized)
        || entry.city?.toLowerCase().includes(normalized);
      return rolePass && searchPass;
    });
  }, [users, search, roleFilter]);

  const toneByRole: Record<string, 'info' | 'warning' | 'neutral'> = {
    SUPER_ADMIN: 'warning',
    PLATFORM_ADMIN: 'info',
    USER: 'neutral',
  };

  if (loading || !user || !isPlatformAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader title={t('admin.users')} subtitle={`${users.length} users total`} />

      <div className="admin-control-strip">
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Каталог' : 'Directory'}</small><strong>{locale === 'ru' ? 'Пользователи и роли' : 'Users and roles'}</strong></div>
        <div className="admin-control-card"><small>{locale === 'ru' ? 'Фильтр' : 'Filter'}</small><strong>{roleFilter === 'ALL' ? (locale === 'ru' ? 'Все роли' : 'All roles') : roleFilter}</strong></div>
      </div>

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <SectionHeader title={locale === 'ru' ? 'Операции с пользователями' : 'User operations'} subtitle={locale === 'ru' ? 'Управление ролями и учётными записями' : 'Role and account management'} />
        <ToolbarRow>
          <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === 'ru' ? 'Поиск по имени, email или городу' : 'Search by name, email, or city'} className="admin-filter-search" />
          <FieldSelect value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="admin-filter-sort">
            <option value="ALL">All roles</option>
            <option value="USER">User</option>
            <option value="PLATFORM_ADMIN">Platform Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </FieldSelect>
          
        </ToolbarRow>

        {usersLoading ? (
          <LoadingLines rows={6} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Пользователи не найдены' : 'No users found'} description={locale === 'ru' ? 'Скорректируйте фильтры или дождитесь новых регистраций.' : 'Adjust filters or wait for incoming registrations.'} />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>City</th>
                  <th>Registered</th>
                  <th>Last login</th>
                  <th>Accounts</th>
                  <th>Role control</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((entry: any) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="admin-user-cell">
                        <span className="signal-avatar">
                          {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : (entry.name || entry.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>{entry.name || 'Unknown user'}</strong>
                          <div className="signal-muted">{entry.email}</div>
                        </div>
                      </div>
                    </td>
                    <td></td>
                    <td>{entry.city || '—'}</td>
                    <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}</td>
                    <td>{entry.lastLoginAt ? new Date(entry.lastLoginAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="admin-provider-list">
                        {entry.accounts?.length
                          ? entry.accounts.map((account: any) => <span key={account.id} className="signal-muted">{account.provider}</span>)
                          : <span className="signal-muted">No linked providers</span>}
                      </div>
                    </td>
                    <td>
                      <FieldSelect
                        value={entry.role}
                        onChange={(event) => handleRoleChange(entry.id, event.target.value)}
                        disabled={updatingId === entry.id || entry.id === user.id}
                      >
                        <option value="USER">User</option>
                        <option value="PLATFORM_ADMIN">Platform Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </FieldSelect>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>

      <Notice tone="warning">
        {locale === 'ru' ? 'Изменение роли применяется немедленно. Текущий пользователь не может понизить собственную роль из этого интерфейса.' : 'Role changes are applied immediately. The current user cannot demote their own role from this interface.'}
      </Notice>
    </div>
  );
}
