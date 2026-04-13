'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';

export default function CabinetAllEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [activeTab, setActiveTab] = useState('all-events');
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    eventsApi.list()
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  if (loading || !user) return null; // Wait for layout

  const handleTabChange = (tab: string) => {
    if (tab === 'my-events') router.push(`/${locale}/cabinet/my-events`);
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
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
            Мероприятий пока нет
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {events.map((e: any) => {
              const isOpen = new Date(e.registrationDeadline) > new Date();

              return (
                <div key={e.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', 
                  borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', 
                  background: 'var(--color-surface)'
                }}>
                  {e.coverImageUrl ? (
                    <img src={e.coverImageUrl} alt="" style={{ width: 100, height: 100, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 100, height: 100, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🎪</div>
                  )}
                  
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                      {e.location} &nbsp;&nbsp; {new Date(e.startsAt).toLocaleDateString()} — {new Date(e.endsAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {e.title}
                    </div>
                    {!isOpen && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', marginTop: 8 }}>
                        Регистрация доступна только до {new Date(e.registrationDeadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isOpen ? (
                       <Link href={`/${locale}/events/${e.slug}`} className="btn btn-primary">
                         Подать заявку
                       </Link>
                    ) : (
                       <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.9rem' }}>
                         Регистрация недоступна
                       </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
