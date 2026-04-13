'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi, analyticsApi, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouteParams } from '../../../../hooks/useRouteParams';

export default function EventDetailPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const { locale, get } = useRouteParams();
  const slug = get('slug');

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [volunteering, setVolunteering] = useState(false);
  const [volunteerError, setVolunteerError] = useState('');
  const [volunteerStatus, setVolunteerStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    eventsApi.get(slug)
      .then(({ event: e }) => {
        setEvent(e);
        setIsRegistered(e.isRegistered ?? false);
        const vm = e.memberships?.find((m: any) => m.role === 'VOLUNTEER');
        setVolunteerStatus(vm?.status ?? null);
        analyticsApi.track('EVENT_DETAIL_VIEW', { eventId: e.id, locale });
      })
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  async function handleRegister() {
    if (!user) return;
    setRegistering(true);
    setRegError('');
    analyticsApi.track('REGISTER_CLICK', { eventId: event.id });
    try {
      await eventsApi.register(event.id);
      setIsRegistered(true);
      setEvent((prev: any) => prev ? { ...prev, registrationsCount: prev.registrationsCount + 1 } : prev);
      analyticsApi.track('EVENT_REGISTRATION', { eventId: event.id });
    } catch (err) {
      if (err instanceof ApiError) setRegError(err.message);
    } finally {
      setRegistering(false);
    }
  }

  async function handleVolunteerApply() {
    if (!user || !event) return;
    setVolunteering(true);
    setVolunteerError('');
    try {
      await eventsApi.applyVolunteer(event.id);
      setVolunteerStatus('PENDING');
      analyticsApi.track('VOLUNTEER_APPLICATION', { eventId: event.id });
    } catch (err) {
      if (err instanceof ApiError) setVolunteerError(err.message);
    } finally {
      setVolunteering(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span>{t('common.loading')}</span>
    </div>
  );

  if (error || !event) return (
    <div className="loading-center">
      <div style={{ fontSize: '3.5rem' }}>😕</div>
      <h2 style={{ fontWeight: 800 }}>{error || 'Event not found'}</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>
        {locale === 'ru' ? 'Попробуйте вернуться к списку событий.' : 'Try going back to the event list.'}
      </p>
      <Link href={`/${locale}/events`} className="btn btn-primary" style={{ marginTop: 8 }}>
        ← {t('common.back')}
      </Link>
    </div>
  );

  const capacityPct = event.capacity > 0
    ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
    : 0;
  const isFull = event.registrationsCount >= event.capacity;
  const hasActiveVolunteer = ['PENDING', 'APPROVED', 'ACTIVE'].includes(volunteerStatus ?? '');

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', paddingBottom: 80 }}>

      {/* Cover image */}
      {event.coverImageUrl ? (
        <div style={{ width: '100%', height: 360, overflow: 'hidden', position: 'relative' }}>
          <img
            src={event.coverImageUrl}
            alt={event.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)',
          }} />
        </div>
      ) : (
        <div style={{
          width: '100%',
          height: 200,
          background: 'linear-gradient(135deg, var(--color-primary-subtle) 0%, rgba(168,85,247,0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '4rem',
        }}>
          🎪
        </div>
      )}

      <div className="container" style={{ paddingTop: 36 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          <Link href={`/${locale}`} style={{ color: 'var(--color-text-muted)', transition: 'color var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            {locale === 'ru' ? 'Главная' : 'Home'}
          </Link>
          <span>›</span>
          <Link href={`/${locale}/events`} style={{ color: 'var(--color-text-muted)', transition: 'color var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            {t('events.title')}
          </Link>
          <span>›</span>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            {event.title}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: 48, alignItems: 'start' }}>

          {/* ── Main content ─────────────────────── */}
          <div style={{ animation: 'fadeIn 0.4s ease both' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              <span className="badge badge-primary">{event.category}</span>
              {event.isFeatured && (
                <span className="badge" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                  ★ Featured
                </span>
              )}
              <span className={`badge ${event.status === 'PUBLISHED' ? 'badge-success' : event.status === 'CANCELLED' ? 'badge-danger' : 'badge-muted'}`}>
                {event.status}
              </span>
            </div>

            <h1 style={{
              margin: '0 0 16px',
              fontSize: 'clamp(1.8rem, 4vw, 2.9rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              color: 'var(--color-text-primary)',
            }}>
              {event.title}
            </h1>

            <p style={{ margin: '0 0 36px', fontSize: '1.1rem', color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
              {event.shortDescription}
            </p>

            {/* Info pills (mobile-friendly) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 36 }}>
              {[
                { icon: '📅', label: formatDate(event.startsAt) },
                { icon: '🕐', label: `${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}` },
                { icon: '📍', label: event.location },
                { icon: '👥', label: `${event.registrationsCount} / ${event.capacity}` },
              ].map(({ icon, label }) => (
                <div key={label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface-strong)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 500,
                  boxShadow: 'var(--shadow-xs)',
                }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 32 }} />

            <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {t('events.description')}
            </h2>
            <div style={{
              color: 'var(--color-text-secondary)',
              lineHeight: 1.85,
              whiteSpace: 'pre-wrap',
              fontSize: '0.97rem',
            }}>
              {event.fullDescription}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────── */}
          <div style={{ position: 'sticky', top: 84, animation: 'slideUp 0.4s ease both' }}>
            <div style={{
              padding: 28,
              borderRadius: 'var(--radius-2xl)',
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-surface-strong)',
              boxShadow: 'var(--shadow-md)',
            }}>

              {/* Capacity bar */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    👥 {event.registrationsCount} / {event.capacity}
                  </span>
                  <span style={{ color: isFull ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}>
                    {isFull
                      ? (locale === 'ru' ? 'Мест нет' : 'Full')
                      : `${Math.round(capacityPct)}%`}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-bar-fill${isFull ? ' danger' : ''}`} style={{ width: `${capacityPct}%` }} />
                </div>
              </div>

              {/* Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                <InfoRow icon="📅" label={t('events.date')} value={formatDate(event.startsAt)} />
                <InfoRow icon="🕐" label={t('events.time')} value={`${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`} />
                <InfoRow icon="📍" label={t('events.location')} value={event.location} />
              </div>

              <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 20 }} />

              {/* Register section */}
              {event.status === 'PUBLISHED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {isRegistered ? (
                    <div className="alert alert-success" style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                      ✓ {t('events.registered')}
                    </div>
                  ) : user ? (
                    <>
                      <button
                        onClick={handleRegister}
                        disabled={registering || isFull}
                        className="btn btn-primary"
                        style={{ width: '100%', height: 52, fontSize: '1rem', borderRadius: 'var(--radius-xl)' }}
                      >
                        {registering
                          ? t('common.loading')
                          : isFull
                          ? (locale === 'ru' ? 'Мест нет' : 'No spots left')
                          : t('events.join')}
                      </button>
                      {regError && <p className="alert alert-danger" style={{ margin: 0 }}>{regError}</p>}
                    </>
                  ) : (
                    <Link
                      href={`/${locale}/login`}
                      className="btn btn-primary"
                      style={{ width: '100%', height: 52, fontSize: '1rem', borderRadius: 'var(--radius-xl)', justifyContent: 'center' }}
                    >
                      🔐 {t('events.loginToJoin')}
                    </Link>
                  )}

                  {/* Volunteer */}
                  {hasActiveVolunteer ? (
                    <div className="alert" style={{
                      background: 'var(--color-primary-subtle)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-primary-glow)',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}>
                      🙋 {locale === 'ru' ? 'Заявка волонтёра:' : 'Volunteer request:'} {volunteerStatus}
                    </div>
                  ) : user ? (
                    <>
                      <button
                        onClick={handleVolunteerApply}
                        disabled={volunteering}
                        className="btn btn-ghost"
                        style={{ width: '100%', height: 46 }}
                      >
                        {volunteering
                          ? t('common.loading')
                          : volunteerStatus === 'REJECTED'
                          ? (locale === 'ru' ? 'Подать заявку снова' : 'Apply again')
                          : (locale === 'ru' ? '🙋 Стать волонтёром' : '🙋 Apply as volunteer')}
                      </button>
                      {volunteerError && <p className="alert alert-danger" style={{ margin: 0 }}>{volunteerError}</p>}
                    </>
                  ) : (
                    <Link
                      href={`/${locale}/login`}
                      className="btn btn-ghost"
                      style={{ width: '100%', height: 46, justifyContent: 'center' }}
                    >
                      {locale === 'ru' ? 'Войти как волонтёр' : 'Login to volunteer'}
                    </Link>
                  )}
                </div>
              )}

              {/* Share */}
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={handleCopyLink}
                  className="btn btn-ghost"
                  style={{ width: '100%', height: 40, fontSize: '0.875rem' }}
                >
                  {copied ? '✓ Copied!' : `🔗 ${t('events.copyLink')}`}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-primary-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.95rem',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
          {value}
        </div>
      </div>
    </div>
  );
}
