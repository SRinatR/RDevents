'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { eventMediaApi, type EventMediaItem } from '@/lib/api';
import { MediaCard } from '@/components/media/MediaCard';
import { EmptyState, LoadingLines, Panel, SectionHeader } from '@/components/ui/signal-primitives';

type EventMediaBankPreviewProps = {
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

export function EventMediaBankPreview({ event, locale, user, canUpload, variant = 'default' }: EventMediaBankPreviewProps) {
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const isRu = locale === 'ru';
  const mediaHref = `/${locale}/events/${event.slug}/media`;
  const cabinetHref = `/${locale}/cabinet/events/${event.slug}/media`;
  const loginHref = `/${locale}/login?next=${encodeURIComponent(cabinetHref)}`;

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await eventMediaApi.eventPage(event.slug, { limit: 4 });
      setMedia(result.media);
      setTotal(result.meta.total);
    } catch {
      setMedia([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [event.slug]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const uploadCta = !user
    ? <Link href={loginHref} className="btn btn-secondary btn-sm">{isRu ? 'Войти и добавить медиа' : 'Sign in and add media'}</Link>
    : canUpload
      ? <Link href={cabinetHref} className="btn btn-secondary btn-sm">{isRu ? 'Добавить фото или видео' : 'Add photo or video'}</Link>
      : null;

  return (
    <Panel id="media-bank" className={`event-photobank-panel event-mediabank-preview-panel event-photobank-${variant}`}>
      <span id="photobank" className="media-bank-anchor" aria-hidden="true" />
      <SectionHeader
        title={isRu ? 'Фотобанк мероприятия' : 'Event media bank'}
        subtitle={total > 0
          ? (isRu ? `${total} фото и видео` : `${total} photos and videos`)
          : (isRu ? 'Материалы появятся после модерации' : 'Media appears after moderation')}
        actions={(
          <div className="event-mediabank-preview-actions">
            <Link href={mediaHref} className="btn btn-primary btn-sm">{isRu ? 'Открыть фотобанк' : 'Open media bank'}</Link>
            {uploadCta}
          </div>
        )}
      />

      {loading ? (
        <LoadingLines rows={3} />
      ) : media.length ? (
        <div className="event-mediabank-preview-grid">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              locale={locale}
              variant="compact"
              href={mediaHref}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={isRu ? 'Фотобанк пока пуст' : 'Media bank is empty'}
          description={isRu
            ? 'Одобренные материалы будут доступны на отдельной странице фотобанка.'
            : 'Approved media will be available on the dedicated media bank page.'}
          actions={<Link href={mediaHref} className="btn btn-primary btn-sm">{isRu ? 'Открыть страницу' : 'Open page'}</Link>}
        />
      )}
    </Panel>
  );
}
