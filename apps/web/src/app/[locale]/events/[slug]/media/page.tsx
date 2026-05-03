'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { eventMediaApi, type EventMediaItem, type PublicMediaEvent } from '@/lib/api';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, LoadingLines, Notice } from '@/components/ui/signal-primitives';
import styles from './EventMediaPage.module.css';

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

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export default function EventMediaPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = use(params);
  const isRu = locale === 'ru';
  const { user } = useAuth();
  const [event, setEvent] = useState<PublicMediaEvent | null>(null);
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, images: 0, videos: 0, page: 1, limit: 40, pages: 0 });
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sort, setSort] = useState<MediaSort>('newest');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewerItem, setViewerItem] = useState<EventMediaItem | null>(null);

  const eventHref = `/${locale}/events/${slug}`;
  const cabinetHref = `/${locale}/cabinet/events/${slug}/media`;
  const uploadHref = user ? cabinetHref : `/${locale}/login?next=${encodeURIComponent(cabinetHref)}`;

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await eventMediaApi.eventPage(slug, { type: filter, sort, search, limit: 40 });
      setEvent(result.event);
      setMedia(result.media);
      setMeta(result.meta);
    } catch (err: any) {
      setError(err.message || (isRu ? 'Не удалось загрузить фотобанк.' : 'Could not load media bank.'));
    } finally {
      setLoading(false);
    }
  }, [slug, filter, sort, search, isRu]);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadMedia(), 180);
    return () => window.clearTimeout(handle);
  }, [loadMedia]);

  const heroMeta = useMemo(() => {
    if (!event) return '';
    return [formatDate(event.startsAt, locale), event.location].filter(Boolean).join(' · ');
  }, [event, locale]);

  const mediaSummary = isRu
    ? `${meta.total} материалов · ${meta.images} фото · ${meta.videos} видео`
    : `${meta.total} items · ${meta.images} photos · ${meta.videos} videos`;

  return (
    <div className={`public-page-shell route-shell route-media-bank-page ${styles.mediaBankPage}`}>
      <main className="public-main">
        <section className={styles.hero}>
          {event?.coverImageUrl ? (
            <Image src={event.coverImageUrl} alt={event.title} fill sizes="100vw" priority style={{ objectFit: 'cover' }} />
          ) : (
            <div className={styles.heroFallback}>
              <span>{event?.title?.slice(0, 2).toUpperCase() ?? 'RD'}</span>
            </div>
          )}
          <div className={styles.heroOverlay} />
          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <div className={styles.eyebrow}>{event?.title ?? (isRu ? 'Мероприятие' : 'Event')}</div>
              <h1 className={styles.heroTitle}>{isRu ? 'Фотобанк мероприятия' : 'Event media bank'}</h1>
              <p className={styles.heroText}>
                {event ? `${event.title}${heroMeta ? ` · ${heroMeta}` : ''}` : (isRu ? 'Фото и видео от организаторов и участников.' : 'Photos and videos from organizers and participants.')}
              </p>
              <div className={styles.heroActions}>
                <Link href={uploadHref} className={styles.heroPrimary}>
                  {user ? (isRu ? 'Отправить своё медиа' : 'Submit your media') : (isRu ? 'Войти и отправить медиа' : 'Sign in to submit media')}
                </Link>
                <Link href={eventHref} className={styles.heroSecondary}>{isRu ? 'Вернуться к событию' : 'Back to event'}</Link>
              </div>
              <div className={styles.counters}>
                <span>{isRu ? 'Всего' : 'Total'}: {meta.total}</span>
                <span>{isRu ? 'Фото' : 'Photos'}: {meta.images}</span>
                <span>{isRu ? 'Видео' : 'Videos'}: {meta.videos}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.galleryPanel}>
              <div className={styles.sectionHead}>
                <div>
                  <h2>{isRu ? 'Фотобанк' : 'Media bank'}</h2>
                  <p>{mediaSummary}</p>
                </div>
                <div className={styles.topActions}>
                  <Link href={uploadHref} className="btn btn-primary btn-sm">
                    {user ? (isRu ? 'Добавить фото или видео' : 'Add photo or video') : (isRu ? 'Войти и добавить медиа' : 'Sign in and add media')}
                  </Link>
                  <Link href={eventHref} className="btn btn-secondary btn-sm">{isRu ? 'К мероприятию' : 'To event'}</Link>
                </div>
              </div>

              <div className={styles.controls}>
                <div className={styles.toolbar}>
                  {FILTERS.map((item) => (
                    <button key={item} type="button" className={`btn btn-sm ${filter === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(item)}>
                      {filterLabel(item, isRu)}
                    </button>
                  ))}
                </div>
                <div className={styles.toolbar}>
                  {SORTS.map((item) => (
                    <button key={item} type="button" className={`btn btn-sm ${sort === item ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setSort(item)}>
                      {sortLabel(item, isRu)}
                    </button>
                  ))}
                  <div className={styles.search}>
                    <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск: номер, подпись, автор' : 'Search: number, caption, credit'} />
                  </div>
                </div>
              </div>

              {error ? <Notice tone="danger">{error}</Notice> : null}

              {loading ? (
                <LoadingLines rows={8} />
              ) : media.length ? (
                <div className={styles.gallery}>
                  {media.map((item) => (
                    <MediaCard key={item.id} item={item} locale={locale} onOpen={setViewerItem} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={isRu ? 'Материалы не найдены' : 'No media found'}
                  description={isRu ? 'Попробуйте другой фильтр или вернитесь позже.' : 'Try another filter or check back later.'}
                />
              )}
            </div>
          </div>
        </section>
      </main>

      {viewerItem ? (
        <div className={styles.viewer} role="dialog" aria-modal="true">
          <button className={styles.viewerBackdrop} type="button" onClick={() => setViewerItem(null)} aria-label={isRu ? 'Закрыть' : 'Close'} />
          <div className={styles.viewerDialog}>
            <button className={`btn btn-secondary btn-sm ${styles.viewerClose}`} type="button" onClick={() => setViewerItem(null)}>{isRu ? 'Закрыть' : 'Close'}</button>
            <div className={styles.viewerMedia}>
              <MediaPreview publicUrl={viewerItem.asset.publicUrl} storageKey={viewerItem.asset.storageKey} kind={viewerItem.kind} alt={viewerItem.altText || viewerItem.title || viewerItem.caption || viewerItem.asset.originalFilename} sizes="90vw" />
            </div>
            <div className={styles.viewerCaption}>
              <strong>{viewerItem.title || viewerItem.asset.originalFilename}</strong>
              {viewerItem.caption ? <p>{viewerItem.caption}</p> : null}
              {viewerItem.credit ? <span>{viewerItem.credit}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
