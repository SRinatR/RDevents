'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

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

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: '#7c3aed',
    PLATFORM_ADMIN: '#2563eb',
    USER: '#6b7280',
  };

  if (loading || !user || !isPlatformAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('admin.users')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{users.length} users total</p>
        </div>

        {usersLoading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '48px', borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No users found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-subtle)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>User</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Role</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>City</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Registered</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Last Login</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Accounts</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', fontWeight: 700, background: (roleColors[u.role] ?? '#6b7280') + '20', color: roleColors[u.role] ?? '#6b7280' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{u.city || '—'}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.accounts?.map((a: any) => (
                          <span key={a.id} style={{ padding: '2px 8px', borderRadius: 'var(--radius-lg)', fontSize: '0.75rem', background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                            {a.provider}
                          </span>
                        )) ?? <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        disabled={updatingId === u.id || u.id === user.id}
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.85rem', cursor: (updatingId === u.id || u.id === user.id) ? 'not-allowed' : 'pointer', opacity: (updatingId === u.id || u.id === user.id) ? 0.5 : 1 }}
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
