'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { eventMediaApi, type PublicMediaEvent, type SiteMediaAlbum } from '@/lib/api';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, LoadingLines, Panel } from '@/components/ui/signal-primitives';
import styles from './media-page.module.css';

type MediaFilter = 'all' | 'image' | 'video' | 'organizers';
type MediaSort = 'newest' | 'oldest' | 'number';

const PAGE_SIZE = 20;
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

export default function SiteMediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const isRu = locale === 'ru';
  const [albums, setAlbums] = useState<SiteMediaAlbum[]>([]);
  const [events, setEvents] = useState<PublicMediaEvent[]>([]);
  const [meta, setMeta] = useState({
    totalAlbums: 0,
    totalMedia: 0,
    images: 0,
    videos: 0,
    organizers: 0,
    page: 1,
    limit: PAGE_SIZE,
    pages: 0,
  });
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sort, setSort] = useState<MediaSort>('newest');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadAlbums = useCallback(async (nextPage = 1, mode: 'replace' | 'append' = 'replace') => {
    if (mode === 'replace') {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const apiType = filter === 'image' || filter === 'video' ? filter : 'all';
      const source = filter === 'organizers' ? 'admin' : 'all';
      const result = await eventMediaApi.siteAlbums({
        type: apiType,
        source,
        sort,
        eventId,
        search,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setEvents(result.events);
      setMeta(result.meta);
      setAlbums((current) => {
        if (mode === 'replace') return result.albums;

        const known = new Set(current.map((album) => album.event.id));
        const unique = result.albums.filter((album) => !known.has(album.event.id));
        return [...current, ...unique];
      });
    } catch {
      if (mode === 'replace') {
        setAlbums([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, sort, eventId, search]);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadAlbums(1, 'replace'), 180);
    return () => window.clearTimeout(handle);
  }, [loadAlbums]);

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
                    ? `${meta.totalMedia} материалов · ${meta.images} фото · ${meta.videos} видео`
                    : `${meta.totalMedia} items · ${meta.images} photos · ${meta.videos} videos`}
                </p>
                {filter === 'organizers' ? (
                  <p className={styles.statsMuted}>
                    {isRu
                      ? `Материалов от организаторов: ${meta.organizers}`
                      : `Organizer media: ${meta.organizers}`}
                  </p>
                ) : null}
              </div>

              <div className={styles.typeChips}>
                {FILTERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`${styles.chip} ${filter === item ? styles.chipActive : ''}`}
                    onClick={() => setFilter(item)}
                    title={item === 'organizers' ? `${meta.organizers}` : undefined}
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
              <>
                <div className={styles.albumGrid}>
                  {albums.map((album) => (
                    <EventAlbumCard key={album.event.id} album={album} locale={locale} />
                  ))}
                </div>
                {meta.page < meta.pages ? (
                  <div className={styles.loadMoreWrap}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={loadingMore}
                      onClick={() => void loadAlbums(meta.page + 1, 'append')}
                    >
                      {loadingMore
                        ? (isRu ? 'Загружаем...' : 'Loading...')
                        : (isRu ? 'Показать ещё события' : 'Load more events')}
                    </button>
                  </div>
                ) : null}
              </>
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

function EventAlbumCard({ album, locale }: { album: SiteMediaAlbum; locale: string }) {
  const isRu = locale === 'ru';
  const href = album.event.slug ? `/${locale}/events/${album.event.slug}/media` : `/${locale}/media`;
  const previewItems = album.previewMedia;
  const hiddenCount = Math.max(0, album.counts.total - previewItems.length);
  const size = formatFileSize(album.totalSizeBytes);
  const date = formatDate(album.event.startsAt, locale);

  return (
    <Link href={href} className={styles.albumCard}>
      <div className={`${styles.albumPreviewGrid} ${previewItems.length === 1 ? styles.albumPreviewGridSingle : ''}`}>
        {previewItems.map((item, index) => (
          <div key={item.id} className={styles.thumb}>
            <MediaPreview
              publicUrl={item.asset.publicUrl}
              storageKey={item.asset.storageKey}
              kind={item.kind}
              alt={item.altText || item.title || item.caption || album.event.title}
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
          <h2 className={styles.albumTitle}>{album.event.title}</h2>
          <span className={styles.albumCount}>{album.counts.total}</span>
        </div>

        <div className={styles.albumMeta}>
          {date ? <span>{date}</span> : null}
          <span>{isRu ? `${album.counts.images} фото` : `${album.counts.images} photos`}</span>
          <span>{isRu ? `${album.counts.videos} видео` : `${album.counts.videos} videos`}</span>
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
