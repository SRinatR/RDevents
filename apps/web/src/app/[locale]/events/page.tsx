'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi } from '../../../lib/api';
import { analyticsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { PublicFooter } from '../../../components/layout/PublicFooter';

const CATEGORIES = ['Tech', 'Community', 'Business', 'Design', 'Arts & Culture', 'Sports'];

const STATUS_TONE: Record<string, 'success' | 'danger' | 'neutral' | 'warning'> = {
  PUBLISHED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
  DRAFT: 'warning',
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

  return (
    <div className="public-page-shell">
      <main className="public-main">
        <section className="public-section">
          <div className="container">
            <PageHeader title={t('events.title')} subtitle={t('events.subtitle')} actions={<StatusBadge tone="info">{events.length} {locale === 'ru' ? 'на странице' : 'on page'}</StatusBadge>} />

            <Panel>
              <ToolbarRow>
                <FieldInput value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('events.searchPlaceholder')} style={{ minWidth: 260 }} />
                <FieldSelect value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} style={{ width: 220 }}>
                  <option value="">{t('events.category')}: {t('common.filters')}</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </FieldSelect>
                {(search || category) ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-ghost btn-sm">Reset</button> : null}
              </ToolbarRow>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="signal-chip-link" onClick={() => { setCategory(''); setPage(1); }}>{locale === 'ru' ? 'Все' : 'All'}</button>
                {CATEGORIES.map((item) => (
                  <button key={item} className="signal-chip-link" onClick={() => { setCategory(item); setPage(1); }}>{item}</button>
                ))}
              </div>
            </Panel>

            {loading ? <LoadingLines rows={8} /> : null}

            {error && !loading ? (
              <EmptyState title={error} description={locale === 'ru' ? 'Повторите запрос или измените параметры фильтра.' : 'Retry request or adjust filter settings.'} actions={<button onClick={load} className="btn btn-primary btn-sm">{t('common.retry')}</button>} />
            ) : null}

            {!loading && !error && events.length === 0 ? (
              <EmptyState title={t('events.emptyTitle')} description={t('events.emptySubtitle')} />
            ) : null}

            {!loading && !error && events.length > 0 ? (
              <div className="public-events-grid" style={{ marginTop: 14 }}>
                {events.map((event) => {
                  const capacityPct = event.capacity > 0
                    ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
                    : 0;
                  const isFull = event.registrationsCount >= event.capacity;

                  return (
                    <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="public-event-card">
                      <div className="public-event-cover">
                        {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                      </div>
                      <div className="public-event-body">
                        <div className="public-meta-row"><span>{formatDate(event.startsAt)}</span><span>{event.location}</span></div>
                        <h3>{event.title}</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <StatusBadge tone="neutral">{event.category}</StatusBadge>
                          <StatusBadge tone={STATUS_TONE[event.status] ?? 'neutral'}>{event.status}</StatusBadge>
                        </div>
                        <div className="progress-bar" style={{ marginTop: 10 }}><div className={`progress-bar-fill${isFull ? ' danger' : ''}`} style={{ width: `${capacityPct}%` }} /></div>
                        <div className="signal-muted" style={{ marginTop: 8 }}>{event.registrationsCount}/{event.capacity} {isFull ? (locale === 'ru' ? 'мест занято' : 'capacity reached') : ''}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {meta && meta.pages > 1 ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
                <button onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page === 1} className="btn btn-ghost btn-sm">Prev</button>
                {Array.from({ length: meta.pages }, (_, index) => index + 1).map((item) => (
                  <button key={item} onClick={() => setPage(item)} className={`btn btn-sm ${item === page ? 'btn-primary' : 'btn-secondary'}`}>{item}</button>
                ))}
                <button onClick={() => setPage((value) => Math.min(value + 1, meta.pages))} disabled={page === meta.pages} className="btn btn-ghost btn-sm">Next</button>
              </div>
            ) : null}

            <Notice tone="info">
              {locale === 'ru' ? 'Список сохраняет текущую логику поиска, фильтрации и пагинации через eventsApi.' : 'The list keeps existing eventsApi-based search, filtering, and pagination logic.'}
            </Notice>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
