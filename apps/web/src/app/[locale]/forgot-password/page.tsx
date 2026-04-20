'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, authApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-loading-screen"><div className="spinner" /></div>}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}

function ForgotPasswordPageContent() {
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [devCode, setDevCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function validateStep(): string {
    if (step === 1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return isRu ? 'Введите корректный email' : 'Please enter a valid email';
    }
    if (step === 2 && !/^\d{6}$/.test(code.trim())) {
      return isRu ? 'Введите 6-значный код из письма' : 'Enter the 6-digit verification code';
    }
    if (step === 3 && password.length < 8) {
      return isRu ? 'Пароль должен быть не короче 8 символов' : 'Password must be at least 8 characters';
    }
    if (step === 3 && password !== confirmPassword) {
      return isRu ? 'Пароли не совпадают' : 'Passwords do not match';
    }
    return '';
  }

  function handleBack() {
    setError('');
    setSuccess('');
    setStep((currentStep) => (currentStep - 1) as Step);
  }

  async function handleStart() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authApi.startPasswordReset({ email });
      setDevCode(result.devCode ?? '');
      setStep(2);
      setSuccess(isRu ? 'Если аккаунт найден, мы отправили код на email' : 'If the account exists, we sent a code to your email');
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authApi.verifyPasswordResetCode({ email, code: code.trim() });
      setResetToken(result.resetToken);
      setStep(3);
      setSuccess(isRu ? 'Код подтверждён. Установите новый пароль.' : 'Code verified. Set your new password.');
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!resetToken) {
      setError(isRu ? 'Сессия сброса истекла. Подтвердите код заново.' : 'Reset session expired. Verify the code again.');
      setStep(2);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authApi.completePasswordReset({ email, resetToken, password, confirmPassword });
      router.push(`/${locale}/login?reset=success`);
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
      if (err instanceof ApiError && (err.status === 401 || err.status === 410)) {
        setResetToken('');
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step === 1) return handleStart();
    if (step === 2) return handleVerify();
    return handleComplete();
  }

  async function handleResendCode() {
    if (loading) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authApi.startPasswordReset({ email });
      setDevCode(result.devCode ?? '');
      setCode('');
      setResetToken('');
      setSuccess(isRu ? 'Новый код отправлен на email' : 'A new code has been sent to your email');
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <Link href={`/${locale}`} className="public-logo">
          <img src="/site-logo.png" alt="Русский Дом" className="public-logo-mark public-logo-mark-auth" />
        </Link>
        <div className="auth-brand-content">
          <h1>{isRu ? 'Восстановление доступа' : 'Restore your access'}</h1>
          <p>{isRu ? 'Подтвердите email и задайте новый пароль.' : 'Verify email ownership and set a new password.'}</p>
          <div className="auth-brand-badges">
            <span>{isRu ? 'Безопасно' : 'Secure'}</span>
            <span>{isRu ? '3 шага' : '3 steps'}</span>
            <span>{isRu ? 'Быстро' : 'Quick'}</span>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-progress-top">
            <span>{isRu ? `Шаг ${step} из ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}</span>
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div>
          </div>

          <h2>{getStepTitle(step, isRu)}</h2>
          <p>{isRu ? 'Вспомнили пароль?' : 'Remembered your password?'} <Link href={`/${locale}/login`}>{isRu ? 'Войти' : 'Sign in'}</Link></p>

          <form onSubmit={handleSubmit} className="signal-stack">
            {step === 1 ? (
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="signal-field" autoFocus />
            ) : null}

            {step === 2 ? (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={isRu ? '6-значный код' : '6-digit code'}
                  className="signal-field"
                  autoFocus
                />
                <div className="signal-muted">
                  {isRu ? `Мы отправили код на ${email}` : `We sent a verification code to ${email}`}
                </div>
                {devCode ? (
                  <div className="signal-notice auth-inline-notice">
                    {isRu ? `Dev-код: ${devCode}` : `Dev code: ${devCode}`}
                  </div>
                ) : null}
                <button type="button" onClick={handleResendCode} className="btn btn-secondary btn-sm" disabled={loading}>
                  {isRu ? 'Отправить код заново' : 'Resend code'}
                </button>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="signal-field-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isRu ? 'Новый пароль' : 'New password'}
                    className="signal-field signal-field-with-action"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPass((value) => !value)} className="auth-eye-toggle">{showPass ? 'Hide' : 'Show'}</button>
                </div>
                <div className="signal-field-wrap">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={isRu ? 'Повторите пароль' : 'Confirm password'}
                    className="signal-field signal-field-with-action"
                  />
                  <button type="button" onClick={() => setShowConfirmPass((value) => !value)} className="auth-eye-toggle">{showConfirmPass ? 'Hide' : 'Show'}</button>
                </div>
              </>
            ) : null}

            {error ? <div className="signal-notice tone-danger auth-inline-notice">{error}</div> : null}
            {success ? <div className="signal-notice auth-inline-notice">{success}</div> : null}

            <div className="auth-actions-row">
              {step > 1 ? <button type="button" onClick={handleBack} className="btn btn-secondary btn-sm">{isRu ? 'Назад' : 'Back'}</button> : null}
              <button type="submit" disabled={loading} className="btn btn-primary btn-sm auth-primary-action">
                {loading ? '...' : getStepActionLabel(step, isRu)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getStepTitle(step: Step, isRu: boolean) {
  if (step === 1) return 'Email';
  if (step === 2) return isRu ? 'Код подтверждения' : 'Verification code';
  return isRu ? 'Новый пароль' : 'New password';
}

function getStepActionLabel(step: Step, isRu: boolean) {
  if (step === 1) return isRu ? 'Получить код' : 'Send code';
  if (step === 2) return isRu ? 'Подтвердить код' : 'Verify code';
  return isRu ? 'Сохранить пароль' : 'Save password';
}

function getStepErrorMessage(error: unknown, isRu: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 400) return isRu ? 'Неверный код подтверждения' : 'Incorrect verification code';
    if (error.status === 401) return isRu ? 'Сессия сброса недействительна. Подтвердите код заново.' : 'Reset session is invalid. Verify the code again.';
    if (error.status === 410) return isRu ? 'Код или сессия истекли. Начните заново.' : 'Code or session expired. Start again.';
    if (error.status === 429 || error.status === 503) return error.message;
    return error.message;
  }

  return isRu ? 'Не удалось сбросить пароль. Попробуйте снова.' : 'Password reset failed. Please try again.';
}
