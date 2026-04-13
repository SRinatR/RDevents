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
        const volunteerMembership = e.memberships?.find((membership: any) => membership.role === 'VOLUNTEER');
        setVolunteerStatus(volunteerMembership?.status ?? null);
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
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  if (error || !event) return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: '3rem' }}>😕</div>
      <p style={{ color: 'var(--color-text-muted)' }}>{error || 'Event not found'}</p>
      <Link href={`/${locale}/events`} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700 }}>
        {t('common.back')}
      </Link>
    </div>
  );

  const hasActiveVolunteerApplication = ['PENDING', 'APPROVED', 'ACTIVE'].includes(volunteerStatus ?? '');

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '0 0 60px' }}>
      {/* Cover */}
      {event.coverImageUrl && (
        <div style={{ width: '100%', height: 320, overflow: 'hidden', position: 'relative' }}>
          <img src={event.coverImageUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5))' }} />
        </div>
      )}

      <div className="container" style={{ paddingTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 40, alignItems: 'start' }}>
          {/* Main content */}
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-lg)', background: 'rgba(28,100,242,0.1)', color: 'var(--color-primary)' }}>
                {event.category}
              </span>
              {event.isFeatured && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-lg)', background: 'rgba(220,38,38,0.1)', color: 'var(--color-accent)' }}>
                  ★ Featured
                </span>
              )}
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius-lg)', background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                {event.status}
              </span>
            </div>

            <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: 0, lineHeight: 1.05 }}>
              {event.title}
            </h1>

            <p style={{ margin: '0 0 32px', fontSize: '1.1rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {event.shortDescription}
            </p>

            <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 800 }}>{t('events.description')}</h2>
            <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {event.fullDescription}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div style={{ padding: 24, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                <InfoRow label={t('events.date')} value={formatDate(event.startsAt)} />
                <InfoRow label={t('events.time')} value={`${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`} />
                <InfoRow label={t('events.location')} value={event.location} />
                <InfoRow label={t('events.capacity')} value={`${event.registrationsCount} / ${event.capacity}`} />
              </div>

              {/* Register / status button */}
              {event.status === 'PUBLISHED' && (
                <>
                  {isRegistered ? (
                    <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontWeight: 700, textAlign: 'center', fontSize: '0.95rem' }}>
                      ✓ {t('events.registered')}
                    </div>
                  ) : user ? (
                    <>
                      <button
                        onClick={handleRegister}
                        disabled={registering || event.registrationsCount >= event.capacity}
                        style={{ width: '100%', height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '1rem', boxShadow: 'var(--shadow-sm)', opacity: registering ? 0.7 : 1 }}
                      >
                        {registering ? t('common.loading') : event.registrationsCount >= event.capacity ? 'Full' : t('events.join')}
                      </button>
                      {regError && <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--color-danger)', textAlign: 'center' }}>{regError}</p>}
                    </>
                  ) : (
                    <Link
                      href={`/${locale}/login`}
                      style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}
                    >
                      {t('events.loginToJoin')}
                    </Link>
                  )}

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                    {hasActiveVolunteerApplication ? (
                      <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(28,100,242,0.08)', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'center', fontSize: '0.9rem' }}>
                        Volunteer request: {volunteerStatus}
                      </div>
                    ) : user ? (
                      <>
                        <button
                          onClick={handleVolunteerApply}
                          disabled={volunteering}
                          style={{ width: '100%', height: 44, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-primary)', background: 'white', color: 'var(--color-primary)', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', opacity: volunteering ? 0.7 : 1 }}
                        >
                          {volunteering ? t('common.loading') : volunteerStatus === 'REJECTED' ? 'Apply as volunteer again' : 'Apply as volunteer'}
                        </button>
                        {volunteerError && <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--color-danger)', textAlign: 'center' }}>{volunteerError}</p>}
                      </>
                    ) : (
                      <Link
                        href={`/${locale}/login`}
                        style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.9rem' }}
                      >
                        Login to volunteer
                      </Link>
                    )}
                  </div>
                </>
              )}

              <button
                onClick={handleCopyLink}
                style={{ marginTop: 12, width: '100%', height: 40, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}
              >
                {copied ? '✓ Copied!' : t('events.copyLink')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
