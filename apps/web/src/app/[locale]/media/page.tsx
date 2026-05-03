'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { eventMediaApi, type EventMediaItem, type PublicMediaEvent } from '@/lib/api';
import { MediaCard } from '@/components/media/MediaCard';
import { EmptyState, FieldInput, LoadingLines, PageHeader, Panel, ToolbarRow } from '@/components/ui/signal-primitives';

type MediaFilter = 'all' | 'image' | 'video';
type MediaSort = 'newest' | 'oldest' | 'number';

const FILTERS: MediaFilter[] = ['all', 'image', 'video'];
const SORTS: MediaSort[] = ['newest', 'oldest', 'number'];

function filterLabel(value: MediaFilter, isRu: boolean) {
  if (value === 'image') return isRu ? 'Фото' : 'Photos';
  if (value === 'video') return isRu ? 'Видео' : 'Videos';
  return isRu ? 'Все' : 'All';
}

function sortLabel(value: MediaSort, isRu: boolean) {
  if (value === 'oldest') return isRu ? 'Сначала старые' : 'Oldest first';
  if (value === 'number') return isRu ? 'По номеру' : 'By number';
  return isRu ? 'Сначала новые' : 'Newest first';
}

export default function SiteMediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isRu = locale === 'ru';
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [events, setEvents] = useState<PublicMediaEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sort, setSort] = useState<MediaSort>('newest');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const result = await eventMediaApi.siteList({ type: filter, sort, eventId, search, limit: 40 });
      setMedia(result.media);
      setEvents(result.events);
      setTotal(result.meta.total);
    } catch {
      setMedia([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filter, sort, eventId, search]);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadMedia(), 180);
    return () => window.clearTimeout(handle);
  }, [loadMedia]);

  return (
    <div className="public-page-shell route-shell route-site-media-page">
      <main className="public-main">
        <section className="public-section media-site-hero">
          <div className="container-wide media-site-hero-inner">
            <PageHeader
              title={isRu ? 'Фотобанк мероприятий' : 'Event media bank'}
              subtitle={isRu
                ? `${total} опубликованных фото и видео с мероприятий`
                : `${total} published photos and videos from events`}
              actions={<Link href={`/${locale}/events`} className="btn btn-secondary btn-sm">{isRu ? 'Все события' : 'All events'}</Link>}
            />
          </div>
        </section>

        <section className="public-section">
          <div className="container-wide media-page-shell">
            <Panel className="media-page-controls">
              <ToolbarRow>
                {FILTERS.map((item) => (
                  <button key={item} type="button" className={`btn btn-sm ${filter === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(item)}>
                    {filterLabel(item, isRu)}
                  </button>
                ))}
              </ToolbarRow>
              <ToolbarRow>
                {SORTS.map((item) => (
                  <button key={item} type="button" className={`btn btn-sm ${sort === item ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setSort(item)}>
                    {sortLabel(item, isRu)}
                  </button>
                ))}
                <select className="signal-field signal-select" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                  <option value="">{isRu ? 'Все мероприятия' : 'All events'}</option>
                  {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск по номеру, подписи, автору' : 'Search by number, caption, credit'} />
              </ToolbarRow>
            </Panel>

            {loading ? (
              <Panel><LoadingLines rows={8} /></Panel>
            ) : media.length ? (
              <div className="media-page-grid">
                {media.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    showEvent
                    href={item.event?.slug ? `/${locale}/events/${item.event.slug}/media` : undefined}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={isRu ? 'Медиабанк скоро появится' : 'Media bank is coming soon'}
                description={isRu
                  ? 'После публикации мероприятий и модерации здесь появятся материалы.'
                  : 'Approved media from published events will appear here.'}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
