'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { eventMediaApi, type EventMediaItem, type PublicMediaEvent } from '@/lib/api';
import { MediaCard, formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, LoadingLines, Panel, ToolbarRow } from '@/components/ui/signal-primitives';

type MediaFilter = 'all' | 'image' | 'video' | 'organizers';
type MediaSort = 'newest' | 'oldest' | 'number';

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

function mediaTitle(item: EventMediaItem, isRu: boolean) {
  return item.title || item.caption || item.event?.title || item.asset.originalFilename || (isRu ? 'Материал медиабанка' : 'Media item');
}

function mediaSubtitle(item: EventMediaItem, locale: string) {
  const extended = item as EventMediaItem & { capturedAt?: string | null; durationSeconds?: number | null; groupTitle?: string | null };
  const parts = [
    extended.groupTitle,
    formatShortDateTime(extended.capturedAt ?? item.approvedAt ?? item.createdAt, locale),
    item.kind === 'video' && extended.durationSeconds ? formatDuration(extended.durationSeconds) : null,
    formatFileSize(item.asset.sizeBytes),
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatShortDateTime(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
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
      const apiType = filter === 'image' || filter === 'video' ? filter : 'all';
      const result = await eventMediaApi.siteList({ type: apiType, sort, eventId, search, limit: 40 });
      const visibleMedia = filterMedia(result.media, filter);
      setMedia(visibleMedia);
      setEvents(result.events);
      setTotal(filter === 'organizers' ? visibleMedia.length : result.meta.total);
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

  const photoCount = useMemo(() => media.filter((item) => item.kind === 'image').length, [media]);
  const videoCount = useMemo(() => media.filter((item) => item.kind === 'video').length, [media]);
  const organizerCount = useMemo(() => media.filter((item) => item.source === 'ADMIN').length, [media]);
  const previewItems = media.slice(0, 5);
  const featured = previewItems[0];
  const supporting = previewItems.slice(1, 5);

  return (
    <div className="public-page-shell route-shell route-site-media-page">
      <main className="public-main">
        <section className="public-section media-site-hero" style={{ paddingTop: 'clamp(2rem, 5vw, 4.5rem)', paddingBottom: '1.5rem' }}>
          <div className="container-wide media-site-hero-inner">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <p className="label-ui" style={{ marginBottom: 10 }}>{isRu ? 'Фото и видео с событий' : 'Photos and videos from events'}</p>
                <h1 className="display-title" style={{ margin: 0 }}>{isRu ? 'Медиабанк мероприятий' : 'Event media bank'}</h1>
                <p className="section-subtitle" style={{ marginTop: 12 }}>
                  {isRu
                    ? `${total} материалов · ${photoCount} фото · ${videoCount} видео`
                    : `${total} items · ${photoCount} photos · ${videoCount} videos`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {FILTERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`btn btn-sm ${filter === item ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter(item)}
                    title={item === 'organizers' ? `${organizerCount}` : undefined}
                  >
                    {filterLabel(item, isRu)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Panel style={{ marginTop: 28 }}><LoadingLines rows={8} /></Panel>
            ) : featured ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(340px, 1fr)', gap: 20, marginTop: 28 }} className="media-bank-preview-layout">
                <MediaPreviewTile item={featured} locale={locale} isLarge />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }} className="media-bank-preview-side-grid">
                  {supporting.map((item) => (
                    <MediaPreviewTile key={item.id} item={item} locale={locale} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 28 }}>
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

        <section className="public-section" style={{ paddingTop: '1rem' }}>
          <div className="container-wide media-page-shell">
            <Panel className="media-page-controls">
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
                title={isRu ? 'Материалы не найдены' : 'No media found'}
                description={isRu
                  ? 'Попробуйте изменить фильтры или открыть каталог мероприятий.'
                  : 'Try changing filters or open the event catalog.'}
                actions={<Link href={`/${locale}/events`} className="btn btn-primary">{isRu ? 'Смотреть мероприятия' : 'Browse events'}</Link>}
              />
            )}
          </div>
        </section>
      </main>

      <style jsx>{`
        @media (max-width: 980px) {
          .media-bank-preview-layout {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .media-bank-preview-side-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function MediaPreviewTile({ item, locale, isLarge = false }: { item: EventMediaItem; locale: string; isLarge?: boolean }) {
  const isRu = locale === 'ru';
  const title = mediaTitle(item, isRu);
  const subtitle = mediaSubtitle(item, locale);

  return (
    <Link
      href={item.event?.slug ? `/${locale}/events/${item.event.slug}/media` : `/${locale}/media`}
      style={{
        position: 'relative',
        minHeight: isLarge ? 520 : 245,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 22px 55px rgba(15, 23, 42, 0.18)',
        background: item.kind === 'video'
          ? 'linear-gradient(135deg, #0f766e, #0ea5e9)'
          : 'linear-gradient(135deg, #705df2, #a78bfa)',
      }}
      className="media-bank-preview-tile"
    >
      <MediaPreview
        publicUrl={item.asset.publicUrl}
        storageKey={item.asset.storageKey}
        kind={item.kind}
        alt={item.altText || title}
        sizes={isLarge ? '(max-width: 980px) 100vw, 56vw' : '(max-width: 980px) 50vw, 320px'}
        controls={false}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.02) 35%, rgba(15, 23, 42, 0.82) 100%)' }} />
      <span style={{ position: 'absolute', top: 20, left: 20, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'rgba(15, 23, 42, 0.68)', color: '#fff', fontWeight: 800, fontSize: 13 }}>
        {formatMediaDisplayNumber(item, locale)}
      </span>
      <div style={{ position: 'absolute', left: isLarge ? 24 : 18, right: isLarge ? 24 : 18, bottom: isLarge ? 24 : 18, color: '#fff' }}>
        <h2 style={{ margin: 0, fontSize: isLarge ? 'clamp(1.5rem, 3vw, 2rem)' : '1.15rem', lineHeight: 1.15, fontWeight: 850, letterSpacing: '-0.03em' }}>{title}</h2>
        {subtitle ? <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.82)', fontWeight: 700 }}>{subtitle}</p> : null}
      </div>
    </Link>
  );
}
