'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { authApi, setAccessToken } from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function LoginPage() {
  const t = useTranslations();
  const { login } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(provider: 'google' | 'yandex' | 'telegram') {
    setSocialLoading(provider);
    setError('');
    try {
      // Dev mock flow — in production, redirect to OAuth provider
      const mockData = {
        providerAccountId: `demo_${provider}_${Date.now()}`,
        providerEmail: `demo_${provider}@example.com`,
        providerUsername: `Demo ${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      };

      let result;
      if (provider === 'google') result = await authApi.loginWithGoogle(mockData);
      else if (provider === 'yandex') result = await authApi.loginWithYandex(mockData);
      else result = await authApi.loginWithTelegram(mockData);

      setAccessToken(result.accessToken);
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSocialLoading('');
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{
          padding: 32,
          borderRadius: 'var(--radius-3xl)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', fontWeight: 900, letterSpacing: 0 }}>
            {t('auth.loginTitle')}
          </h1>
          <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted)' }}>{t('auth.loginSubtitle')}</p>

          {/* Social auth buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
              { id: 'google', label: t('auth.continueWithGoogle'), emoji: '🔵' },
              { id: 'yandex', label: t('auth.continueWithYandex'), emoji: '🔴' },
              { id: 'telegram', label: t('auth.continueWithTelegram'), emoji: '✈️' },
            ].map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => handleSocialLogin(id as any)}
                disabled={socialLoading === id || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'white',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  opacity: socialLoading === id ? 0.7 : 1,
                }}
              >
                <span>{emoji}</span>
                {socialLoading === id ? '...' : label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            or
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{ height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', color: 'var(--color-danger)', fontSize: '0.9rem', fontWeight: 500 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 46,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-primary)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {loading ? t('common.loading') : t('auth.signIn')}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {t('auth.noAccount')}{' '}
            <Link href={`/${locale}/register`} style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
