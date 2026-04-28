'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/signal-primitives';

type EventGalleryCardProps = {
  item: any;
  locale: string;
  actions?: ReactNode;
  showStatus?: boolean;
};

export function EventGalleryCard({
  item,
  locale,
  actions,
  showStatus = false,
}: EventGalleryCardProps) {
  const isRu = locale === 'ru';
  const title = item.caption || item.originalFilename || (item.type === 'PHOTO' ? 'Photo' : 'Video');
  const authorLabel = item.source === 'OFFICIAL'
    ? (isRu ? 'Организаторы' : 'Official')
    : (item.uploader?.name || (isRu ? 'Участник' : 'Participant'));

  return (
    <article className="event-gallery-card">
      <div className="event-gallery-card-media">
        {item.type === 'PHOTO' ? (
          <Image
            src={item.publicUrl}
            alt={title}
            fill
            sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="event-gallery-video-tile">
            <strong>{isRu ? 'Видео' : 'Video'}</strong>
            <span>{item.canPreviewInline ? (isRu ? 'Быстрый просмотр доступен' : 'Inline preview supported') : (isRu ? 'Откроется в новой вкладке' : 'Opens in a new tab')}</span>
          </div>
        )}
      </div>

      <div className="event-gallery-card-body">
        <div className="event-gallery-card-badges">
          <StatusBadge tone={item.source === 'OFFICIAL' ? 'info' : 'warning'}>
            {item.source === 'OFFICIAL' ? (isRu ? 'Официально' : 'Official') : (isRu ? 'От участника' : 'Participant')}
          </StatusBadge>
          <StatusBadge tone={item.type === 'PHOTO' ? 'success' : 'neutral'}>
            {item.type === 'PHOTO' ? (isRu ? 'Фото' : 'Photo') : (isRu ? 'Видео' : 'Video')}
          </StatusBadge>
          {showStatus ? (
            <StatusBadge tone={statusTone(item.status)}>
              {formatStatus(item.status, locale)}
            </StatusBadge>
          ) : null}
        </div>

        <div className="event-gallery-card-copy">
          <h3>{title}</h3>
          <p>{authorLabel}</p>
        </div>

        <div className="event-gallery-card-meta">
          <span>{formatDate(item.createdAt, locale)}</span>
          <span>{formatFileSize(item.sizeBytes)}</span>
        </div>

        {item.reviewNote && showStatus ? (
          <div className="event-gallery-card-note">{item.reviewNote}</div>
        ) : null}

        <div className="event-gallery-card-actions">
          <a href={item.publicUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            {item.type === 'PHOTO'
              ? (isRu ? 'Открыть фото' : 'Open photo')
              : (isRu ? 'Открыть видео' : 'Open video')}
          </a>
          {actions}
        </div>
      </div>
    </article>
  );
}

function formatDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function statusTone(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  if (status === 'ARCHIVED') return 'neutral';
  return 'neutral';
}

function formatStatus(status: string, locale: string) {
  const ru: Record<string, string> = {
    PENDING: 'На модерации',
    PUBLISHED: 'Опубликовано',
    REJECTED: 'Отклонено',
    ARCHIVED: 'В архиве',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    PUBLISHED: 'Published',
    REJECTED: 'Rejected',
    ARCHIVED: 'Archived',
  };

  return (locale === 'ru' ? ru : en)[status] ?? status;
}
