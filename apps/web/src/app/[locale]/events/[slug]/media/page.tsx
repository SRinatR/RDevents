'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { eventMediaApi, type EventMediaItem, type PublicMediaEvent } from '@/lib/api';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, LoadingLines, Notice, PageHeader, Panel, ToolbarRow } from '@/components/ui/signal-primitives';

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

  return (
    <div className="public-page-shell route-shell route-media-bank-page">
      <main className="public-main">
        <section className="media-page-hero">
          {event?.coverImageUrl ? (
            <Image src={event.coverImageUrl} alt={event.title} fill sizes="100vw" priority style={{ objectFit: 'cover' }} />
          ) : <div className="cover-fallback"><span>{event?.title?.slice(0, 2).toUpperCase() ?? 'RD'}</span></div>}
          <div className="media-page-hero-overlay" />
          <div className="container-wide media-page-hero-inner">
            <Link href={`/${locale}/events/${slug}`} className="signal-chip-link">{isRu ? 'К мероприятию' : 'Back to event'}</Link>
            <h1>{isRu ? 'Фотобанк мероприятия' : 'Event media bank'}</h1>
            {event ? <p>{event.title}{heroMeta ? ` · ${heroMeta}` : ''}</p> : null}
            <div className="media-page-counters">
              <span>{isRu ? 'Всего' : 'Total'}: {meta.total}</span>
              <span>{isRu ? 'Фото' : 'Photos'}: {meta.images}</span>
              <span>{isRu ? 'Видео' : 'Videos'}: {meta.videos}</span>
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="container-wide media-page-shell">
            <PageHeader
              title={event?.title ?? (isRu ? 'Фотобанк' : 'Media bank')}
              subtitle={isRu ? 'Загрузка доступна участникам мероприятия' : 'Upload is available to event participants'}
              actions={<Link href={uploadHref} className="btn btn-primary btn-sm">{user ? (isRu ? 'Добавить фото или видео' : 'Add photo or video') : (isRu ? 'Войти и добавить медиа' : 'Sign in and add media')}</Link>}
            />

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
                <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск: номер, подпись, автор' : 'Search: number, caption, credit'} />
              </ToolbarRow>
            </Panel>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            {loading ? (
              <Panel><LoadingLines rows={8} /></Panel>
            ) : media.length ? (
              <div className="media-page-grid">
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
        </section>
      </main>

      {viewerItem ? (
        <div className="media-bank-viewer" role="dialog" aria-modal="true">
          <button className="media-bank-viewer-backdrop" type="button" onClick={() => setViewerItem(null)} aria-label={isRu ? 'Закрыть' : 'Close'} />
          <div className="media-bank-viewer-dialog">
            <button className="media-bank-viewer-close" type="button" onClick={() => setViewerItem(null)}>{isRu ? 'Закрыть' : 'Close'}</button>
            <div className="media-bank-viewer-media">
              <MediaPreview publicUrl={viewerItem.asset.publicUrl} storageKey={viewerItem.asset.storageKey} kind={viewerItem.kind} alt={viewerItem.altText || viewerItem.title || viewerItem.caption || viewerItem.asset.originalFilename} sizes="90vw" />
            </div>
            <div className="media-bank-viewer-caption">
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
