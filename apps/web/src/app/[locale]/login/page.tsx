'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { authApi, setAccessToken } from '../../../lib/api';
import { ApiError } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

const SOCIAL_PROVIDERS = [
  { id: 'google'   as const, label: 'Google',   emoji: 'G', bg: '#4285F4' },
  { id: 'yandex'   as const, label: 'Yandex',   emoji: 'Y', bg: '#FC3F1D' },
  { id: 'telegram' as const, label: 'Telegram', emoji: '✈', bg: '#2AABEE' },
] as const;

export default function LoginPage() {
  const t = useTranslations();
  const { login, refreshUser } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    setSocialLoading(provider);
    setError('');
    try {
      const mock = {
        providerAccountId: `demo_${provider}_${Date.now()}`,
        providerEmail: `demo_${provider}@example.com`,
        providerUsername: `Demo ${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      };
      let result;
      if (provider === 'google')        result = await authApi.loginWithGoogle(mock);
      else if (provider === 'yandex')   result = await authApi.loginWithYandex(mock);
      else                              result = await authApi.loginWithTelegram(mock);
      setAccessToken(result.accessToken);
      await refreshUser();
      router.push(`/${locale}/cabinet`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSocialLoading('');
    }
  }

  const isRu = locale === 'ru';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: '#fafafc',
    }}>

      {/* ── Left panel: branding ──────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        background: 'linear-gradient(145deg, #0f0f1a 0%, #1a1030 60%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '45%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href={`/${locale}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            textDecoration: 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 900, color: '#fff',
              boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
            }}>✦</div>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.02em' }}>
              EventPlatform
            </span>
          </Link>
        </div>

        {/* Center quote */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 'clamp(1.8rem, 3vw, 2.8rem)',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: 20,
          }}>
            {isRu ? (
              <><span style={{ opacity: 0.55 }}>Создавайте</span><br />незабываемые<br /><span style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>события</span></>
            ) : (
              <><span style={{ opacity: 0.55 }}>Create</span><br />unforgettable<br /><span style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>events</span></>
            )}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 320 }}>
            {isRu
              ? 'Платформа для организаторов, участников и волонтёров'
              : 'The platform for organizers, participants, and volunteers'}
          </p>
        </div>

        {/* Bottom stats */}
        <div style={{ display: 'flex', gap: 32, position: 'relative', zIndex: 1 }}>
          {[
            { n: '10+', l: isRu ? 'событий' : 'events' },
            { n: '4',   l: isRu ? 'способа входа' : 'auth methods' },
            { n: '∞',   l: isRu ? 'возможностей' : 'possibilities' },
          ].map(({ n, l }) => (
            <div key={l}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>{n}</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ─────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        background: '#fafafc',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <h1 style={{ margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f0f1a' }}>
            {isRu ? 'Вход' : 'Sign in'}
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: '0.95rem', color: '#6b6b8d' }}>
            {isRu ? 'Нет аккаунта? ' : "Don't have an account? "}
            <Link href={`/${locale}/register`} style={{ color: '#6366f1', fontWeight: 700 }}>
              {isRu ? 'Создать' : 'Create one'}
            </Link>
          </p>

          {/* ── Email / Password form FIRST ── */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3d3d5c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  height: 50,
                  padding: '0 16px',
                  borderRadius: 12,
                  border: '1.5px solid #e4e4f0',
                  background: '#fff',
                  fontSize: '0.97rem',
                  color: '#0f0f1a',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e  => (e.target.style.borderColor = '#e4e4f0')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3d3d5c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('auth.password')}
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    height: 50,
                    padding: '0 48px 0 16px',
                    borderRadius: 12,
                    border: '1.5px solid #e4e4f0',
                    background: '#fff',
                    fontSize: '0.97rem',
                    color: '#0f0f1a',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#6366f1')}
                  onBlur={e  => (e.target.style.borderColor = '#e4e4f0')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.95rem', color: '#a5a5c0', padding: 4, lineHeight: 1,
                  }}
                  aria-label="Toggle visibility"
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '11px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                fontSize: '0.88rem',
                fontWeight: 500,
                border: '1px solid rgba(239,68,68,0.18)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                height: 52,
                borderRadius: 14,
                background: loading ? '#a5a5c0' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.97rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {loading ? '...' : (isRu ? 'Войти' : 'Sign in')}
            </button>
          </form>

          {/* ── Divider ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0', color: '#a5a5c0', fontSize: '0.82rem', fontWeight: 600 }}>
            <div style={{ flex: 1, height: 1, background: '#e4e4f0' }} />
            <span>{isRu ? 'или войдите через' : 'or continue with'}</span>
            <div style={{ flex: 1, height: 1, background: '#e4e4f0' }} />
          </div>

          {/* ── Social buttons SECOND ── */}
          <div style={{ display: 'flex', gap: 10 }}>
            {SOCIAL_PROVIDERS.map(({ id, label, emoji, bg }) => (
              <button
                key={id}
                onClick={() => handleSocial(id)}
                disabled={!!socialLoading || loading}
                title={isRu ? `Войти через ${label}` : `Continue with ${label}`}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  border: '1.5px solid #e4e4f0',
                  background: socialLoading === id ? '#f4f4f8' : '#fff',
                  cursor: socialLoading === id || loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!loading && !socialLoading) { (e.currentTarget as HTMLElement).style.borderColor = bg; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${bg}30`; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e4e4f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <span style={{ fontWeight: 900, fontSize: '0.9rem', color: bg, lineHeight: 1 }}>
                  {socialLoading === id ? '…' : emoji}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#a5a5c0', fontWeight: 600, letterSpacing: '0.02em' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Mobile: hide left panel — handled via media (still accessible via globals) */}
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
