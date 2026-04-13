'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

type Step = 1 | 2 | 3;

const TOTAL_STEPS = 3;

export default function RegisterPage() {
  const t = useTranslations();
  const { register } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [step, setStep]         = useState<Step>(1);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const isRu = locale === 'ru';

  /* ── Step validation ── */
  function validateStep(): string {
    if (step === 1 && name.trim().length < 2)
      return isRu ? 'Имя должно быть не короче 2 символов' : 'Name must be at least 2 characters';
    if (step === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return isRu ? 'Введите корректный email' : 'Please enter a valid email';
    if (step === 3 && password.length < 8)
      return isRu ? 'Пароль должен быть не короче 8 символов' : 'Password must be at least 8 characters';
    return '';
  }

  function handleNext() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => (s + 1) as Step);
  }

  function handleBack() {
    setError('');
    setStep(s => (s - 1) as Step);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
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

  /* ── Password strength ── */
  const strength = password.length === 0 ? 0
    : password.length < 6  ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4
    : 3;

  const strengthLabel  = ['', isRu ? 'Слабый' : 'Weak', isRu ? 'Средний' : 'Fair', isRu ? 'Хороший' : 'Good', isRu ? 'Сильный' : 'Strong'];
  const strengthColors = ['', '#ef4444', '#f59e0b', '#6366f1', '#10b981'];

  /* ── Step meta ── */
  const steps = isRu
    ? [{ label: 'Имя', icon: '👤' }, { label: 'Email', icon: '📧' }, { label: 'Пароль', icon: '🔒' }]
    : [{ label: 'Name', icon: '👤' }, { label: 'Email', icon: '📧' }, { label: 'Password', icon: '🔒' }];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 56,
    padding: '0 18px',
    borderRadius: 14,
    border: '1.5px solid #e4e4f0',
    background: '#fff',
    fontSize: '1.05rem',
    color: '#0f0f1a',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: '#fafafc',
    }}>

      {/* ── Left: dark panel ─────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        background: 'linear-gradient(145deg, #0f0f1a 0%, #1a1030 60%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href={`/${locale}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, color: '#fff', fontSize: '1rem',
              boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
            }}>✦</div>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.02em' }}>EventPlatform</span>
          </Link>
        </div>

        {/* Steps preview */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 28 }}>
            {isRu ? 'Процесс регистрации' : 'Registration steps'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {steps.map((s, i) => {
              const n = i + 1;
              const done    = step > n;
              const current = step === n;
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? '#10b981' : current ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.08)',
                    border: done || current ? 'none' : '1.5px solid rgba(255,255,255,0.12)',
                    fontSize: done ? '1rem' : '0.85rem',
                    fontWeight: 800,
                    color: '#fff',
                    boxShadow: current ? '0 4px 20px rgba(99,102,241,0.45)' : 'none',
                    transition: 'all 0.3s',
                  }}>
                    {done ? '✓' : n}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: done || current ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'color 0.3s' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
                      {done ? (isRu ? 'Заполнено' : 'Completed') : current ? (isRu ? 'Текущий шаг' : 'Current step') : (isRu ? 'Предстоит' : 'Upcoming')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom note */}
        <p style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', lineHeight: 1.6 }}>
          {isRu
            ? 'Уже есть аккаунт? '
            : 'Already have an account? '}
          <Link href={`/${locale}/login`} style={{ color: 'rgba(99,102,241,0.9)', fontWeight: 700 }}>
            {isRu ? 'Войти' : 'Sign in'}
          </Link>
        </p>
      </div>

      {/* ── Right: form ──────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        background: '#fafafc',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Progress bar */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b6b8d', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {isRu ? `Шаг ${step} из ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6366f1' }}>
                {Math.round((step / TOTAL_STEPS) * 100)}%
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: '#e4e4f0', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 99,
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                width: `${(step / TOTAL_STEPS) * 100}%`,
                transition: 'width 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
              }} />
            </div>
          </div>

          {/* Step title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f0f1a' }}>
              {step === 1 && (isRu ? 'Как вас зовут?' : 'What\'s your name?')}
              {step === 2 && (isRu ? 'Ваш email' : 'Your email')}
              {step === 3 && (isRu ? 'Создайте пароль' : 'Create a password')}
            </h1>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#6b6b8d' }}>
              {step === 1 && (isRu ? 'Это имя будет отображаться на вашем профиле' : 'This name will be shown on your profile')}
              {step === 2 && (isRu ? 'Мы никогда не передаём данные третьим лицам' : 'We never share your data with third parties')}
              {step === 3 && (isRu ? 'Минимум 8 символов. Советуем смешать буквы и цифры' : 'At least 8 characters. Mix letters and numbers')}
            </p>
          </div>

          <form onSubmit={step < TOTAL_STEPS ? (e) => { e.preventDefault(); handleNext(); } : handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Step 1: Name ── */}
            {step === 1 && (
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isRu ? 'Александр Иванов' : 'Alex Johnson'}
                  autoFocus
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e  => { e.target.style.borderColor = '#e4e4f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* ── Step 2: Email ── */}
            {step === 2 && (
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e  => { e.target.style.borderColor = '#e4e4f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* ── Step 3: Password ── */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    style={{ ...inputStyle, paddingRight: 52 }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                    onBlur={e  => { e.target.style.borderColor = '#e4e4f0'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{
                      position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1rem', color: '#a5a5c0', padding: 4, fontFamily: 'inherit',
                    }}
                  >{showPass ? '🙈' : '👁'}</button>
                </div>

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 4, borderRadius: 99,
                          background: strength >= i ? strengthColors[strength] : '#e4e4f0',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: strengthColors[strength] }}>
                      {strengthLabel[strength]}
                    </span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{
                padding: '11px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.07)',
                color: '#ef4444',
                fontSize: '0.87rem',
                fontWeight: 500,
                border: '1px solid rgba(239,68,68,0.18)',
              }}>
                {error}
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    flex: '0 0 auto', height: 52, padding: '0 20px',
                    borderRadius: 14,
                    border: '1.5px solid #e4e4f0',
                    background: '#fff',
                    color: '#3d3d5c',
                    fontWeight: 700, fontSize: '0.95rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e4e4f0')}
                >
                  ←
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1, height: 52,
                  borderRadius: 14,
                  background: loading ? '#a5a5c0' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                  color: '#fff',
                  fontWeight: 800, fontSize: '0.97rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {loading
                  ? '...'
                  : step < TOTAL_STEPS
                  ? (isRu ? 'Далее →' : 'Next →')
                  : (isRu ? 'Создать аккаунт ✓' : 'Create account ✓')}
              </button>
            </div>
          </form>

          {/* Review summary after step 1 */}
          {step > 1 && (
            <div style={{
              marginTop: 20,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(99,102,241,0.05)',
              border: '1px solid rgba(99,102,241,0.12)',
              fontSize: '0.85rem',
              color: '#6b6b8d',
            }}>
              {step >= 2 && name && (
                <div style={{ display: 'flex', gap: 8, marginBottom: step >= 3 && email ? 6 : 0 }}>
                  <span>👤</span>
                  <span style={{ fontWeight: 600, color: '#3d3d5c' }}>{name}</span>
                </div>
              )}
              {step >= 3 && email && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span>📧</span>
                  <span style={{ fontWeight: 600, color: '#3d3d5c' }}>{email}</span>
                </div>
              )}
            </div>
          )}

          <p style={{ marginTop: 22, textAlign: 'center', color: '#a5a5c0', fontSize: '0.82rem', lineHeight: 1.5 }}>
            {isRu
              ? 'Создавая аккаунт, вы соглашаетесь с условиями использования'
              : 'By creating an account you agree to our Terms of Service'}
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="background: linear-gradient(145deg"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
