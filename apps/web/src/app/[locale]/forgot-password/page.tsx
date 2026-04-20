'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Request failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-shell">
        <div className="auth-brand-panel">
          <Link href={`/${locale}`} className="public-logo">
            <img src="/site-logo.png" alt="RDEvents" className="public-logo-mark public-logo-mark-auth" />
          </Link>
          <div className="auth-brand-content">
            <h1>{locale === 'ru' ? 'Проверьте почту' : 'Check your email'}</h1>
            <p>{locale === 'ru' ? 'Мы отправили инструкции по восстановлению пароля на указанный email.' : 'We have sent password reset instructions to your email.'}</p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2>{locale === 'ru' ? 'Письмо отправлено' : 'Email sent'}</h2>
            <p className="text-muted">
              {locale === 'ru'
                ? 'Если аккаунт с указанным email существует, вы получите письмо с инструкциями в течение нескольких минут.'
                : 'If an account with this email exists, you will receive an email with instructions within a few minutes.'}
            </p>
            <p className="text-muted">
              {locale === 'ru' ? 'Не забывайте проверить папку "Спам".' : 'Don\'t forget to check your spam folder.'}
            </p>
            <Link href={`/${locale}/login`} className="btn btn-primary">
              {locale === 'ru' ? 'Вернуться ко входу' : 'Back to login'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <Link href={`/${locale}`} className="public-logo">
          <img src="/site-logo.png" alt="RDEvents" className="public-logo-mark public-logo-mark-auth" />
        </Link>
        <div className="auth-brand-content">
          <h1>{locale === 'ru' ? 'Восстановление пароля' : 'Password reset'}</h1>
          <p>{locale === 'ru' ? 'Укажите email, привязанный к аккаунту.' : 'Enter the email associated with your account.'}</p>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <h2>{locale === 'ru' ? 'Забыли пароль?' : 'Forgot password?'}</h2>
          <p className="text-muted">
            {locale === 'ru'
              ? 'Введите email, и мы отправим инструкции для восстановления доступа.'
              : 'Enter your email and we\'ll send you reset instructions.'}
          </p>

          <form onSubmit={handleSubmit} className="signal-stack">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="signal-field"
              placeholder={t('auth.email')}
            />
            {error ? <div className="signal-notice tone-danger">{error}</div> : null}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '...' : (locale === 'ru' ? 'Отправить инструкции' : 'Send instructions')}
            </button>
          </form>

          <div className="auth-links">
            <Link href={`/${locale}/login`}>
              {locale === 'ru' ? 'Вспомнили пароль? Войти' : 'Remember your password? Sign in'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
