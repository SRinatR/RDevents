'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { eventsApi } from '../../../lib/api';
import { analyticsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Panel, StatusBadge } from '@/components/ui/signal-primitives';
import { PublicFooter } from '../../../components/layout/PublicFooter';

const CATEGORIES = ['Tech', 'Community', 'Business', 'Design', 'Arts & Culture', 'Sports'];

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

  function getVisualState(event: any) {
    const capacity = Number(event.capacity ?? 0);
    const registrations = Number(event.registrationsCount ?? 0);
    const isFull = capacity > 0 && registrations >= capacity;
    const isLimited = !isFull && capacity > 0 && registrations / capacity >= 0.75;
    const isUpcoming = new Date(event.startsAt).getTime() > Date.now();

    if (event.status === 'CANCELLED') return { label: locale === 'ru' ? 'Отменено' : 'Cancelled', tone: 'danger' as const };
    if (isFull) return { label: locale === 'ru' ? 'Мест нет' : 'Full', tone: 'warning' as const };
    if (isLimited) return { label: locale === 'ru' ? 'Почти заполнено' : 'Limited spots', tone: 'warning' as const };
    if (isUpcoming) return { label: locale === 'ru' ? 'Скоро' : 'Upcoming', tone: 'info' as const };
    return { label: locale === 'ru' ? 'Открыто' : 'Open', tone: 'success' as const };
  }

  const hasActiveFilters = Boolean(search || category);
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(category));

  return (
    <div className="public-page-shell route-shell route-events-catalog route-events-v4">
      <main className="public-main">
        <section className="public-section catalog-v4-shell motion-fade-up">
          <div className="container-wide">

            {/* Compact catalog header — title, subtitle, inline metrics */}
            <header className="catalog-v5-header">
              <div>
                <h1>{t('events.title')}</h1>
                <p>{t('events.subtitle')}</p>
              </div>
              <div className="catalog-v5-metrics">
                {hasActiveFilters && (
                  <span className="catalog-v5-metric-pill catalog-v5-metric-active">
                    {activeFilterCount} {locale === 'ru'
                      ? (activeFilterCount === 1 ? 'фильтр' : 'фильтра')
                      : (activeFilterCount === 1 ? 'filter' : 'filters')}
                  </span>
                )}
                {!loading && meta && meta.pages > 1 && (
                  <span className="catalog-v5-metric-pill">
                    {locale === 'ru' ? `Стр. ${page} / ${meta.pages}` : `Page ${page} / ${meta.pages}`}
                  </span>
                )}
              </div>
            </header>

            <div className="catalog-v4-layout">
              {/* Filter rail — unchanged */}
              <aside className="catalog-v4-filter-rail">
                <Panel variant="elevated" className="catalog-v4-filter-panel">
                  <div className="catalog-v4-filter-head">
                    <h2>{locale === 'ru' ? 'Поиск и фильтры' : 'Search and filters'}</h2>
                    {hasActiveFilters
                      ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Сбросить' : 'Reset'}</button>
                      : null}
                  </div>

                  <div className="catalog-v4-filter-fields">
                    <FieldInput
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder={t('events.searchPlaceholder')}
                      className="public-events-search-input"
                    />
                    <FieldSelect
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                      className="public-events-category-select"
                    >
                      <option value="">{t('events.category')}: {t('common.filters')}</option>
                      {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </FieldSelect>
                  </div>

                  <div className="catalog-v4-filter-chips">
                    <button
                      className={`signal-chip-link ${category === '' ? 'active' : ''}`}
                      onClick={() => { setCategory(''); setPage(1); }}
                    >
                      {locale === 'ru' ? 'Все' : 'All'}
                    </button>
                    {CATEGORIES.map((item) => (
                      <button
                        key={item}
                        className={`signal-chip-link ${category === item ? 'active' : ''}`}
                        onClick={() => { setCategory(item); setPage(1); }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </Panel>
              </aside>

              {/* Results column — uniform card grid */}
              <div className="catalog-v4-results-column">
                {loading ? <LoadingLines rows={8} /> : null}

                {error && !loading ? (
                  <EmptyState
                    title={error}
                    description={locale === 'ru' ? 'Повторите запрос или измените параметры фильтра.' : 'Retry the request or adjust filter settings.'}
                    actions={<button onClick={load} className="btn btn-primary btn-sm">{t('common.retry')}</button>}
                  />
                ) : null}

                {!loading && !error && events.length === 0 ? (
                  <EmptyState
                    title={t('events.emptyTitle')}
                    description={hasActiveFilters
                      ? (locale === 'ru' ? 'По этим фильтрам ничего не найдено. Сбросьте фильтры и попробуйте снова.' : 'No events matched these filters. Reset and try a broader search.')
                      : t('events.emptySubtitle')}
                    actions={hasActiveFilters
                      ? <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Сбросить фильтры' : 'Reset filters'}</button>
                      : undefined}
                  />
                ) : null}

                {!loading && !error && events.length > 0 ? (
                  <div className="catalog-v5-grid motion-stagger">
                    {events.map((event) => {
                      const capacity = Number(event.capacity ?? 0);
                      const registrations = Number(event.registrationsCount ?? 0);
                      const capacityPct = capacity > 0 ? Math.min((registrations / capacity) * 100, 100) : 0;
                      const isFull = capacity > 0 && registrations >= capacity;
                      const showProgress = capacity > 0;
                      const visualState = getVisualState(event);

                      return (
                        <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="catalog-v5-card">
                          <div className="catalog-v5-card-cover">
                            {event.coverImageUrl
                              ? <img src={event.coverImageUrl} alt={event.title} />
                              : <div className="cover-fallback"><span>{event.title.slice(0, 2).toUpperCase()}</span></div>}
                          </div>
                          <div className="catalog-v5-card-body">
                            <h3>{event.title}</h3>
                            <div className="public-meta-row">
                              <span>{formatDate(event.startsAt)}</span>
                              <span>{event.location}</span>
                            </div>
                            <div className="catalog-v5-card-footer">
                              <StatusBadge tone={visualState.tone} size="sm">{visualState.label}</StatusBadge>
                              <span className="catalog-v5-card-category">{event.category}</span>
                            </div>
                            {showProgress && (
                              <div className="progress-bar public-event-progress">
                                <div className={`progress-bar-fill${isFull ? ' danger' : ''}`} style={{ width: `${capacityPct}%` }} />
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                {meta && meta.pages > 1 ? (
                  <div className="public-pagination catalog-pagination">
                    <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1} className="btn btn-ghost btn-sm">
                      {locale === 'ru' ? 'Назад' : 'Prev'}
                    </button>
                    {Array.from({ length: meta.pages }, (_, i) => i + 1).map((item) => (
                      <button key={item} onClick={() => setPage(item)} className={`btn btn-sm ${item === page ? 'btn-primary' : 'btn-secondary'}`}>
                        {item}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(p + 1, meta.pages))} disabled={page === meta.pages} className="btn btn-ghost btn-sm">
                      {locale === 'ru' ? 'Далее' : 'Next'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
