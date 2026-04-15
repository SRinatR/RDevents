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

    if (event.status === 'CANCELLED') {
      return { key: 'cancelled', label: locale === 'ru' ? 'Отменено' : 'Cancelled', tone: 'danger' as const };
    }
    if (isFull) {
      return { key: 'full', label: locale === 'ru' ? 'Мест нет' : 'Full', tone: 'warning' as const };
    }
    if (isLimited) {
      return { key: 'limited', label: locale === 'ru' ? 'Почти заполнено' : 'Limited spots', tone: 'warning' as const };
    }
    if (isUpcoming) {
      return { key: 'upcoming', label: locale === 'ru' ? 'Скоро' : 'Upcoming', tone: 'info' as const };
    }
    return { key: 'normal', label: locale === 'ru' ? 'Открыто' : 'Open', tone: 'success' as const };
  }

  const dominantEvent = events[0];
  const secondaryLead = events[1];
  const remainingEvents = events.slice(2);
  const hasActiveFilters = Boolean(search || category);
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(category));

  return (
    <div className="public-page-shell route-shell route-events-catalog route-events-catalog-rebuilt">
      <main className="public-main">
        <section className="public-section public-events-catalog-shell catalog-shell catalog-shell-rebuilt motion-fade-up">
          <div className="container">
            <div className="catalog-cinematic-header motion-fade-up-fast">
              <div>
                <span className="catalog-kicker">{locale === 'ru' ? 'Event stream' : 'Event stream'}</span>
                <h1>{t('events.title')}</h1>
                <p>{locale === 'ru' ? 'Сильная лента событий с кураторской первой линией и быстрым входом в участие.' : 'A stronger event stream with a curated first line and quick entry to participation.'}</p>
              </div>
              <div className="catalog-header-stats">
                <article><small>{locale === 'ru' ? 'На странице' : 'On page'}</small><strong>{events.length}</strong></article>
                <article><small>{locale === 'ru' ? 'Фильтры' : 'Filters'}</small><strong>{activeFilterCount}</strong></article>
                <article><small>{locale === 'ru' ? 'Страницы' : 'Pages'}</small><strong>{meta?.pages ?? 1}</strong></article>
              </div>
            </div>

            <Panel variant="elevated" className="catalog-toolbar-shell catalog-toolbar-shell-rebuilt">
              <ToolbarRow>
                <FieldInput value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('events.searchPlaceholder')} className="public-events-search-input catalog-search-input" />
                <FieldSelect value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="public-events-category-select catalog-category-select">
                  <option value="">{t('events.category')}: {t('common.filters')}</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </FieldSelect>
                {hasActiveFilters ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Сбросить' : 'Reset'}</button> : null}
              </ToolbarRow>

              <div className="public-events-filter-chips public-events-filter-chips-stage catalog-filter-chips">
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
              <div className="catalog-curated-grid motion-stagger">
                {dominantEvent ? (
                  <Link href={`/${locale}/events/${dominantEvent.slug}`} className="public-event-card catalog-dominant-card">
                    <div className="public-event-cover">
                      {dominantEvent.coverImageUrl ? <img src={dominantEvent.coverImageUrl} alt={dominantEvent.title} /> : <div className="cover-fallback"><span>{dominantEvent.title.slice(0, 2).toUpperCase()}</span></div>}
                      <div className="public-event-cover-overlay" />
                    </div>
                    <div className="public-event-body">
                      <h3>{dominantEvent.title}</h3>
                      <p>{dominantEvent.shortDescription || (locale === 'ru' ? 'Откройте карточку, чтобы посмотреть детали и условия участия.' : 'Open event details to view info and participation options.')}</p>
                      <div className="public-meta-row catalog-meta-row"><span>{formatDate(dominantEvent.startsAt)}</span><span>{dominantEvent.location}</span></div>
                      <div className="public-event-card-footer catalog-card-footer">
                        <StatusBadge tone={STATUS_TONE[dominantEvent.status] ?? 'neutral'}>{dominantEvent.status}</StatusBadge>
                        <StatusBadge tone="neutral">{dominantEvent.category}</StatusBadge>
                        {dominantEvent.isFeatured ? <StatusBadge tone="info">{locale === 'ru' ? 'В фокусе' : 'Featured'}</StatusBadge> : null}
                      </div>
                    </div>
                  </Link>
                ) : null}

                {secondaryLead ? (
                  <Link href={`/${locale}/events/${secondaryLead.slug}`} className="public-event-card catalog-secondary-lead-card">
                    <div className="public-event-cover">
                      {secondaryLead.coverImageUrl ? <img src={secondaryLead.coverImageUrl} alt={secondaryLead.title} /> : <div className="cover-fallback"><span>{secondaryLead.title.slice(0, 2).toUpperCase()}</span></div>}
                      <div className="public-event-cover-overlay" />
                    </div>
                    <div className="public-event-body">
                      <h3>{secondaryLead.title}</h3>
                      <div className="public-meta-row catalog-meta-row"><span>{formatDate(secondaryLead.startsAt)}</span><span>{secondaryLead.location}</span></div>
                    </div>
                  </Link>
                ) : null}

                <div className="public-events-grid public-events-grid-secondary catalog-stack-grid">
                  {remainingEvents.map((event) => {
                    const capacityPct = event.capacity > 0
                      ? Math.min((event.registrationsCount / event.capacity) * 100, 100)
                      : 0;
                    const isFull = event.registrationsCount >= event.capacity;
                    const visualState = getEventVisualState(event);

                    return (
                      <Link key={event.id} href={`/${locale}/events/${event.slug}`} className={`public-event-card public-event-card-${visualState.key} catalog-list-card`}>
                        <div className="public-event-cover">
                          {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} /> : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                          <div className="public-event-cover-overlay" />
                        </div>
                        <div className="public-event-body">
                          <div className="public-meta-row catalog-meta-row"><span>{formatDate(event.startsAt)}</span><span>{event.location}</span></div>
                          <h3>{event.title}</h3>
                          <div className="public-event-badges">
                            <StatusBadge tone={visualState.tone} size="sm">{visualState.label}</StatusBadge>
                            <StatusBadge tone={STATUS_TONE[event.status] ?? 'neutral'}>{event.status}</StatusBadge>
                          </div>
                          <div className="public-event-card-footer catalog-card-footer">
                            <StatusBadge tone="neutral">{event.category}</StatusBadge>
                            <span className="signal-muted">{event.registrationsCount}/{event.capacity}</span>
                            <span className="catalog-open-link">{locale === 'ru' ? 'Открыть' : 'Open'}</span>
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
