'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function RegisterPage() {
  const t = useTranslations();
  const { register } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('auth.errors.passwordTooShort'));
      return;
    }
    if (name.length < 2) {
      setError(t('auth.errors.nameTooShort'));
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError(t('auth.errors.userExists'));
        else setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
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
            {t('auth.registerTitle')}
          </h1>
          <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted)' }}>{t('auth.registerSubtitle')}</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: t('auth.name'), value: name, setter: setName, type: 'text', placeholder: 'Your name' },
              { label: t('auth.email'), value: email, setter: setEmail, type: 'email', placeholder: 'you@example.com' },
              { label: t('auth.password'), value: password, setter: setPassword, type: 'password', placeholder: '••••••••' },
            ].map(({ label, value, setter, type, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  required
                  placeholder={placeholder}
                  style={{ height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem', outline: 'none' }}
                />
              </div>
            ))}

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
              {loading ? t('common.loading') : t('auth.signUp')}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {t('auth.alreadyHaveAccount')}{' '}
            <Link href={`/${locale}/login`} style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
