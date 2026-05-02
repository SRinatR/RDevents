'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventsApi, type EventMediaItem } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';

type PhotoBankEvent = {
  id: string;
  slug: string;
  title: string;
};

type EventPhotoBankProps = {
  event: PhotoBankEvent;
  locale: string;
  user: { id: string } | null;
  isParticipant: boolean;
  variant?: 'default' | 'quest';
};

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function renderMediaPreview(item: EventMediaItem) {
  const label = item.altText || item.title || item.caption || item.asset.originalFilename;

  if (item.kind === 'image') {
    return <Image src={item.asset.publicUrl} alt={label} fill sizes="(max-width: 768px) 100vw, 33vw" />;
  }

  if (item.kind === 'video') {
    return <video src={item.asset.publicUrl} controls preload="metadata" />;
  }

  if (item.kind === 'audio') {
    return (
      <div className="event-photobank-file event-photobank-audio">
        <span>{item.title || item.asset.originalFilename}</span>
        <audio src={item.asset.publicUrl} controls />
      </div>
    );
  }

  return (
    <a className="event-photobank-file" href={item.asset.publicUrl} target="_blank" rel="noreferrer">
      <span>{item.title || item.asset.originalFilename}</span>
      <small>{item.asset.mimeType} {formatFileSize(item.asset.sizeBytes)}</small>
    </a>
  );
}

export function EventPhotoBank({ event, locale, user, isParticipant, variant = 'default' }: EventPhotoBankProps) {
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const loginHref = useMemo(() => {
    const next = `/${locale}/events/${event.slug}#photobank`;
    return `/${locale}/login?next=${encodeURIComponent(next)}`;
  }, [event.slug, locale]);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await eventsApi.listMedia(event.id);
      setMedia(result.media);
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось загрузить фотобанк' : 'Could not load media bank'));
    } finally {
      setLoading(false);
    }
  }, [event.id, locale]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setNotice(locale === 'ru' ? 'Выберите файл для отправки.' : 'Choose a file first.');
      return;
    }

    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const result = await eventsApi.uploadMedia(event.id, file, { title, caption, credit });
      setFile(null);
      setTitle('');
      setCaption('');
      setCredit('');
      const form = e.currentTarget;
      form.reset();
      setNotice(result.media.status === 'APPROVED'
        ? (locale === 'ru' ? 'Медиа опубликовано в фотобанке.' : 'Media was published to the bank.')
        : (locale === 'ru' ? 'Спасибо, медиа отправлено на модерацию.' : 'Thanks, your media is waiting for moderation.'));
      await loadMedia();
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось отправить медиа' : 'Could not upload media'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel id="photobank" className={`event-photobank-panel event-photobank-${variant}`}>
      <SectionHeader
        title={locale === 'ru' ? 'Фотобанк' : 'Media bank'}
        subtitle={locale === 'ru'
          ? 'Фото, видео, аудио и документы от организаторов и участников после модерации'
          : 'Photos, videos, audio and documents from organizers and participants after moderation'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {loading ? (
        <LoadingLines rows={4} />
      ) : media.length ? (
        <div className="event-photobank-grid">
          {media.map((item) => (
            <article className="event-photobank-card" key={item.id}>
              <div className="event-photobank-preview">
                {renderMediaPreview(item)}
              </div>
              <div className="event-photobank-meta">
                <strong>{item.title || item.asset.originalFilename}</strong>
                {item.caption ? <p>{item.caption}</p> : null}
                <div>
                  <span>{item.source === 'ADMIN' ? (locale === 'ru' ? 'Организаторы' : 'Organizers') : (locale === 'ru' ? 'Участник' : 'Participant')}</span>
                  {item.credit ? <span>{item.credit}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={locale === 'ru' ? 'Фотобанк пока пуст' : 'Media bank is empty'}
          description={locale === 'ru' ? 'Одобренные материалы появятся здесь после модерации.' : 'Approved materials will appear here after moderation.'}
        />
      )}

      <form className="event-photobank-upload" onSubmit={handleSubmit}>
        <div className="event-photobank-upload-heading">
          <strong>{locale === 'ru' ? 'Отправить медиа' : 'Submit media'}</strong>
          <span>{locale === 'ru' ? 'После проверки материал появится на странице мероприятия.' : 'After review it will appear on the event page.'}</span>
        </div>

        {!user ? (
          <Link href={loginHref} className="btn btn-secondary btn-sm">
            {locale === 'ru' ? 'Войти, чтобы отправить' : 'Sign in to submit'}
          </Link>
        ) : !isParticipant ? (
          <Notice tone="info">
            {locale === 'ru'
              ? 'Загрузка доступна одобренным участникам мероприятия.'
              : 'Upload is available to approved event participants.'}
          </Notice>
        ) : (
          <div className="event-photobank-form-grid">
            <label>
              <span>{locale === 'ru' ? 'Файл' : 'File'}</span>
              <input
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <label>
              <span>{locale === 'ru' ? 'Название' : 'Title'}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={locale === 'ru' ? 'Короткое название' : 'Short title'} />
            </label>
            <label>
              <span>{locale === 'ru' ? 'Автор / кредит' : 'Credit'}</span>
              <input value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={120} placeholder={locale === 'ru' ? 'Имя автора или команды' : 'Author or team'} />
            </label>
            <label className="event-photobank-caption-field">
              <span>{locale === 'ru' ? 'Подпись' : 'Caption'}</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={1000} rows={3} placeholder={locale === 'ru' ? 'Что происходит в кадре или файле' : 'What is happening in the media'} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? (locale === 'ru' ? 'Отправляем...' : 'Uploading...') : (locale === 'ru' ? 'Отправить на модерацию' : 'Submit for moderation')}
            </button>
          </div>
        )}
      </form>
    </Panel>
  );
}
