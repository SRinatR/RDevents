'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { authApi, setAccessToken } from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

const isProduction = process.env.NODE_ENV === 'production';

const SOCIAL_PROVIDERS = [
  { id: 'google' as const, label: 'Google', key: 'G' },
  { id: 'yandex' as const, label: 'Yandex', key: 'Y' },
  { id: 'telegram' as const, label: 'Telegram', key: 'T' },
] as const;

export default function LoginPage() {
  const t = useTranslations();
  const { login, refreshUser } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(locale === 'ru' ? 'Ошибка входа. Попробуйте снова.' : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSocial(provider: 'google' | 'yandex' | 'telegram') {
    // Social auth is disabled in production
    setError(locale === 'ru' ? 'Социальный вход временно недоступен' : 'Social login is temporarily unavailable');
  }

  return (
    <section className="register-workspace">
      <div className="register-shell">
        <aside className="register-rail">
          <Link href={`/${locale}`} className="public-logo">
            <img src="/site-logo.png" alt="Русский Дом" className="public-logo-mark public-logo-mark-auth" />
          </Link>

          <div className="register-rail-copy">
            <h1>{locale === 'ru' ? 'Вход в рабочее пространство' : 'Access your workspace'}</h1>
            <p>{locale === 'ru' ? 'Операционный доступ к событиям, заявкам и участию.' : 'Operational access to events, applications, and participation.'}</p>
          </div>

          <ul className="register-step-list login-rail-list">
            <li className="register-step-item is-active">
              <span className="register-step-index">1</span>
              <span className="register-step-text">{locale === 'ru' ? 'События и заявки' : 'Events & applications'}</span>
            </li>
            <li className="register-step-item">
              <span className="register-step-index">2</span>
              <span className="register-step-text">{locale === 'ru' ? 'Командная работа' : 'Team operations'}</span>
            </li>
            <li className="register-step-item">
              <span className="register-step-index">3</span>
              <span className="register-step-text">{locale === 'ru' ? 'Профиль участника' : 'Participant profile'}</span>
            </li>
          </ul>
        </aside>

        <div className="register-main">
          <div className="register-panel login-workspace-panel">
            <header className="register-panel-head login-panel-head">
              <div className="register-panel-heading">
                <h2>{locale === 'ru' ? 'Вход' : 'Sign in'}</h2>
                <p>
                  {locale === 'ru' ? 'Нет аккаунта?' : 'No account?'} <Link href={`/${locale}/register`}>{locale === 'ru' ? 'Зарегистрироваться' : 'Register'}</Link>
                </p>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="signal-stack register-form-stack">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="signal-field" placeholder={t('auth.email')} />
              <div className="signal-field-wrap">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required className="signal-field signal-field-with-action" placeholder={t('auth.password')} />
                <button type="button" onClick={() => setShowPass((value) => !value)} className="auth-eye-toggle">{showPass ? 'Hide' : 'Show'}</button>
              </div>
              {error ? <div className="signal-notice tone-danger auth-inline-notice">{error}</div> : null}
              <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '...' : (locale === 'ru' ? 'Войти' : 'Sign in')}</button>
            </form>

            {isProduction ? null : (
              <>
                <div className="auth-divider">{locale === 'ru' ? 'или через провайдера' : 'or continue with provider'}</div>
                <div className="auth-social-grid">
                  {SOCIAL_PROVIDERS.map((provider) => (
                    <button key={provider.id} onClick={() => handleSocial(provider.id)} disabled={Boolean(socialLoading) || loading} className="auth-social-btn">
                      <span>{socialLoading === provider.id ? '...' : provider.key}</span>
                      <small>{provider.label}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
