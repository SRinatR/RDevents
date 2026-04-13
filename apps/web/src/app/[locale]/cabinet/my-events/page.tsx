'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function CabinetMyEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [activeTab, setActiveTab] = useState('my-events');
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

  if (loading || !user) return null; // Wait for layout

  const handleTabChange = (tab: string) => {
    if (tab === 'all-events') router.push(`/${locale}/cabinet/events`);
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
        Мероприятия
      </h1>

      <div className="cabinet-tabs">
        <button onClick={() => handleTabChange('my-events')} className={`cabinet-tab ${activeTab === 'my-events' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Мои мероприятия
        </button>
        <button onClick={() => handleTabChange('all-events')} className={`cabinet-tab ${activeTab === 'all-events' ? 'active' : ''}`} style={{ background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', paddingBottom: 12 }}>
          Все мероприятия
        </button>
      </div>

      <div>
        {eventsLoading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>Загрузка...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-xl)' }}>
            <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)' }}>Вы пока не участвуете ни в одном мероприятии</p>
            <Link href={`/${locale}/cabinet/events`} className="btn btn-primary btn-sm">Исследовать</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {events.map((r: any) => {
              const statusLabel = r.status === 'PENDING' ? 'На рассмотрении' : (r.status === 'APPROVED' || r.status === 'ACTIVE' ? 'Заявка одобрена' : r.status);
              const isPending = r.status === 'PENDING';

              return (
                <Link key={r.registrationId} href={`/${locale}/cabinet/my-events/${r.event.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', 
                    borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', 
                    background: 'var(--color-surface)', transition: 'border-color var(--transition-fast)' 
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-glow)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                  >
                    {r.event.coverImageUrl ? (
                      <img src={r.event.coverImageUrl} alt="" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--color-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🎪</div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                        {r.event.location} &nbsp;&nbsp; {new Date(r.event.startsAt).toLocaleDateString()} — {new Date(r.event.endsAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {r.event.title}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span className={`badge ${isPending ? 'badge-muted' : 'badge-success'}`} style={{ padding: '6px 16px', fontSize: '0.85rem', fontWeight: 700, borderRadius: 'var(--radius-full)', background: isPending ? 'rgba(245,158,11,0.1)' : 'rgba(22,163,74,0.1)', color: isPending ? '#d97706' : '#16a34a' }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
