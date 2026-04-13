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
  const { login, refreshUser } = useAuth();
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
      await refreshUser();
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSocialLoading('');
    }
  }

  const socialProviders = [
    { id: 'google', label: 'Continue with Google', color: '#1c64f2' },
    { id: 'yandex', label: 'Continue with Yandex', color: '#dc2626' },
    { id: 'telegram', label: 'Continue with Telegram', color: '#0284c7' },
  ] as const;

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '2rem', fontWeight: 900, letterSpacing: 0, color: 'var(--color-text-primary)' }}>
            Welcome back
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
            Sign in to continue
          </p>
        </div>

        <div style={{
          padding: 28,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          background: '#ffffff',
          boxShadow: '0 16px 44px rgba(15, 23, 42, 0.08)',
        }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '1.15rem', fontWeight: 800, letterSpacing: 0 }}>
            Sign in
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{ height: 46, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem', outline: 'none', background: '#fff' }}
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
                style={{ height: 46, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem', outline: 'none', background: '#fff' }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {socialProviders.map(({ id, label, color }) => (
              <button
                key={id}
                onClick={() => handleSocialLogin(id)}
                disabled={socialLoading === id || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  height: 46,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  color: 'var(--color-text-primary)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: socialLoading === id || loading ? 'not-allowed' : 'pointer',
                  opacity: socialLoading === id ? 0.7 : 1,
                }}
              >
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {socialLoading === id ? t('common.loading') : label}
              </button>
            ))}
          </div>

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
