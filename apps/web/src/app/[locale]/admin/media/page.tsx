'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { adminApi, eventMediaApi, type EventMediaSummary } from '@/lib/api';
import { EmptyState, FieldInput, LoadingLines, Notice, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type AdminMediaEvent = {
  id: string;
  title: string;
  slug?: string | null;
  status?: string | null;
  startsAt?: string | null;
  location?: string | null;
  category?: string | null;
};

type EventMediaOverview = {
  summary?: EventMediaSummary;
  pendingSuggestions?: number;
  error?: string;
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminMediaBankPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [events, setEvents] = useState<AdminMediaEvent[]>([]);
  const [overview, setOverview] = useState<Record<string, EventMediaOverview>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadEvents = useCallback(async () => {
    setPageLoading(true);
    setError('');
    try {
      const result = await adminApi.listEvents({ limit: 80, ...(search ? { search } : {}), ...(status ? { status } : {}) });
      const nextEvents = (result.data ?? []) as AdminMediaEvent[];
      setEvents(nextEvents);

      const pairs = await Promise.all(nextEvents.slice(0, 30).map(async (event) => {
        try {
          const [summaryResult, suggestionsResult] = await Promise.all([
            eventMediaApi.summary(event.id),
            eventMediaApi.captionSuggestions.adminList(event.id, { status: 'PENDING' }),
          ]);
          return [event.id, { summary: summaryResult.summary, pendingSuggestions: suggestionsResult.suggestions.length }] as const;
        } catch (err: any) {
          return [event.id, { error: getFriendlyApiErrorMessage(err, locale) }] as const;
        }
      }));
      setOverview(Object.fromEntries(pairs));
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
      setEvents([]);
      setOverview({});
    } finally {
      setPageLoading(false);
    }
  }, [locale, search, status]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const handle = window.setTimeout(() => void loadEvents(), 220);
    return () => window.clearTimeout(handle);
  }, [user, isAdmin, loadEvents]);

  const totals = useMemo(() => {
    return Object.values(overview).reduce((acc, item) => {
      acc.media += item.summary?.activeTotal ?? item.summary?.total ?? 0;
      acc.pending += item.summary?.pending ?? 0;
      acc.suggestions += item.pendingSuggestions ?? 0;
      return acc;
    }, { media: 0, pending: 0, suggestions: 0 });
  }, [overview]);

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page admin-media-bank-index-page">
      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader
          title={isRu ? 'Фотобанк' : 'Media bank'}
          subtitle={isRu
            ? 'Отдельный раздел для работы с медиабанками мероприятий: материалы, массовая загрузка, альбомы и подписи на модерации.'
            : 'A dedicated section for event media banks: media, bulk upload, albums, and pending caption suggestions.'}
        />
        <div className="workspace-status-strip workspace-status-strip-v2">
          <div className="workspace-status-card"><small>{isRu ? 'Мероприятий' : 'Events'}</small><strong>{events.length}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Материалов' : 'Media items'}</small><strong>{totals.media}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Медиа на модерации' : 'Pending media'}</small><strong>{totals.pending}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Подписей на модерации' : 'Pending captions'}</small><strong>{totals.suggestions}</strong></div>
        </div>
        <ToolbarRow>
          <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск мероприятия' : 'Search events'} />
          <select className="signal-field signal-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{isRu ? 'Все статусы' : 'All statuses'}</option>
            <option value="PUBLISHED">{isRu ? 'Опубликованные' : 'Published'}</option>
            <option value="DRAFT">{isRu ? 'Черновики' : 'Drafts'}</option>
            <option value="COMPLETED">{isRu ? 'Завершённые' : 'Completed'}</option>
            <option value="CANCELLED">{isRu ? 'Отменённые' : 'Cancelled'}</option>
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadEvents()}>
            {isRu ? 'Обновить' : 'Refresh'}
          </button>
        </ToolbarRow>
      </Panel>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {pageLoading ? <LoadingLines rows={8} /> : events.length ? (
        <div className="admin-event-media-list">
          {events.map((event) => {
            const item = overview[event.id];
            return (
              <article key={event.id} className="admin-event-media-card">
                <div className="admin-event-media-body">
                  <div className="admin-event-media-title-row">
                    <strong>{event.title}</strong>
                    <span className="badge badge-muted">{event.status ?? 'EVENT'}</span>
                  </div>
                  <div className="signal-muted">
                    {[formatDate(event.startsAt, locale), event.location, event.category].filter(Boolean).join(' · ')}
                  </div>
                  <div className="workspace-status-strip workspace-status-strip-v2">
                    <div className="workspace-status-card"><small>{isRu ? 'Всего' : 'Total'}</small><strong>{item?.summary?.activeTotal ?? item?.summary?.total ?? '—'}</strong></div>
                    <div className="workspace-status-card"><small>{isRu ? 'Опубликовано' : 'Approved'}</small><strong>{item?.summary?.approved ?? '—'}</strong></div>
                    <div className="workspace-status-card"><small>{isRu ? 'Медиа на модерации' : 'Pending media'}</small><strong>{item?.summary?.pending ?? '—'}</strong></div>
                    <div className="workspace-status-card"><small>{isRu ? 'Подписи' : 'Captions'}</small><strong>{item?.pendingSuggestions ?? '—'}</strong></div>
                  </div>
                  {item?.error ? <Notice tone="warning">{item.error}</Notice> : null}
                  <ToolbarRow>
                    <Link className="btn btn-primary btn-sm" href={`/${locale}/admin/events/${event.id}/media`}>
                      {isRu ? 'Открыть фотобанк' : 'Open media bank'}
                    </Link>
                    <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/events/${event.id}/media/captions`}>
                      {isRu ? 'Подписи на модерации' : 'Caption moderation'}
                    </Link>
                    <Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/events/${event.id}/overview`}>
                      {isRu ? 'К мероприятию' : 'Event workspace'}
                    </Link>
                  </ToolbarRow>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={isRu ? 'Мероприятия не найдены' : 'No events found'}
          description={isRu ? 'Измените фильтр или создайте мероприятие.' : 'Change filters or create an event.'}
          actions={<Link href={`/${locale}/admin/events`} className="btn btn-primary">{isRu ? 'К мероприятиям' : 'Go to events'}</Link>}
        />
      )}
    </div>
  );
}
