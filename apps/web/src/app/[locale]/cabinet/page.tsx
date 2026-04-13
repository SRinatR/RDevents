'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../hooks/useAuth';
import { eventsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

export default function CabinetPage() {
  const t = useTranslations();
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user) return;
    eventsApi.myEvents()
      .then(r => setEvents(r.events))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, [user]);

  if (loading || !user) return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );

  const summaryCards = [
    { icon: '🎪', value: events.length, label: t('cabinet.myEvents'),         bg: 'var(--color-primary-subtle)',  iconBg: 'var(--color-primary)' },
    { icon: '🔗', value: user.accounts?.length ?? 0, label: t('cabinet.connectedAccounts'), bg: 'rgba(168,85,247,0.08)', iconBg: '#a855f7' },
    { icon: '👤', value: user.role, label: locale === 'ru' ? 'Роль' : 'Role', bg: 'var(--color-success-subtle)',  iconBg: 'var(--color-success)' },
  ] as const;

  const navLinks = [
    { href: `/${locale}/cabinet/profile`, label: t('cabinet.profile'),   icon: '👤' },
    { href: `/${locale}/cabinet/events`,  label: t('cabinet.myEvents'),  icon: '🎪' },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '48px 0 80px' }}>
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 36, animation: 'fadeIn 0.4s ease both' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em' }}>
            {t('cabinet.title')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
            {t('cabinet.subtitle')}
          </p>
        </div>

        {/* Quick nav */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 36 }}>
          {navLinks.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="nav-chip">
              {icon} {label}
            </Link>
          ))}
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
          {summaryCards.map(({ icon, value, label, bg, iconBg }) => (
            <div key={label} className="stat-card" style={{ animation: 'slideUp 0.4s ease both' }}>
              <div className="stat-card-icon" style={{ background: bg }}>
                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              </div>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          ))}
        </div>

        {/* User info card */}
        <div style={{
          padding: '24px 28px',
          borderRadius: 'var(--radius-2xl)',
          border: '1.5px solid var(--color-border)',
          background: 'var(--color-surface-strong)',
          marginBottom: 36,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: user.bio ? 16 : 0 }}>
            {/* Avatar */}
            <div style={{
              width: 62,
              height: 62,
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--color-primary), #a855f7)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 900,
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-primary)',
            }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--color-text-primary)' }}>
                {user.name}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: 2 }}>
                {user.email}
              </div>
              {user.city && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 3 }}>
                  📍 {user.city}
                </div>
              )}
            </div>

            <Link
              href={`/${locale}/cabinet/profile`}
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0 }}
            >
              ✏️ {t('common.edit')}
            </Link>
          </div>

          {user.bio && (
            <p style={{
              margin: 0,
              paddingTop: 16,
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
              lineHeight: 1.65,
            }}>
              {user.bio}
            </p>
          )}
        </div>

        {/* My events */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
            {t('cabinet.myEvents')}
          </h2>
          {events.length > 3 && (
            <Link href={`/${locale}/cabinet/events`} className="btn btn-ghost btn-sm">
              {t('common.viewAll')} ({events.length}) →
            </Link>
          )}
        </div>

        {eventsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 84, borderRadius: 'var(--radius-xl)' }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={{
            padding: '40px 24px',
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px dashed var(--color-border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎪</div>
            <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t('cabinet.noEvents')}
            </p>
            <Link href={`/${locale}/events`} className="btn btn-primary btn-sm">
              {locale === 'ru' ? 'Найти события' : 'Browse events'}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.slice(0, 3).map((r: any) => (
              <Link
                key={r.registrationId}
                href={`/${locale}/events/${r.event.slug}`}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-xl)',
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface-strong)',
                  textDecoration: 'none',
                  alignItems: 'center',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary-glow)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {r.event.coverImageUrl ? (
                  <img
                    src={r.event.coverImageUrl}
                    alt=""
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-lg)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: 'var(--radius-lg)', flexShrink: 0,
                    background: 'var(--color-primary-subtle)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                  }}>🎪</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.event.title}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    📅 {new Date(r.event.startsAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span style={{ color: 'var(--color-text-faint)', fontSize: '1.1rem' }}>›</span>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
