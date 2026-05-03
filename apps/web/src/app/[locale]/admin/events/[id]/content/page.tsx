'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, type EventMediaItem } from '@/lib/api';
import { EmptyState, LoadingLines, Notice, Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

type MediaFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

function formatMediaSource(item: EventMediaItem, locale: string) {
  return item.source === 'ADMIN'
    ? (locale === 'ru' ? 'Организаторы' : 'Organizers')
    : (locale === 'ru' ? 'Участник' : 'Participant');
}

function renderAdminMediaPreview(item: EventMediaItem) {
  const label = item.altText || item.title || item.caption || item.asset.originalFilename;
  if (item.kind === 'image') {
    return <Image src={item.asset.publicUrl} alt={label} fill sizes="160px" />;
  }
  if (item.kind === 'video') {
    return <video src={item.asset.publicUrl} controls preload="metadata" />;
  }
  if (item.kind === 'audio') {
    return <audio src={item.asset.publicUrl} controls />;
  }
  return (
    <a href={item.asset.publicUrl} target="_blank" rel="noreferrer">
      {item.asset.originalFilename}
    </a>
  );
}

export default function EventContentPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('PENDING');
  const [mediaItems, setMediaItems] = useState<EventMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [mediaNotice, setMediaNotice] = useState('');
  const [mediaNotes, setMediaNotes] = useState<Record<string, string>>({});
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaCredit, setMediaCredit] = useState('');
  const [mediaBusyId, setMediaBusyId] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');
    try {
      const eventResult = await adminApi.listEvents({ id: eventId, limit: 1 });
      setEvent(eventResult.data[0] ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
      setEvent(null);
    } finally {
      setLoadingData(false);
    }
  }, [eventId]);

  const loadMedia = useCallback(async () => {
    if (!eventId) return;
    setMediaLoading(true);
    setMediaError('');
    try {
      const result = await adminApi.listEventMedia(eventId, mediaFilter);
      setMediaItems(result.media);
    } catch (err: any) {
      setMediaError(err.message || (locale === 'ru' ? 'Не удалось загрузить фотобанк' : 'Failed to load media bank'));
    } finally {
      setMediaLoading(false);
    }
  }, [eventId, locale, mediaFilter]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  useEffect(() => {
    if (user && isAdmin) void loadMedia();
  }, [user, isAdmin, loadMedia]);

  const tags = useMemo(() => {
    const value = (event as any)?.tags;
    return Array.isArray(value) ? value.map(String) : [];
  }, [event]);

  async function handleAdminMediaUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventId || !mediaFile) {
      setMediaNotice(locale === 'ru' ? 'Выберите файл для загрузки.' : 'Choose a file first.');
      return;
    }

    setMediaUploading(true);
    setMediaError('');
    setMediaNotice('');
    try {
      await adminApi.uploadEventMedia(eventId, mediaFile, {
        title: mediaTitle,
        caption: mediaCaption,
        credit: mediaCredit,
      });
      setMediaFile(null);
      setMediaTitle('');
      setMediaCaption('');
      setMediaCredit('');
      e.currentTarget.reset();
      setMediaNotice(locale === 'ru' ? 'Медиа добавлено и опубликовано.' : 'Media added and published.');
      await loadMedia();
    } catch (err: any) {
      setMediaError(err.message || (locale === 'ru' ? 'Не удалось загрузить медиа' : 'Failed to upload media'));
    } finally {
      setMediaUploading(false);
    }
  }

  async function handleModerateMedia(item: EventMediaItem, status: 'APPROVED' | 'REJECTED') {
    if (!eventId) return;
    setMediaBusyId(item.id);
    setMediaError('');
    setMediaNotice('');
    try {
      await adminApi.moderateEventMedia(eventId, item.id, {
        status,
        notes: mediaNotes[item.id],
      });
      setMediaNotice(status === 'APPROVED'
        ? (locale === 'ru' ? 'Медиа одобрено и появится на странице.' : 'Media approved and published.')
        : (locale === 'ru' ? 'Медиа отклонено.' : 'Media rejected.'));
      await loadMedia();
    } catch (err: any) {
      setMediaError(err.message || (locale === 'ru' ? 'Не удалось обновить статус' : 'Failed to update status'));
    } finally {
      setMediaBusyId(null);
    }
  }

  async function handleDeleteMedia(item: EventMediaItem) {
    if (!eventId) return;
    setMediaBusyId(item.id);
    setMediaError('');
    setMediaNotice('');
    try {
      await adminApi.deleteEventMedia(eventId, item.id);
      setMediaNotice(locale === 'ru' ? 'Медиа удалено из фотобанка.' : 'Media removed from the bank.');
      await loadMedia();
    } catch (err: any) {
      setMediaError(err.message || (locale === 'ru' ? 'Не удалось удалить медиа' : 'Failed to remove media'));
    } finally {
      setMediaBusyId(null);
    }
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Контент события' : 'Event content'}
        subtitle={locale === 'ru' ? 'Публичная страница, описание, медиа и теги' : 'Public page, copy, media, and tags'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <div className="admin-event-summary-grid">
          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Публичная карточка' : 'Public card'} subtitle={event.slug ? `/${event.slug}` : undefined} />
            {(event as any).coverImageUrl ? (
              <Image className="admin-event-cover-preview" src={(event as any).coverImageUrl} alt="" width={400} height={200} style={{ objectFit: 'cover' }} />
            ) : (
              <EmptyState title={locale === 'ru' ? 'Обложка не задана' : 'No cover image'} description={locale === 'ru' ? 'Добавьте изображение в настройках события.' : 'Add an image from event settings.'} />
            )}
            {tags.length ? <div className="signal-muted">{tags.join(', ')}</div> : null}
          </Panel>

          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={locale === 'ru' ? 'Тексты' : 'Copy'} subtitle={locale === 'ru' ? 'То, что видит пользователь на странице события' : 'What users see on the event page'} />
            <div className="admin-content-preview-stack">
              <div>
                <small>{locale === 'ru' ? 'Название' : 'Title'}</small>
                <strong>{event.title}</strong>
              </div>
              <div>
                <small>{locale === 'ru' ? 'Короткое описание' : 'Short description'}</small>
                <p>{(event as any).shortDescription || '—'}</p>
              </div>
              <div>
                <small>{locale === 'ru' ? 'Описание' : 'Description'}</small>
                <p>{(event as any).fullDescription || (event as any).description || '—'}</p>
              </div>
              <div>
                <small>{locale === 'ru' ? 'Условия участия' : 'Conditions'}</small>
                <p>{(event as any).conditions || '—'}</p>
              </div>
            </div>
          </Panel>

          <Panel variant="elevated" className="admin-command-panel admin-event-media-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Фотобанк и модерация' : 'Media bank moderation'}
              subtitle={locale === 'ru' ? 'Публикуйте материалы организаторов и проверяйте отправки участников' : 'Publish organizer media and review participant submissions'}
            />

            {mediaError ? <Notice tone="danger">{mediaError}</Notice> : null}
            {mediaNotice ? <Notice tone="success">{mediaNotice}</Notice> : null}

            <form className="admin-event-media-upload" onSubmit={handleAdminMediaUpload}>
              <label>
                <span>{locale === 'ru' ? 'Файл организатора' : 'Organizer file'}</span>
                <input type="file" accept="image/*,video/*,audio/*,application/pdf" onChange={(e) => setMediaFile(e.currentTarget.files?.[0] ?? null)} />
              </label>
              <label>
                <span>{locale === 'ru' ? 'Название' : 'Title'}</span>
                <input value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} maxLength={120} />
              </label>
              <label>
                <span>{locale === 'ru' ? 'Автор / кредит' : 'Credit'}</span>
                <input value={mediaCredit} onChange={(e) => setMediaCredit(e.target.value)} maxLength={120} />
              </label>
              <label className="admin-event-media-caption">
                <span>{locale === 'ru' ? 'Подпись' : 'Caption'}</span>
                <textarea value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} rows={3} maxLength={1000} />
              </label>
              <button className="btn btn-primary btn-sm" type="submit" disabled={mediaUploading}>
                {mediaUploading ? (locale === 'ru' ? 'Публикуем...' : 'Publishing...') : (locale === 'ru' ? 'Опубликовать медиа' : 'Publish media')}
              </button>
            </form>

            <div className="admin-event-media-toolbar">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as MediaFilter[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`btn btn-sm ${mediaFilter === status ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMediaFilter(status)}
                >
                  {status === 'PENDING'
                    ? (locale === 'ru' ? 'На модерации' : 'Pending')
                    : status === 'APPROVED'
                      ? (locale === 'ru' ? 'Опубликовано' : 'Approved')
                      : status === 'REJECTED'
                        ? (locale === 'ru' ? 'Отклонено' : 'Rejected')
                        : (locale === 'ru' ? 'Все' : 'All')}
                </button>
              ))}
            </div>

            {mediaLoading ? (
              <LoadingLines rows={5} />
            ) : mediaItems.length ? (
              <div className="admin-event-media-list">
                {mediaItems.map((item) => (
                  <article className="admin-event-media-card" key={item.id}>
                    <div className="admin-event-media-preview">
                      {renderAdminMediaPreview(item)}
                    </div>
                    <div className="admin-event-media-body">
                      <div className="admin-event-media-title-row">
                        <strong>{item.title || item.asset.originalFilename}</strong>
                        <span className={`admin-event-media-status admin-event-media-status-${item.status.toLowerCase()}`}>{item.status}</span>
                      </div>
                      {item.caption ? <p>{item.caption}</p> : null}
                      <div className="signal-muted">
                        {formatMediaSource(item, locale)}
                        {item.uploader?.email ? ` · ${item.uploader.email}` : ''}
                        {item.credit ? ` · ${item.credit}` : ''}
                      </div>
                      <textarea
                        value={mediaNotes[item.id] ?? item.moderationNotes ?? ''}
                        onChange={(e) => setMediaNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        rows={2}
                        maxLength={1000}
                        placeholder={locale === 'ru' ? 'Комментарий модератора' : 'Moderator note'}
                      />
                      <div className="admin-event-media-actions">
                        <button className="btn btn-secondary btn-sm" type="button" disabled={mediaBusyId === item.id} onClick={() => handleModerateMedia(item, 'APPROVED')}>
                          {locale === 'ru' ? 'Одобрить' : 'Approve'}
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" disabled={mediaBusyId === item.id} onClick={() => handleModerateMedia(item, 'REJECTED')}>
                          {locale === 'ru' ? 'Отклонить' : 'Reject'}
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" disabled={mediaBusyId === item.id} onClick={() => handleDeleteMedia(item)}>
                          {locale === 'ru' ? 'Удалить' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title={locale === 'ru' ? 'Нет медиа в выбранном статусе' : 'No media in this status'}
                description={locale === 'ru' ? 'Материалы участников появятся здесь после отправки.' : 'Participant submissions will appear here after upload.'}
              />
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
