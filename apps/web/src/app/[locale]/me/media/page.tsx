'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { eventsApi, eventMediaApi } from '@/lib/api';
import { EmptyState, FieldInput, LoadingLines, Notice, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type MyMediaEvent = {
  id: string;
  slug?: string | null;
  title: string;
  status?: string | null;
  startsAt?: string | null;
  location?: string | null;
  role?: string | null;
  membershipStatus?: string | null;
};

type EventOverview = {
  publicCount?: number;
  myCount?: number;
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

export default function ParticipantMediaBankIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [events, setEvents] = useState<MyMediaEvent[]>([]);
  const [overview, setOverview] = useState<Record<string, EventOverview>>({});
  const [search, setSearch] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  const loadEvents = useCallback(async () => {
    setPageLoading(true);
    setError('');
    try {
      const result = await eventsApi.myEvents();
      const allEvents = (result.events ?? []) as MyMediaEvent[];
      const query = search.trim().toLowerCase();
      const filtered = query ? allEvents.filter((event) => `${event.title} ${event.location ?? ''}`.toLowerCase().includes(query)) : allEvents;
      setEvents(filtered);

      const pairs = await Promise.all(filtered.slice(0, 30).map(async (event) => {
        try {
          const [publicResult, myResult, suggestionResult] = await Promise.all([
            eventMediaApi.publicList(event.id, { limit: 1 }),
            eventMediaApi.myList(event.id),
            eventMediaApi.captionSuggestions.myList(event.id),
          ]);
          return [event.id, {
            publicCount: publicResult.meta?.settings ? publicResult.media.length : publicResult.media.length,
            myCount: myResult.media.length,
            pendingSuggestions: suggestionResult.suggestions.filter((item) => item.status === 'PENDING').length,
          }] as const;
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
  }, [locale, search]);

  useEffect(() => {
    if (!user) return;
    const handle = window.setTimeout(() => void loadEvents(), 220);
    return () => window.clearTimeout(handle);
  }, [user, loadEvents]);

  const totals = useMemo(() => Object.values(overview).reduce((acc, item) => {
    acc.my += item.myCount ?? 0;
    acc.suggestions += item.pendingSuggestions ?? 0;
    return acc;
  }, { my: 0, suggestions: 0 }), [overview]);

  if (loading || !user) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell participant-media-bank-index-page">
      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader
          title={isRu ? 'Мой фотобанк' : 'My media bank'}
          subtitle={isRu
            ? 'Загружайте фото и видео по мероприятиям, следите за модерацией и предлагайте подписи к опубликованным материалам.'
            : 'Upload photos and videos by event, track moderation, and suggest captions for published media.'}
        />
        <div className="workspace-status-strip workspace-status-strip-v2">
          <div className="workspace-status-card"><small>{isRu ? 'Моих мероприятий' : 'My events'}</small><strong>{events.length}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Моих загрузок' : 'My uploads'}</small><strong>{totals.my}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Подписей на модерации' : 'Pending captions'}</small><strong>{totals.suggestions}</strong></div>
        </div>
        <ToolbarRow>
          <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск мероприятия' : 'Search events'} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadEvents()}>{isRu ? 'Обновить' : 'Refresh'}</button>
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
                    <span className="badge badge-muted">{event.membershipStatus ?? event.role ?? event.status ?? 'EVENT'}</span>
                  </div>
                  <div className="signal-muted">{[formatDate(event.startsAt, locale), event.location].filter(Boolean).join(' · ')}</div>
                  <div className="workspace-status-strip workspace-status-strip-v2">
                    <div className="workspace-status-card"><small>{isRu ? 'Мои загрузки' : 'My uploads'}</small><strong>{item?.myCount ?? '—'}</strong></div>
                    <div className="workspace-status-card"><small>{isRu ? 'Подписи ждут' : 'Captions pending'}</small><strong>{item?.pendingSuggestions ?? '—'}</strong></div>
                  </div>
                  {item?.error ? <Notice tone="warning">{item.error}</Notice> : null}
                  <ToolbarRow>
                    <Link className="btn btn-primary btn-sm" href={`/${locale}/me/events/${event.id}/media`}>
                      {isRu ? 'Открыть мой фотобанк' : 'Open my media bank'}
                    </Link>
                    {event.slug ? <Link className="btn btn-ghost btn-sm" href={`/${locale}/events/${event.slug}/media`}>{isRu ? 'Публичный альбом' : 'Public album'}</Link> : null}
                  </ToolbarRow>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={isRu ? 'Мероприятия не найдены' : 'No events found'}
          description={isRu ? 'Когда вы зарегистрируетесь на мероприятие, оно появится здесь.' : 'When you register for an event, it will appear here.'}
          actions={<Link href={`/${locale}/events`} className="btn btn-primary">{isRu ? 'Найти мероприятия' : 'Find events'}</Link>}
        />
      )}
    </div>
  );
}
