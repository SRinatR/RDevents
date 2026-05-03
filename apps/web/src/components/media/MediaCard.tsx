'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { type EventMediaItem } from '@/lib/api';
import { MediaPreview } from './MediaPreview';

type MediaCardProps = {
  item: EventMediaItem;
  locale: string;
  variant?: 'public' | 'admin' | 'cabinet' | 'compact';
  showEvent?: boolean;
  href?: string;
  onOpen?: (item: EventMediaItem) => void;
  actions?: ReactNode;
};

export function formatMediaDisplayNumber(item: Pick<EventMediaItem, 'kind' | 'displayNumber'>, locale: string) {
  const label = item.kind === 'image'
    ? (locale === 'ru' ? 'Фото' : 'Photo')
    : (locale === 'ru' ? 'Видео' : 'Video');

  if (!item.displayNumber) return label;
  return `${label} #${String(item.displayNumber).padStart(3, '0')}`;
}

function itemTitle(item: EventMediaItem, locale: string) {
  return item.title
    || item.caption
    || item.asset.originalFilename
    || (locale === 'ru' ? 'Материал фотобанка' : 'Media bank item');
}

export function MediaCard({
  item,
  locale,
  variant = 'public',
  showEvent = false,
  href,
  onOpen,
  actions,
}: MediaCardProps) {
  const title = itemTitle(item, locale);
  const card = (
    <article className={`media-card media-card-${variant}`}>
      <div className="media-card-preview">
        <span className="media-card-kind">{formatMediaDisplayNumber(item, locale)}</span>
        <MediaPreview
          publicUrl={item.asset.publicUrl}
          storageKey={item.asset.storageKey}
          kind={item.kind}
          alt={item.altText || title}
          sizes={variant === 'compact' ? '220px' : '(max-width: 768px) 100vw, 360px'}
          controls={variant !== 'compact'}
          onOpen={onOpen ? () => onOpen(item) : undefined}
        />
      </div>
      <div className="media-card-body">
        {showEvent && item.event ? (
          <div className="media-card-event">{item.event.title}</div>
        ) : null}
        <strong title={title}>{title}</strong>
        {item.caption && item.caption !== title ? <p>{item.caption}</p> : null}
        <div className="media-card-meta">
          {item.credit ? <span>{item.credit}</span> : null}
          {item.uploader?.name ? <span>{item.uploader.name}</span> : null}
        </div>
        {actions ? <div className="media-card-actions">{actions}</div> : null}
      </div>
    </article>
  );

  if (!href) return card;

  return (
    <Link href={href} className="media-card-link">
      {card}
    </Link>
  );
}
