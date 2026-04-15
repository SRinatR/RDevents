'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

type Step = 1 | 2;
const TOTAL_STEPS = 2;

export default function RegisterPage() {
  const t = useTranslations();
  const { register } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRu = locale === 'ru';

  function validateStep(): string {
    if (step === 1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return isRu ? 'Введите корректный email' : 'Please enter a valid email';
    if (step === 2 && password.length < 8)
      return isRu ? 'Пароль должен быть не короче 8 символов' : 'Password must be at least 8 characters';
    return '';
  }

  function handleNext() {
    const validationError = validateStep();
    if (validationError) { setError(validationError); return; }
    setError('');
    setStep((currentStep) => (currentStep + 1) as Step);
  }

  function handleBack() {
    setError('');
    setStep((currentStep) => (currentStep - 1) as Step);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateStep();
    if (validationError) { setError(validationError); return; }
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError(isRu ? 'Пользователь с таким email уже существует' : 'User with this email already exists');
        else setError(err.message);
      } else {
        setError(isRu ? 'Ошибка регистрации. Попробуйте снова.' : 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
      : password.length < 10 ? 2
        : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4
          : 3;

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <Link href={`/${locale}`} className="public-logo">
          <span className="public-logo-mark">EP</span>
          <span className="public-logo-text">EventPlatform</span>
        </Link>
        <div className="auth-brand-content">
          <h1>{isRu ? 'Создайте аккаунт участника' : 'Create your participant account'}</h1>
          <p>{isRu ? 'Быстрая регистрация. Полный профиль можно заполнить позже в кабинете.' : 'Fast signup. Full profile can be completed later in cabinet.'}</p>
          <div className="auth-brand-badges">
            <span>{isRu ? 'Быстрый старт' : 'Quick start'}</span>
            <span>{isRu ? 'Гибкий профиль' : 'Flexible profile'}</span>
            <span>{isRu ? 'Рабочий кабинет' : 'Workspace ready'}</span>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-progress-top">
            <span>{isRu ? `Шаг ${step} из ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}</span>
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div>
          </div>

          <h2>{step === 1 ? (isRu ? 'Email' : 'Email') : (isRu ? 'Пароль' : 'Password')}</h2>
          <p>{isRu ? 'Уже есть аккаунт?' : 'Already have an account?'} <Link href={`/${locale}/login`}>{isRu ? 'Войти' : 'Sign in'}</Link></p>

          <form onSubmit={step < TOTAL_STEPS ? (event) => { event.preventDefault(); handleNext(); } : handleSubmit} className="signal-stack">
            {step === 1 ? (
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="signal-field" autoFocus />
            ) : (
              <>
                <div className="signal-field-wrap">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('auth.password')} className="signal-field signal-field-with-action" autoFocus />
                  <button type="button" onClick={() => setShowPass((value) => !value)} className="auth-eye-toggle">{showPass ? 'Hide' : 'Show'}</button>
                </div>
                <div className="signal-muted">{isRu ? 'Сложность пароля' : 'Password strength'}: {['', 'Weak', 'Fair', 'Good', 'Strong'][strength]}</div>
              </>
            )}

            {error ? <div className="signal-notice tone-danger auth-inline-notice">{error}</div> : null}

            <Toolbar step={step} onBack={handleBack} loading={loading} isRu={isRu} />
          </form>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ step, onBack, loading, isRu }: { step: Step; onBack: () => void; loading: boolean; isRu: boolean }) {
  return (
    <div className="auth-actions-row">
      {step > 1 ? <button type="button" onClick={onBack} className="btn btn-secondary btn-sm">{isRu ? 'Назад' : 'Back'}</button> : null}
      <button type="submit" disabled={loading} className="btn btn-primary btn-sm auth-primary-action">
        {loading ? '...' : step < TOTAL_STEPS ? (isRu ? 'Далее' : 'Next') : (isRu ? 'Создать аккаунт' : 'Create account')}
      </button>
    </div>
  );
}
