'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { adminApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function AdminAdminsPage() {
  const t = useTranslations();
  const { user, loading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [addingEmail, setAddingEmail] = useState('');
  const [addingError, setAddingError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) router.push(`/${locale}`);
  }, [user, loading, isSuperAdmin, router, locale]);

  const loadData = () => {
    setLoadingData(true);
    adminApi.listAdmins()
      .then(r => setAdmins(r.admins))
      .catch(() => {})
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    if (user && isSuperAdmin) loadData();
  }, [user, isSuperAdmin]);

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove admin role from this user?')) return;
    setActionId(userId);
    try {
      await adminApi.updateUserRole(userId, 'USER');
      setAdmins(prev => prev.filter(a => a.id !== userId));
    } catch {
      alert('Failed to remove admin');
    } finally {
      setActionId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingEmail.trim()) return;
    setAddingError('');
    try {
      await adminApi.updateUserRole(addingEmail.trim(), 'PLATFORM_ADMIN');
      setAddingEmail('');
      loadData();
    } catch (err: any) {
      setAddingError(err.message || 'Failed to add admin');
    }
  };

  if (loading || !user || !isSuperAdmin) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('admin.admins')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{admins.length} admins</p>
        </div>

        {/* Add admin form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 32, maxWidth: 480 }}>
          <input
            type="email"
            value={addingEmail}
            onChange={e => setAddingEmail(e.target.value)}
            placeholder="User email to promote as admin"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ padding: '10px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            Add
          </button>
        </form>
        {addingError && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-lg)', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.9rem', marginBottom: 16, maxWidth: 480 }}>
            {addingError}
          </div>
        )}

        {loadingData ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '48px', borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No admins yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {admins.map((a: any) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>
                  {a.avatarUrl ? <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : a.name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{a.email}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', fontWeight: 700, background: '#2563eb20', color: '#2563eb' }}>
                  {a.role}
                </span>
                {a.id !== user.id && (
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={actionId === a.id}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid #ef4444', fontSize: '0.85rem', color: '#ef4444', background: 'transparent', cursor: 'pointer', opacity: actionId === a.id ? 0.5 : 1 }}
                  >
                    {actionId === a.id ? '...' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
