'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { authApi } from '@/lib/api';

function ResetPasswordPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(locale === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError(locale === 'ru' ? 'Пароль должен содержать минимум 8 символов' : 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token!, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-brand-panel">
          <Link href={`/${locale}`} className="public-logo">
            <img src="/site-logo.png" alt="RDEvents" className="public-logo-mark public-logo-mark-auth" />
          </Link>
          <div className="auth-brand-content">
            <h1>{locale === 'ru' ? 'Восстановление пароля' : 'Password reset'}</h1>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2>{locale === 'ru' ? 'Ссылка недействительна' : 'Invalid link'}</h2>
            <p className="text-muted">
              {locale === 'ru'
                ? 'Ссылка для восстановления пароля отсутствует или устарела.'
                : 'The password reset link is missing or expired.'}
            </p>
            <Link href={`/${locale}/forgot-password`} className="btn btn-primary">
              {locale === 'ru' ? 'Запросить новую ссылку' : 'Request new link'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-shell">
        <div className="auth-brand-panel">
          <Link href={`/${locale}`} className="public-logo">
            <img src="/site-logo.png" alt="RDEvents" className="public-logo-mark public-logo-mark-auth" />
          </Link>
          <div className="auth-brand-content">
            <h1>{locale === 'ru' ? 'Пароль изменён' : 'Password changed'}</h1>
            <p>{locale === 'ru' ? 'Ваш пароль успешно изменён. Теперь вы можете войти.' : 'Your password has been changed. You can now sign in.'}</p>
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
            <h2>{locale === 'ru' ? 'Успешно!' : 'Success!'}</h2>
            <p className="text-muted">
              {locale === 'ru'
                ? 'Ваш пароль был успешно изменён. Используйте новый пароль для входа в систему.'
                : 'Your password has been successfully changed. Use your new password to sign in.'}
            </p>
            <Link href={`/${locale}/login`} className="btn btn-primary">
              {locale === 'ru' ? 'Войти' : 'Sign in'}
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
          <h1>{locale === 'ru' ? 'Новый пароль' : 'New password'}</h1>
          <p>{locale === 'ru' ? 'Придумайте надёжный пароль.' : 'Create a strong password.'}</p>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <h2>{locale === 'ru' ? 'Создайте новый пароль' : 'Create new password'}</h2>
          <p className="text-muted">
            {locale === 'ru'
              ? 'Пароль должен содержать минимум 8 символов.'
              : 'Password must be at least 8 characters.'}
          </p>

          <form onSubmit={handleSubmit} className="signal-stack">
            <div className="signal-field-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="signal-field signal-field-with-action"
                placeholder={locale === 'ru' ? 'Новый пароль' : 'New password'}
              />
              <button type="button" onClick={() => setShowPass((value) => !value)} className="auth-eye-toggle">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>

            <input
              type={showPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              className="signal-field"
              placeholder={locale === 'ru' ? 'Подтвердите пароль' : 'Confirm password'}
            />

            {error ? <div className="signal-notice tone-danger">{error}</div> : null}

            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '...' : (locale === 'ru' ? 'Изменить пароль' : 'Change password')}
            </button>
          </form>

          <div className="auth-links">
            <Link href={`/${locale}/login`}>
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-loading-screen"><div className="spinner" /></div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
