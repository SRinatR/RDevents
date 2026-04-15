'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi } from '../../../lib/api';
import { analyticsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, Panel, StatusBadge } from '@/components/ui/signal-primitives';
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

  function getEventVisualState(event: any) {
    const capacity = Number(event.capacity ?? 0);
    const registrations = Number(event.registrationsCount ?? 0);
    const isFull = capacity > 0 && registrations >= capacity;
    const capacityRatio = capacity > 0 ? registrations / capacity : 0;
    const isLimited = !isFull && capacity > 0 && capacityRatio >= 0.75;
    const isUpcoming = new Date(event.startsAt).getTime() > Date.now();

    if (event.status === 'CANCELLED') return { label: locale === 'ru' ? 'Отменено' : 'Cancelled', tone: 'danger' as const };
    if (isFull) return { label: locale === 'ru' ? 'Мест нет' : 'Full', tone: 'warning' as const };
    if (isLimited) return { label: locale === 'ru' ? 'Почти заполнено' : 'Limited spots', tone: 'warning' as const };
    if (isUpcoming) return { label: locale === 'ru' ? 'Скоро' : 'Upcoming', tone: 'info' as const };
    return { label: locale === 'ru' ? 'Открыто' : 'Open', tone: 'success' as const };
  }

  const leadEvent = events[0];
  const supportEvents = events.slice(1, 3);
  const riverEvents = events.slice(3);
  const hasActiveFilters = Boolean(search || category);
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(category));

  return (
    <div className="public-page-shell route-shell route-events-catalog route-events-v4">
      <main className="public-main">
        <section className="public-section catalog-v4-shell motion-fade-up">
          <div className="container-wide">
            <header className="catalog-v4-header">
              <div>
                <span className="catalog-v4-kicker">{locale === 'ru' ? 'Event destination stream' : 'Event destination stream'}</span>
                <h1>{t('events.title')}</h1>
                <p>{locale === 'ru' ? 'Каталог построен как режиссированная лента: ключевой слот, поддерживающие релизы и основной поток.' : 'Catalog is structured as an editorial stream: key slot, supporting releases, and a continuous event river.'}</p>
              </div>
              <div className="catalog-v4-metrics">
                <article><small>{locale === 'ru' ? 'На странице' : 'On page'}</small><strong>{events.length}</strong></article>
                <article><small>{locale === 'ru' ? 'Активные фильтры' : 'Active filters'}</small><strong>{activeFilterCount}</strong></article>
                <article><small>{locale === 'ru' ? 'Всего страниц' : 'Total pages'}</small><strong>{meta?.pages ?? 1}</strong></article>
              </div>
            </header>

            <div className="catalog-v4-layout">
              <aside className="catalog-v4-filter-rail">
                <Panel variant="elevated" className="catalog-v4-filter-panel">
                  <div className="catalog-v4-filter-head">
                    <h2>{locale === 'ru' ? 'Поиск и фильтрация' : 'Search and filters'}</h2>
                    {hasActiveFilters ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Сбросить' : 'Reset'}</button> : null}
                  </div>

                  <div className="catalog-v4-filter-fields">
                    <FieldInput value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('events.searchPlaceholder')} className="public-events-search-input" />
                    <FieldSelect value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="public-events-category-select">
                      <option value="">{t('events.category')}: {t('common.filters')}</option>
                      {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </FieldSelect>
                  </div>

                  <div className="catalog-v4-filter-chips">
                    <button className={`signal-chip-link ${category === '' ? 'active' : ''}`} onClick={() => { setCategory(''); setPage(1); }}>{locale === 'ru' ? 'Все' : 'All'}</button>
                    {CATEGORIES.map((item) => (
                      <button key={item} className={`signal-chip-link ${category === item ? 'active' : ''}`} onClick={() => { setCategory(item); setPage(1); }}>{item}</button>
                    ))}
                  </div>
                </Panel>
              </aside>

              <div className="catalog-v4-results-column">
                {loading ? <LoadingLines rows={8} /> : null}

                {error && !loading ? (
                  <EmptyState title={error} description={locale === 'ru' ? 'Повторите запрос или измените параметры фильтра.' : 'Retry request or adjust filter settings.'} actions={<button onClick={load} className="btn btn-primary btn-sm">{t('common.retry')}</button>} />
                ) : null}

                {!loading && !error && events.length === 0 ? (
                  <EmptyState
                    title={t('events.emptyTitle')}
                    description={hasActiveFilters
                      ? (locale === 'ru' ? 'По этим фильтрам ничего не найдено. Сбросьте фильтры и попробуйте снова.' : 'No events matched these filters. Reset and try a broader query.')
                      : t('events.emptySubtitle')}
                    actions={hasActiveFilters
                      ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Сбросить фильтры' : 'Reset filters'}</button>
                      : undefined}
                  />
                ) : null}

                {!loading && !error && events.length > 0 ? (
                  <div className="catalog-v4-editorial-stage motion-stagger">
                    {leadEvent ? (
                      <Link href={`/${locale}/events/${leadEvent.slug}`} className="catalog-v4-lead-slot">
                        <div className="catalog-v4-lead-cover">
                          {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <div className="cover-fallback"><span>{leadEvent.title.slice(0, 2).toUpperCase()}</span></div>}
                        </div>
                        <div className="catalog-v4-lead-body">
                          <h2>{leadEvent.title}</h2>
                          <p>{leadEvent.shortDescription || (locale === 'ru' ? 'Откройте страницу события для подробностей и действий участия.' : 'Open the event page for full details and participation actions.')}</p>
                          <div className="public-meta-row"><span>{formatDate(leadEvent.startsAt)}</span><span>{leadEvent.location}</span><span>{leadEvent.category}</span></div>
                        </div>
                      </Link>
                    ) : null}

                    <div className="catalog-v4-support-stack">
                      {supportEvents.map((event) => (
                        <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="catalog-v4-support-card">
                          <div className="catalog-v4-support-cover">
                            {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                          </div>
                          <div className="catalog-v4-support-body">
                            <h3>{event.title}</h3>
                            <div className="public-meta-row"><span>{formatDate(event.startsAt)}</span><span>{event.location}</span></div>
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="catalog-v4-river">
                      {riverEvents.map((event, index) => {
                        const capacityPct = event.capacity > 0
                          ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
                          : 0;
                        const isFull = event.registrationsCount >= event.capacity;
                        const visualState = getEventVisualState(event);

                        return (
                          <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`catalog-v4-river-item ${index % 2 === 0 ? 'media-left' : 'media-right'}`}>
                            <div className="catalog-v4-river-cover">
                              {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                            </div>
                            <div className="catalog-v4-river-body">
                              <h4>{event.title}</h4>
                              <div className="public-meta-row"><span>{formatDate(event.startsAt)}</span><span>{event.location}</span></div>
                              <div className="public-event-badges">
                                <StatusBadge tone={visualState.tone} size="sm">{visualState.label}</StatusBadge>
                                <StatusBadge tone={STATUS_TONE[event.status] ?? 'neutral'}>{event.status}</StatusBadge>
                                <StatusBadge tone="neutral">{event.category}</StatusBadge>
                              </div>
                              <div className="progress-bar public-event-progress"><div className={`progress-bar-fill${isFull ? ' danger' : ''}`} style={{ width: `${capacityPct}%` }} /></div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {meta && meta.pages > 1 ? (
                  <div className="public-pagination catalog-pagination">
                    <button onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page === 1} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Назад' : 'Prev'}</button>
                    {Array.from({ length: meta.pages }, (_, index) => index + 1).map((item) => (
                      <button key={item} onClick={() => setPage(item)} className={`btn btn-sm ${item === page ? 'btn-primary' : 'btn-secondary'}`}>{item}</button>
                    ))}
                    <button onClick={() => setPage((value) => Math.min(value + 1, meta.pages))} disabled={page === meta.pages} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Далее' : 'Next'}</button>
                  </div>
                ) : null}
              </div>
            </div>

            <Notice tone="info">
              {locale === 'ru' ? 'Используйте фильтры слева, чтобы быстро сузить поток и открыть подходящий формат участия.' : 'Use the left-side filters to narrow the stream and open the right participation format faster.'}
            </Notice>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
