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
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('cabinet.title')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('cabinet.subtitle')}</p>
        </div>

        {/* Quick nav */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
          {[
            { href: `/${locale}/cabinet/profile`, label: t('cabinet.profile') },
            { href: `/${locale}/cabinet/events`, label: t('cabinet.myEvents') },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ padding: '10px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)', background: 'var(--color-surface)' }}>
              {label}
            </Link>
          ))}
        </div>

        {/* Summary grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
          {[
            { label: t('cabinet.myEvents'), value: events.length, icon: '🎪' },
            { label: t('cabinet.connectedAccounts'), value: user.accounts?.length ?? 0, icon: '🔗' },
            { label: 'Role', value: user.role, icon: '👤' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ padding: 22, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: 0 }}>{value}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* User info card */}
        <div style={{ padding: 24, borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, flexShrink: 0 }}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{user.name}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{user.email}</div>
              {user.city && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>📍 {user.city}</div>}
            </div>
            <Link href={`/${locale}/cabinet/profile`} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
              {t('common.edit')}
            </Link>
          </div>
          {user.bio && <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>{user.bio}</p>}
        </div>

        {/* Recent events */}
        <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem', fontWeight: 800 }}>{t('cabinet.myEvents')}</h2>
        {eventsLoading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : events.length === 0 ? (
          <div style={{ padding: '32px', borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {t('cabinet.noEvents')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.slice(0, 3).map((r: any) => (
              <Link key={r.registrationId} href={`/${locale}/events/${r.event.slug}`} style={{ display: 'flex', gap: 14, padding: 16, borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', textDecoration: 'none' }}>
                {r.event.coverImageUrl && <img src={r.event.coverImageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />}
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>{r.event.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>📅 {new Date(r.event.startsAt).toLocaleDateString()}</div>
                </div>
              </Link>
            ))}
            {events.length > 3 && (
              <Link href={`/${locale}/cabinet/events`} style={{ textAlign: 'center', padding: '10px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                {t('common.viewAll')} ({events.length}) →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
