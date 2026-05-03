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

type ExtendedMediaItem = EventMediaItem & {
  capturedAt?: string | null;
  groupTitle?: string | null;
  downloadEnabled?: boolean | null;
  durationSeconds?: number | null;
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
    || (locale === 'ru' ? 'Материал медиабанка' : 'Media bank item');
}

function formatMediaDate(value: string | null | undefined, locale: string) {
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

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function metadataParts(item: EventMediaItem, locale: string) {
  const extended = item as ExtendedMediaItem;
  return [
    extended.groupTitle,
    formatMediaDate(extended.capturedAt ?? item.approvedAt ?? item.createdAt, locale),
    item.kind === 'video' ? formatDuration(extended.durationSeconds) : null,
    formatFileSize(item.asset.sizeBytes),
    item.credit,
    item.uploader?.name,
  ].filter(Boolean) as string[];
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
  const parts = metadataParts(item, locale);
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
        {parts.length ? (
          <div className="media-card-meta">
            {parts.slice(0, 5).map((part) => <span key={part}>{part}</span>)}
          </div>
        ) : null}
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
