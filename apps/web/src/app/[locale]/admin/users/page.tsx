'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { PageHeader } from '../../../../components/admin/PageHeader';
import { EmptyState } from '../../../../components/admin/EmptyState';

const roleStyles: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN:    { bg: 'rgba(124, 58, 237, 0.08)', color: '#7C3AED' },
  PLATFORM_ADMIN: { bg: 'rgba(37, 99, 235, 0.08)',  color: '#2563EB' },
  USER:           { bg: 'var(--color-bg-subtle)',    color: 'var(--color-text-muted)' },
};

export default function AdminUsersPage() {
  const t = useTranslations();
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  if (loading || !user || !isPlatformAdmin) return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.users')}
        description={usersLoading ? undefined : `${users.length} users total`}
      />

      <div className="admin-page-body">
        {usersLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="admin-skeleton" style={{ height: 52 }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>City</th>
                  <th>Registered</th>
                  <th>Last login</th>
                  <th>Accounts</th>
                  <th>Change role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => {
                  const rs = roleStyles[u.role] ?? roleStyles.USER;
                  return (
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
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', padding: '2px 8px',
                          borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                          background: rs.bg, color: rs.color,
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.city || '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
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
                          style={{
                            padding: '5px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            fontSize: '0.8rem',
                            color: 'var(--color-text-secondary)',
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
