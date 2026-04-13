'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function ProfilePage() {
  const t = useTranslations();
  const { user, loading, updateProfile } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
    if (user) {
      setName(user.name ?? '');
      setBio(user.bio ?? '');
      setCity(user.city ?? '');
      setPhone(user.phone ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
    }
  }, [user, loading, router, locale]);

  if (loading || !user) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateProfile({ name, bio, city, phone, avatarUrl });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 900, letterSpacing: 0 }}>
          {t('profile.title')}
        </h1>

        <div style={{ padding: 28, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 800 }}>{t('profile.personalInfo')}</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: t('auth.name'), value: name, setter: setName, type: 'text' },
              { label: t('profile.bio'), value: bio, setter: setBio, type: 'text' },
              { label: t('profile.city'), value: city, setter: setCity, type: 'text' },
              { label: t('profile.phone'), value: phone, setter: setPhone, type: 'tel' },
              { label: t('profile.avatar'), value: avatarUrl, setter: setAvatarUrl, type: 'url' },
            ].map(({ label, value, setter, type }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  style={{ height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem', outline: 'none' }}
                />
              </div>
            ))}

            {error && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', color: 'var(--color-danger)', fontSize: '0.9rem' }}>{error}</div>}
            {success && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontSize: '0.9rem', fontWeight: 600 }}>✓ {t('profile.updateSuccess')}</div>}

            <button type="submit" disabled={saving} style={{ height: 44, borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: saving ? 0.7 : 1 }}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </div>

        {/* Account info */}
        <div style={{ padding: 24, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 800 }}>{t('common.status')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            <div><strong>{t('auth.email')}:</strong> {user.email}</div>
            <div><strong>Role:</strong> {user.role}</div>
            <div><strong>{t('profile.registeredAt')}:</strong> {new Date(user.registeredAt).toLocaleDateString()}</div>
            {user.lastLoginAt && <div><strong>{t('profile.lastLogin')}:</strong> {new Date(user.lastLoginAt).toLocaleDateString()}</div>}
          </div>
        </div>

        {/* Connected providers */}
        {user.accounts && user.accounts.length > 0 && (
          <div style={{ padding: 24, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 800 }}>{t('profile.connectedProviders')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {user.accounts.map((acc: any) => (
                <div key={acc.provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'rgba(28,100,242,0.04)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{acc.provider}</span>
                    {acc.providerEmail && <span style={{ marginLeft: 8, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{acc.providerEmail}</span>}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 700 }}>Connected</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
