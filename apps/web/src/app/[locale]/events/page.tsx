'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi } from '../../../lib/api';
import { analyticsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, Panel, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
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

  const heroSlot = events[0];
  const nextSlots = events.slice(1, 4);
  const streamSlots = events.slice(4);
  const hasActiveFilters = Boolean(search || category);
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(category));

  return (
    <div className="public-page-shell route-shell route-events-catalog route-events-v3">
      <main className="public-main">
        <section className="public-section catalog-v3-shell motion-fade-up">
          <div className="container-wide">
            <div className="catalog-v3-header">
              <div>
                <span className="catalog-v3-kicker">{locale === 'ru' ? 'Public event stream' : 'Public event stream'}</span>
                <h1>{t('events.title')}</h1>
                <p>{locale === 'ru' ? 'Режиссированная лента с разным масштабом карточек и более сильной системой приоритета.' : 'An editorial event stream with multi-scale cards and stronger visual prioritization.'}</p>
              </div>
              <div className="catalog-v3-metrics">
                <article><small>{locale === 'ru' ? 'На странице' : 'On page'}</small><strong>{events.length}</strong></article>
                <article><small>{locale === 'ru' ? 'Активные фильтры' : 'Active filters'}</small><strong>{activeFilterCount}</strong></article>
                <article><small>{locale === 'ru' ? 'Страницы' : 'Pages'}</small><strong>{meta?.pages ?? 1}</strong></article>
              </div>
            </div>

            <Panel variant="elevated" className="catalog-v3-toolbar">
              <ToolbarRow>
                <FieldInput value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('events.searchPlaceholder')} className="public-events-search-input catalog-search-input" />
                <FieldSelect value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="public-events-category-select catalog-category-select">
                  <option value="">{t('events.category')}: {t('common.filters')}</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </FieldSelect>
                {hasActiveFilters ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Сбросить' : 'Reset'}</button> : null}
              </ToolbarRow>
              <div className="public-events-filter-chips public-events-filter-chips-stage">
                <button className={`signal-chip-link ${category === '' ? 'active' : ''}`} onClick={() => { setCategory(''); setPage(1); }}>{locale === 'ru' ? 'Все' : 'All'}</button>
                {CATEGORIES.map((item) => (
                  <button key={item} className={`signal-chip-link ${category === item ? 'active' : ''}`} onClick={() => { setCategory(item); setPage(1); }}>{item}</button>
                ))}
              </div>
            </Panel>

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
              <div className="catalog-v3-stage motion-stagger">
                {heroSlot ? (
                  <Link href={`/${locale}/events/${heroSlot.slug}`} className="catalog-v3-hero-slot">
                    <div className="catalog-v3-hero-cover">
                      {heroSlot.coverImageUrl ? <img src={heroSlot.coverImageUrl} alt={heroSlot.title} /> : <div className="cover-fallback"><span>{heroSlot.title.slice(0, 2).toUpperCase()}</span></div>}
                      <div className="public-event-cover-overlay" />
                    </div>
                    <div className="catalog-v3-hero-body">
                      <h2>{heroSlot.title}</h2>
                      <p>{heroSlot.shortDescription || (locale === 'ru' ? 'Откройте карточку события, чтобы посмотреть детали и регистрацию.' : 'Open the event destination for details and registration.')}</p>
                      <div className="public-meta-row"><span>{formatDate(heroSlot.startsAt)}</span><span>{heroSlot.location}</span><span>{heroSlot.category}</span></div>
                    </div>
                  </Link>
                ) : null}

                <div className="catalog-v3-priority-strip">
                  {nextSlots.map((event, index) => (
                    <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`catalog-v3-priority-card p-${index + 1}`}>
                      <div className="catalog-v3-priority-cover">
                        {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                      </div>
                      <div className="catalog-v3-priority-body">
                        <h3>{event.title}</h3>
                        <div className="public-meta-row"><span>{formatDate(event.startsAt)}</span><span>{event.location}</span></div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="catalog-v3-stream-list">
                  {streamSlots.map((event, index) => {
                    const capacityPct = event.capacity > 0
                      ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
                      : 0;
                    const isFull = event.registrationsCount >= event.capacity;
                    const visualState = getEventVisualState(event);

                    return (
                      <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`catalog-v3-stream-item s-${(index % 3) + 1}`}>
                        <div className="catalog-v3-stream-cover">
                          {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                        </div>
                        <div className="catalog-v3-stream-body">
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

            <Notice tone="info">
              {locale === 'ru' ? 'Используйте поиск и фильтры, чтобы быстрее найти подходящее событие.' : 'Use search and filters to find relevant events faster.'}
            </Notice>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
