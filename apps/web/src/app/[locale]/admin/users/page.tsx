'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { EmptyState } from '../../../../components/admin/EmptyState';
import { RoleBadge } from '../../../../components/admin/RoleBadge';
import { SearchIcon } from '../../../../components/admin/icons';

const ROLE_OPTIONS = ['ALL', 'USER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;

export default function AdminUsersPage() {
  const t = useTranslations();
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [user, loading, isPlatformAdmin, router, locale]);

  const loadUsers = () => {
    setUsersLoading(true);
    adminApi.listUsers({ limit: 100 })
      .then(r => setUsers(r.data))
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
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updated.role } : u));
    } catch {
      alert('Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== 'ALL') {
      result = result.filter(u => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, search, roleFilter]);

  if (loading || !user || !isPlatformAdmin) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div className="spinner" />
    </div>
  );

  const totalLabel = usersLoading
    ? undefined
    : filteredUsers.length < users.length
      ? `${filteredUsers.length} of ${users.length} users`
      : `${users.length} users total`;

  return (
    <div className="admin-page">
      <PageHeader title={t('admin.users')} description={totalLabel} />

      <div className="admin-page-body">
        {/* Toolbar */}
        <div className="admin-toolbar" style={{ marginBottom: 20 }}>
          <div className="admin-search-wrap">
            <SearchIcon size={13} />
            <input
              className="admin-search-input"
              placeholder={locale === 'ru' ? 'Поиск по имени или email...' : 'Search by name or email...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>
                {r === 'ALL' ? (locale === 'ru' ? 'Все роли' : 'All roles') : r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {usersLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="admin-skeleton" style={{ height: 56 }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Нет пользователей' : 'No users found'} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет результатов' : 'No results'}
            description={locale === 'ru' ? 'Попробуйте изменить фильтры.' : 'Try adjusting your search or filter.'}
          />
        ) : (
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Пользователь' : 'User'}</th>
                  <th>{locale === 'ru' ? 'Роль' : 'Role'}</th>
                  <th>{locale === 'ru' ? 'Город' : 'City'}</th>
                  <th>{locale === 'ru' ? 'Зарегистрирован' : 'Registered'}</th>
                  <th>{locale === 'ru' ? 'Последний вход' : 'Last login'}</th>
                  <th>{locale === 'ru' ? 'Провайдеры' : 'Accounts'}</th>
                  <th>{locale === 'ru' ? 'Изменить роль' : 'Change role'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                          overflow: 'hidden',
                        }}>
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{u.city || '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.accounts?.map((a: any) => (
                          <span key={a.id} style={{
                            padding: '2px 7px', borderRadius: 4,
                            fontSize: '0.72rem', fontWeight: 500,
                            background: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-muted)',
                          }}>
                            {a.provider}
                          </span>
                        )) ?? <span style={{ color: 'var(--color-text-faint)', fontSize: '0.82rem' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        disabled={updatingId === u.id || u.id === user.id}
                        className="admin-filter-select"
                        style={{
                          cursor: (updatingId === u.id || u.id === user.id) ? 'not-allowed' : 'pointer',
                          opacity: (updatingId === u.id || u.id === user.id) ? 0.5 : 1,
                        }}
                      >
                        <option value="USER">User</option>
                        <option value="PLATFORM_ADMIN">Platform Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
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
