'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventMediaApi, type EventMediaItem } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';

type EventMediaBankProps = {
  event: {
    id: string;
    slug: string;
    title: string;
  };
  locale: string;
  user: { id: string } | null;
  canUpload: boolean;
  variant?: 'default' | 'quest';
};

type MediaFilter = 'all' | 'image' | 'video';

const FILTERS: MediaFilter[] = ['all', 'image', 'video'];

function mediaLabel(kind: EventMediaItem['kind'], locale: string) {
  if (kind === 'image') return locale === 'ru' ? 'Фото' : 'Photo';
  return locale === 'ru' ? 'Видео' : 'Video';
}

function filterLabel(filter: MediaFilter, locale: string) {
  if (filter === 'image') return locale === 'ru' ? 'Фото' : 'Photo';
  if (filter === 'video') return locale === 'ru' ? 'Видео' : 'Video';
  return locale === 'ru' ? 'Все' : 'All';
}

function itemTitle(item: EventMediaItem, locale: string) {
  return item.title || item.caption || item.asset.originalFilename || (locale === 'ru' ? 'Материал фотобанка' : 'Media bank item');
}

function renderPreview(item: EventMediaItem, locale: string, onOpen: (item: EventMediaItem) => void) {
  const label = item.altText || itemTitle(item, locale);

  if (item.kind === 'image') {
    return (
      <button className="media-bank-preview-button" type="button" onClick={() => onOpen(item)}>
        <Image src={item.asset.publicUrl} alt={label} fill sizes="(max-width: 768px) 100vw, 33vw" />
      </button>
    );
  }

  return (
    <video src={item.asset.publicUrl} controls preload="metadata" aria-label={label} />
  );
}

export function EventMediaBank({ event, locale, user, canUpload, variant = 'default' }: EventMediaBankProps) {
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewerItem, setViewerItem] = useState<EventMediaItem | null>(null);

  const cabinetHref = `/${locale}/cabinet/events/${event.slug}/media`;
  const loginHref = useMemo(
    () => `/${locale}/login?next=${encodeURIComponent(cabinetHref)}`,
    [cabinetHref, locale],
  );

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await eventMediaApi.publicList(event.id, { type: filter, limit: 80 });
      setMedia(result.media);
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось загрузить фотобанк' : 'Could not load media bank'));
    } finally {
      setLoading(false);
    }
  }, [event.id, filter, locale]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const cta = !user ? (
    <Link href={loginHref} className="btn btn-primary btn-sm">
      {locale === 'ru' ? 'Войти и добавить медиа' : 'Sign in and add media'}
    </Link>
  ) : canUpload ? (
    <Link href={cabinetHref} className="btn btn-primary btn-sm">
      {locale === 'ru' ? 'Добавить фото или видео' : 'Add photo or video'}
    </Link>
  ) : (
    <span className="media-bank-upload-note">
      {locale === 'ru' ? 'Загрузка доступна участникам мероприятия' : 'Upload is available to event participants'}
    </span>
  );

  return (
    <Panel id="media-bank" className={`event-photobank-panel event-mediabank-panel event-photobank-${variant}`}>
      <span id="photobank" className="media-bank-anchor" aria-hidden="true" />
      <SectionHeader
        title={locale === 'ru' ? 'Фотобанк мероприятия' : 'Event media bank'}
        subtitle={locale === 'ru'
          ? 'Утверждённые фото и видео события'
          : 'Approved event photos and videos'}
        actions={cta}
      />

      <ToolbarRow>
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`btn btn-sm ${filter === item ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(item)}
          >
            {filterLabel(item, locale)}
          </button>
        ))}
      </ToolbarRow>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <LoadingLines rows={4} />
      ) : media.length ? (
        <div className="event-photobank-grid media-bank-gallery-grid">
          {media.map((item) => (
            <article className="event-photobank-card media-bank-card" key={item.id}>
              <div className="event-photobank-preview media-bank-preview">
                <span className="media-bank-kind-badge">{mediaLabel(item.kind, locale)}</span>
                {renderPreview(item, locale, setViewerItem)}
              </div>
              <div className="event-photobank-meta media-bank-meta">
                <strong>{itemTitle(item, locale)}</strong>
                {item.caption ? <p>{item.caption}</p> : null}
                {item.credit ? <div><span>{item.credit}</span></div> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Фотобанк пока пуст' : 'Media bank is empty'}
          description={locale === 'ru'
            ? 'Одобренные фото и видео появятся здесь после модерации.'
            : 'Approved photos and videos will appear here after moderation.'}
          actions={cta}
        />
      )}

      {viewerItem ? (
        <div className="media-bank-viewer" role="dialog" aria-modal="true" aria-label={itemTitle(viewerItem, locale)}>
          <button className="media-bank-viewer-backdrop" type="button" onClick={() => setViewerItem(null)} aria-label={locale === 'ru' ? 'Закрыть' : 'Close'} />
          <div className="media-bank-viewer-dialog">
            <button className="media-bank-viewer-close" type="button" onClick={() => setViewerItem(null)}>
              {locale === 'ru' ? 'Закрыть' : 'Close'}
            </button>
            <div className="media-bank-viewer-media">
              {viewerItem.kind === 'image' ? (
                <Image src={viewerItem.asset.publicUrl} alt={viewerItem.altText || itemTitle(viewerItem, locale)} fill sizes="90vw" />
              ) : (
                <video src={viewerItem.asset.publicUrl} controls autoPlay />
              )}
            </div>
            <div className="media-bank-viewer-caption">
              <strong>{itemTitle(viewerItem, locale)}</strong>
              {viewerItem.caption ? <p>{viewerItem.caption}</p> : null}
              {viewerItem.credit ? <span>{viewerItem.credit}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
