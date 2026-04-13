'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function MyEventsPage() {
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
    eventsApi.myEvents().then(r => setEvents(r.events)).catch(() => {}).finally(() => setEventsLoading(false));
  }, [user]);

  if (loading || !user) return <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</span></div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 60px' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, letterSpacing: 0 }}>{t('cabinet.myEvents')}</h1>
          <Link href={`/${locale}/events`} style={{ padding: '10px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
            {t('home.exploreCta')}
          </Link>
        </div>

        {eventsLoading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎪</div>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800 }}>{t('cabinet.noEvents')}</h3>
            <Link href={`/${locale}/events`} style={{ display: 'inline-block', marginTop: 16, padding: '12px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', fontWeight: 700 }}>
              {t('home.exploreCta')}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {events.map((r: any) => (
              <Link key={r.registrationId} href={`/${locale}/events/${r.event.slug}`} style={{ textDecoration: 'none' }}>
                <article style={{ borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden', transition: 'transform 180ms' }}
                  onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; }}
                >
                  {r.event.coverImageUrl && <img src={r.event.coverImageUrl} alt={r.event.title} style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
                  <div style={{ padding: '14px 18px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-lg)', background: 'rgba(28,100,242,0.08)', color: 'var(--color-primary)' }}>{r.event.category}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-lg)', background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>✓ Registered</span>
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 800, lineHeight: 1.3 }}>{r.event.title}</h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>📅 {new Date(r.event.startsAt).toLocaleDateString()} • 📍 {r.event.location}</div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
