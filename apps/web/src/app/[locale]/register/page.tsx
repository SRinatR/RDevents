'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError, authApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

export default function RegisterPage() {
  const t = useTranslations();
  const { completeRegistration } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [devCode, setDevCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const isRu = locale === 'ru';

  function validateStep(): string {
    if (step === 1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return isRu ? 'Введите корректный email' : 'Please enter a valid email';
    if (step === 2 && !/^\d{6}$/.test(code.trim()))
      return isRu ? 'Введите 6-значный код из письма' : 'Enter the 6-digit verification code';
    if (step === 3 && password.length < 8)
      return isRu ? 'Пароль должен быть не короче 8 символов' : 'Password must be at least 8 characters';
    return '';
  }

  function handleBack() {
    setError('');
    setSuccess('');
    setStep((currentStep) => (currentStep - 1) as Step);
  }

  async function handleStartRegistration() {
    const validationError = validateStep();
    if (validationError) { setError(validationError); return; }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authApi.startRegistration({ email });
      setDevCode(result.devCode ?? '');
      setStep(2);
      setSuccess(isRu ? 'Код подтверждения отправлен на email' : 'Verification code sent to your email');
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    const validationError = validateStep();
    if (validationError) { setError(validationError); return; }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authApi.verifyRegistrationCode({ email, code: code.trim() });
      setRegistrationToken(result.registrationToken);
      setStep(3);
      setSuccess(isRu ? 'Email подтвержден. Теперь придумайте пароль.' : 'Email verified. Create your password.');
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteRegistration() {
    const validationError = validateStep();
    if (validationError) { setError(validationError); return; }
    if (!registrationToken) {
      setError(isRu ? 'Сессия подтверждения истекла. Проверьте код заново.' : 'Verification session expired. Verify the code again.');
      setStep(2);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await completeRegistration(email, registrationToken, password);
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
      if (err instanceof ApiError && (err.status === 401 || err.status === 410)) {
        setRegistrationToken('');
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (step === 1) {
      await handleStartRegistration();
      return;
    }

    if (step === 2) {
      await handleVerifyCode();
      return;
    }

    await handleCompleteRegistration();
  }

  async function handleResendCode() {
    if (loading) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authApi.startRegistration({ email });
      setDevCode(result.devCode ?? '');
      setCode('');
      setRegistrationToken('');
      setSuccess(isRu ? 'Новый код отправлен на email' : 'A new code has been sent to your email');
    } catch (err) {
      setError(getStepErrorMessage(err, isRu));
    } finally {
      setLoading(false);
    }
  }

  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
      : password.length < 10 ? 2
        : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4
          : 3;

  const stepItems = [
    { id: 1, title: 'Email' },
    { id: 2, title: isRu ? 'Код подтверждения' : 'Verification code' },
    { id: 3, title: isRu ? 'Пароль' : 'Password' },
  ] as const;

  return (
    <section className="register-workspace">
      <div className="register-shell">
        <aside className="register-rail">
          <Link href={`/${locale}`} className="public-logo">
            <img src="/site-logo.png" alt="Русский Дом" className="public-logo-mark public-logo-mark-auth" />
          </Link>

          <div className="register-rail-copy">
            <h1>{isRu ? 'Создайте аккаунт участника' : 'Create your participant account'}</h1>
            <p>{isRu ? 'Быстрая регистрация. Полный профиль можно заполнить позже в кабинете.' : 'Fast signup. Full profile can be completed later in cabinet.'}</p>
          </div>

          <ol className="register-step-list" aria-label={isRu ? 'Этапы регистрации' : 'Registration steps'}>
            {stepItems.map((item) => {
              const state = step > item.id ? 'done' : step === item.id ? 'active' : 'upcoming';
              return (
                <li key={item.id} className={`register-step-item is-${state}`}>
                  <span className="register-step-index">{item.id}</span>
                  <span className="register-step-text">{item.title}</span>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="register-main">
          <div className="register-panel">
            <header className="register-panel-head">
              <div className="register-panel-heading">
                <h2>{getStepTitle(step, isRu)}</h2>
                <p>{isRu ? 'Уже есть аккаунт?' : 'Already have an account?'} <Link href={`/${locale}/login`}>{isRu ? 'Войти' : 'Sign in'}</Link></p>
              </div>
              <div className="register-progress-block">
                <span>{isRu ? `Шаг ${step} из ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}</span>
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="signal-stack register-form-stack">
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
                  <button type="button" onClick={handleResendCode} className="btn btn-secondary btn-sm register-resend-button" disabled={loading}>
                    {isRu ? 'Отправить код заново' : 'Resend code'}
                  </button>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div className="signal-field-wrap">
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.password')} className="signal-field signal-field-with-action" autoFocus />
                    <button type="button" onClick={() => setShowPass((value) => !value)} className="auth-eye-toggle">{showPass ? 'Hide' : 'Show'}</button>
                  </div>
                  <div className="signal-muted">{isRu ? 'Сложность пароля' : 'Password strength'}: {['', 'Weak', 'Fair', 'Good', 'Strong'][strength]}</div>
                </>
              ) : null}

              {error ? <div className="signal-notice tone-danger auth-inline-notice">{error}</div> : null}
              {success ? <div className="signal-notice auth-inline-notice">{success}</div> : null}

              <Toolbar step={step} onBack={handleBack} loading={loading} isRu={isRu} />
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function Toolbar({ step, onBack, loading, isRu }: { step: Step; onBack: () => void; loading: boolean; isRu: boolean }) {
  return (
    <div className="auth-actions-row">
      {step > 1 ? <button type="button" onClick={onBack} className="btn btn-secondary btn-sm">{isRu ? 'Назад' : 'Back'}</button> : null}
      <button type="submit" disabled={loading} className="btn btn-primary btn-sm auth-primary-action">
        {loading ? '...' : getStepActionLabel(step, isRu)}
      </button>
    </div>
  );
}

function getStepTitle(step: Step, isRu: boolean) {
  if (step === 1) return 'Email';
  if (step === 2) return isRu ? 'Код подтверждения' : 'Verification code';
  return isRu ? 'Пароль' : 'Password';
}

function getStepActionLabel(step: Step, isRu: boolean) {
  if (step === 1) return isRu ? 'Получить код' : 'Send code';
  if (step === 2) return isRu ? 'Подтвердить код' : 'Verify code';
  return isRu ? 'Создать аккаунт' : 'Create account';
}

function getStepErrorMessage(error: unknown, isRu: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 409) return isRu ? 'Пользователь с таким email уже существует' : 'User with this email already exists';
    if (error.status === 400) return isRu ? 'Неверный код подтверждения' : 'Incorrect verification code';
    if (error.status === 401) return isRu ? 'Сессия подтверждения недействительна. Подтвердите код заново.' : 'Registration session is invalid. Verify the code again.';
    if (error.status === 410) return isRu ? 'Код или сессия истекли. Начните заново.' : 'Code or session expired. Start again.';
    if (error.status === 429 || error.status === 503) return error.message;
    return error.message;
  }

  return isRu ? 'Ошибка регистрации. Попробуйте снова.' : 'Registration failed. Please try again.';
}
