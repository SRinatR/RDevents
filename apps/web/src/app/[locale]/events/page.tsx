'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi } from '../../../lib/api';
import { analyticsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

const CATEGORIES = ['Tech', 'Community', 'Business', 'Design', 'Arts & Culture', 'Sports'];

function statusBadgeStyle(status: string) {
  if (status === 'PUBLISHED') return { background: 'rgba(22,163,74,0.1)', color: '#16a34a' };
  if (status === 'CANCELLED') return { background: 'rgba(220,38,38,0.1)', color: '#dc2626' };
  if (status === 'COMPLETED') return { background: 'rgba(100,116,139,0.1)', color: '#64748b' };
  return { background: 'rgba(217,119,6,0.1)', color: '#d97706' };
}

export default function EventsPage() {
  const t = useTranslations();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit: 12 };
      if (search) params['search'] = search;
      if (category) params['category'] = category;
      const result = await eventsApi.list(params);
      setEvents(result.data);
      setMeta(result.meta);
    } catch {
      setError(t('events.errorTitle'));
    } finally {
      setLoading(false);
    }
  }, [search, category, page, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { analyticsApi.track('EVENTS_LIST_VIEW', { locale }); }, [locale]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="page-shell">
      <main style={{ flex: 1, padding: '40px 0' }}>
        <div className="container">
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, letterSpacing: 0 }}>
            {t('events.title')}
          </h1>
          <p style={{ margin: '0 0 32px', color: 'var(--color-text-muted)' }}>{t('events.subtitle')}</p>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('events.searchPlaceholder')}
              style={{ flex: '1 1 220px', height: 42, padding: '0 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontSize: '0.95rem', outline: 'none' }}
            />
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1); }}
              style={{ height: 42, padding: '0 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', fontSize: '0.95rem', background: 'white', cursor: 'pointer', minWidth: 140 }}
            >
              <option value="">{t('events.category')}: {t('common.filters')}</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(search || category) && (
              <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} style={{ height: 42, padding: '0 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                × {t('common.filters')}
              </button>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 280, borderRadius: 'var(--radius-2xl)', background: 'var(--color-border)', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>{error}</p>
              <button onClick={load} style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                {t('common.retry')}
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎪</div>
              <h3 style={{ margin: '0 0 8px', fontWeight: 800 }}>{t('events.emptyTitle')}</h3>
              <p style={{ color: 'var(--color-text-muted)' }}>{t('events.emptySubtitle')}</p>
            </div>
          )}

          {/* Events grid */}
          {!loading && !error && events.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {events.map(event => (
                  <Link key={event.id} href={`/${locale}/events/${event.slug}`} style={{ textDecoration: 'none' }}>
                    <article style={{
                      borderRadius: 'var(--radius-2xl)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      overflow: 'hidden',
                      transition: 'transform 180ms, box-shadow 180ms',
                      cursor: 'pointer',
                    }}
                      onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-4px)'; (e.currentTarget as any).style.boxShadow = 'var(--shadow-md)'; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = ''; }}
                    >
                      {event.coverImageUrl && (
                        <img src={event.coverImageUrl} alt={event.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} loading="lazy" />
                      )}
                      <div style={{ padding: '16px 20px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-lg)', background: 'rgba(28,100,242,0.08)', color: 'var(--color-primary)' }}>
                            {event.category}
                          </span>
                          {event.isFeatured && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-lg)', background: 'rgba(220,38,38,0.1)', color: 'var(--color-accent)' }}>
                              ★ FEATURED
                            </span>
                          )}
                        </div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800, lineHeight: 1.3, color: 'var(--color-text-primary)' }}>
                          {event.title}
                        </h3>
                        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {event.shortDescription}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                          <span>📅 {formatDate(event.startsAt)}</span>
                          <span>📍 {event.location}</span>
                          <span>👥 {event.registrationsCount}/{event.capacity}</span>
                        </div>
                        {event.isRegistered && (
                          <div style={{ marginTop: 12, padding: '6px 12px', borderRadius: 'var(--radius-lg)', background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
                            ✓ {t('events.registered')}
                          </div>
                        )}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                  {Array.from({ length: meta.pages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)} style={{ width: 36, height: 36, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: p === page ? 'var(--color-primary)' : 'white', color: p === page ? '#fff' : 'var(--color-text-primary)', fontWeight: 700, cursor: 'pointer' }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
