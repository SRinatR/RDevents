'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi } from '../../../lib/api';
import { analyticsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';

const CATEGORIES = ['Tech', 'Community', 'Business', 'Design', 'Arts & Culture', 'Sports'];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PUBLISHED:  { label: 'Published',  className: 'badge-success' },
  CANCELLED:  { label: 'Cancelled',  className: 'badge-danger' },
  COMPLETED:  { label: 'Completed',  className: 'badge-muted' },
  DRAFT:      { label: 'Draft',      className: 'badge-warning' },
};

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

  const filtersActive = search || category;

  return (
    <div className="page-shell">
      <main style={{ flex: 1, padding: '48px 0 80px' }}>
        <div className="container">

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
              {t('events.title')}
            </h1>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1.05rem' }}>
              {t('events.subtitle')}
            </p>
          </div>

          {/* Search + filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: '1rem', color: 'var(--color-text-muted)', pointerEvents: 'none',
              }}>🔍</span>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('events.searchPlaceholder')}
                className="input-field"
                style={{ paddingLeft: 40 }}
              />
            </div>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1); }}
              className="input-field"
              style={{ width: 'auto', flex: '0 0 auto', minWidth: 160 }}
            >
              <option value="">{t('events.category')}: {t('common.filters')}</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {filtersActive && (
              <button
                onClick={() => { setSearch(''); setCategory(''); setPage(1); }}
                className="btn btn-ghost"
              >
                × {t('common.filters')}
              </button>
            )}
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
            <button
              onClick={() => { setCategory(''); setPage(1); }}
              className="badge"
              style={{
                cursor: 'pointer',
                border: 'none',
                background: !category ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                color: !category ? '#fff' : 'var(--color-text-muted)',
                padding: '7px 16px',
                fontSize: '0.82rem',
                transition: 'all var(--transition-fast)',
              }}
            >
              {locale === 'ru' ? 'Все' : 'All'}
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => { setCategory(c); setPage(1); }}
                className="badge"
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  background: category === c ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                  color: category === c ? '#fff' : 'var(--color-text-muted)',
                  padding: '7px 16px',
                  fontSize: '0.82rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Skeletons */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 'var(--radius-2xl)', overflow: 'hidden', border: '1.5px solid var(--color-border)' }}>
                  <div className="skeleton" style={{ height: 168 }} />
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="skeleton" style={{ height: 20, width: '40%', borderRadius: 'var(--radius-full)' }} />
                    <div className="skeleton" style={{ height: 16, width: '80%' }} />
                    <div className="skeleton" style={{ height: 12, width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <h3 className="empty-state-title">{error}</h3>
              <button onClick={load} className="btn btn-primary" style={{ marginTop: 16 }}>
                {t('common.retry')}
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && events.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🎪</div>
              <h3 className="empty-state-title">{t('events.emptyTitle')}</h3>
              <p className="empty-state-text">{t('events.emptySubtitle')}</p>
            </div>
          )}

          {/* Events grid */}
          {!loading && !error && events.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {events.map((event, i) => {
                  const statusCfg = STATUS_CONFIG[event.status] ?? { label: event.status, className: 'badge-muted' };
                  const capacityPct = event.capacity > 0
                    ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
                    : 0;
                  const isFull = event.registrationsCount >= event.capacity;

                  return (
                    <Link
                      key={event.id}
                      href={`/${locale}/events/${event.slug}`}
                      className="event-card"
                      style={{ animationDelay: `${i * 0.04}s`, animation: 'fadeIn 0.4s ease both' }}
                    >
                      {event.coverImageUrl ? (
                        <img src={event.coverImageUrl} alt={event.title} className="event-card-cover" loading="lazy" />
                      ) : (
                        <div className="event-card-cover-placeholder">🎪</div>
                      )}

                      <div className="event-card-body">
                        <div className="event-card-header">
                          <span className="badge badge-primary">{event.category}</span>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {event.isFeatured && <span className="badge" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>★</span>}
                            <span className={`badge ${statusCfg.className}`}>{statusCfg.label}</span>
                          </div>
                        </div>

                        <h3 className="event-card-title">{event.title}</h3>
                        <p className="event-card-desc">{event.shortDescription}</p>

                        <div className="event-card-meta">
                          <span>📅 {formatDate(event.startsAt)}</span>
                          <span>📍 {event.location}</span>
                        </div>

                        <div className="event-card-footer">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <span>👥 {event.registrationsCount}/{event.capacity}</span>
                            {isFull && <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                              {locale === 'ru' ? 'Мест нет' : 'Full'}
                            </span>}
                          </div>
                          <div className="progress-bar">
                            <div
                              className={`progress-bar-fill${isFull ? ' danger' : ''}`}
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                        </div>

                        {event.isRegistered && (
                          <div className="alert alert-success" style={{ marginTop: 10, textAlign: 'center', fontWeight: 700 }}>
                            ✓ {t('events.registered')}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {meta && meta.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 48 }}>
                  <button
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="btn btn-ghost btn-sm"
                    style={{ width: 38, height: 38, padding: 0, borderRadius: 'var(--radius-md)' }}
                  >
                    ←
                  </button>
                  {Array.from({ length: meta.pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="btn btn-sm"
                      style={{
                        width: 38,
                        height: 38,
                        padding: 0,
                        borderRadius: 'var(--radius-md)',
                        background: p === page ? 'var(--color-primary)' : 'var(--color-surface-strong)',
                        color: p === page ? '#fff' : 'var(--color-text-primary)',
                        border: '1.5px solid',
                        borderColor: p === page ? 'var(--color-primary)' : 'var(--color-border)',
                        fontWeight: 700,
                        boxShadow: p === page ? 'var(--shadow-primary)' : 'none',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, meta.pages))}
                    disabled={page === meta.pages}
                    className="btn btn-ghost btn-sm"
                    style={{ width: 38, height: 38, padding: 0, borderRadius: 'var(--radius-md)' }}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
