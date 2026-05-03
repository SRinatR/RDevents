'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { eventMediaApi, type EventMediaItem, type PublicMediaEvent } from '@/lib/api';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, LoadingLines, Panel } from '@/components/ui/signal-primitives';
import styles from './media-page.module.css';

type MediaFilter = 'all' | 'image' | 'video' | 'organizers';
type MediaSort = 'newest' | 'oldest' | 'number';

type EventAlbum = {
  key: string;
  title: string;
  slug?: string | null;
  startsAt?: string | null;
  items: EventMediaItem[];
  photos: number;
  videos: number;
  organizers: number;
  totalSize: number;
};

const FILTERS: MediaFilter[] = ['all', 'image', 'video', 'organizers'];
const SORTS: MediaSort[] = ['newest', 'oldest', 'number'];

function filterLabel(value: MediaFilter, isRu: boolean) {
  if (value === 'image') return isRu ? 'Фото' : 'Photos';
  if (value === 'video') return isRu ? 'Видео' : 'Videos';
  if (value === 'organizers') return isRu ? 'Организаторы' : 'Organizers';
  return isRu ? 'Все' : 'All';
}

function sortLabel(value: MediaSort, isRu: boolean) {
  if (value === 'oldest') return isRu ? 'Сначала старые' : 'Oldest first';
  if (value === 'number') return isRu ? 'По номеру' : 'By number';
  return isRu ? 'Сначала новые' : 'Newest first';
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || !Number.isFinite(bytes)) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function filterMedia(items: EventMediaItem[], filter: MediaFilter) {
  if (filter === 'organizers') return items.filter((item) => item.source === 'ADMIN');
  if (filter === 'image' || filter === 'video') return items.filter((item) => item.kind === filter);
  return items;
}

function groupIntoAlbums(items: EventMediaItem[], locale: string): EventAlbum[] {
  const fallbackTitle = locale === 'ru' ? 'Материалы без мероприятия' : 'Ungrouped media';
  const map = new Map<string, EventAlbum>();

  for (const item of items) {
    const key = item.event?.id ?? item.eventId ?? 'ungrouped';
    const album = map.get(key) ?? {
      key,
      title: item.event?.title ?? fallbackTitle,
      slug: item.event?.slug,
      startsAt: item.event?.startsAt,
      items: [],
      photos: 0,
      videos: 0,
      organizers: 0,
      totalSize: 0,
    };

    album.items.push(item);
    if (item.kind === 'image') album.photos += 1;
    if (item.kind === 'video') album.videos += 1;
    if (item.source === 'ADMIN') album.organizers += 1;
    album.totalSize += Number(item.asset.sizeBytes ?? 0);
    map.set(key, album);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aDate = new Date(a.startsAt ?? a.items[0]?.approvedAt ?? a.items[0]?.createdAt ?? 0).getTime();
    const bDate = new Date(b.startsAt ?? b.items[0]?.approvedAt ?? b.items[0]?.createdAt ?? 0).getTime();
    return bDate - aDate;
  });
}

export default function SiteMediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isRu = locale === 'ru';
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [events, setEvents] = useState<PublicMediaEvent[]>([]);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sort, setSort] = useState<MediaSort>('newest');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const apiType = filter === 'image' || filter === 'video' ? filter : 'all';
      const result = await eventMediaApi.siteList({ type: apiType, sort, eventId, search, limit: 80 });
      setMedia(filterMedia(result.media, filter));
      setEvents(result.events);
    } catch {
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [filter, sort, eventId, search]);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadMedia(), 180);
    return () => window.clearTimeout(handle);
  }, [loadMedia]);

  const photoCount = useMemo(() => media.filter((item) => item.kind === 'image').length, [media]);
  const videoCount = useMemo(() => media.filter((item) => item.kind === 'video').length, [media]);
  const organizerCount = useMemo(() => media.filter((item) => item.source === 'ADMIN').length, [media]);
  const albums = useMemo(() => groupIntoAlbums(media, locale), [media, locale]);

  return (
    <div className="public-page-shell route-shell route-site-media-page">
      <main className="public-main">
        <section className={styles.page}>
          <div className="container-wide">
            <div className={styles.header}>
              <div>
                <p className={styles.kicker}>{isRu ? 'Фото и видео с событий' : 'Photos and videos from events'}</p>
                <h1 className={styles.title}>{isRu ? 'Медиабанк мероприятий' : 'Event media bank'}</h1>
                <p className={styles.stats}>
                  {isRu
                    ? `${media.length} материалов · ${photoCount} фото · ${videoCount} видео`
                    : `${media.length} items · ${photoCount} photos · ${videoCount} videos`}
                </p>
              </div>

              <div className={styles.typeChips}>
                {FILTERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`${styles.chip} ${filter === item ? styles.chipActive : ''}`}
                    onClick={() => setFilter(item)}
                    title={item === 'organizers' ? `${organizerCount}` : undefined}
                  >
                    {filterLabel(item, isRu)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filtersCard}>
              <div className={styles.sortGroup}>
                {SORTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`${styles.sortButton} ${sort === item ? styles.sortButtonActive : ''}`}
                    onClick={() => setSort(item)}
                  >
                    {sortLabel(item, isRu)}
                  </button>
                ))}
              </div>

              <select className={styles.select} value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">{isRu ? 'Все мероприятия' : 'All events'}</option>
                {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>

              <div className={styles.searchInput}>
                <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск по номеру, подписи, автору' : 'Search by number, caption, credit'} />
              </div>
            </div>

            {loading ? (
              <div className={styles.loadingWrap}>
                <Panel><LoadingLines rows={8} /></Panel>
              </div>
            ) : albums.length ? (
              <div className={styles.albumGrid}>
                {albums.map((album) => (
                  <EventAlbumCard key={album.key} album={album} locale={locale} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyWrap}>
                <EmptyState
                  title={isRu ? 'Медиабанк скоро появится' : 'Media bank is coming soon'}
                  description={isRu
                    ? 'После публикации мероприятий и модерации здесь появятся материалы.'
                    : 'Approved media from published events will appear here.'}
                  actions={<Link href={`/${locale}/events`} className="btn btn-primary">{isRu ? 'Смотреть мероприятия' : 'Browse events'}</Link>}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function EventAlbumCard({ album, locale }: { album: EventAlbum; locale: string }) {
  const isRu = locale === 'ru';
  const href = album.slug ? `/${locale}/events/${album.slug}/media` : `/${locale}/media`;
  const previewItems = album.items.slice(0, 4);
  const hiddenCount = Math.max(0, album.items.length - previewItems.length);
  const size = formatFileSize(album.totalSize);
  const date = formatDate(album.startsAt ?? album.items[0]?.approvedAt ?? album.items[0]?.createdAt, locale);

  return (
    <Link href={href} className={styles.albumCard}>
      <div className={`${styles.albumPreviewGrid} ${previewItems.length === 1 ? styles.albumPreviewGridSingle : ''}`}>
        {previewItems.map((item, index) => (
          <div key={item.id} className={styles.thumb}>
            <MediaPreview
              publicUrl={item.asset.publicUrl}
              storageKey={item.asset.storageKey}
              kind={item.kind}
              alt={item.altText || item.title || item.caption || album.title}
              sizes="(max-width: 640px) 100vw, 340px"
              controls={false}
            />
            {index === 0 ? <span className={styles.thumbBadge}>{formatMediaDisplayNumber(item, locale)}</span> : null}
            {index === previewItems.length - 1 && hiddenCount > 0 ? <span className={styles.moreThumb}>+{hiddenCount}</span> : null}
          </div>
        ))}
      </div>

      <div className={styles.albumBody}>
        <div className={styles.albumTitleRow}>
          <h2 className={styles.albumTitle}>{album.title}</h2>
          <span className={styles.albumCount}>{album.items.length}</span>
        </div>

        <div className={styles.albumMeta}>
          {date ? <span>{date}</span> : null}
          <span>{isRu ? `${album.photos} фото` : `${album.photos} photos`}</span>
          <span>{isRu ? `${album.videos} видео` : `${album.videos} videos`}</span>
          {size ? <span>{size}</span> : null}
        </div>

        <div className={styles.albumFooter}>
          <span>{isRu ? 'Открыть альбом' : 'Open album'}</span>
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
