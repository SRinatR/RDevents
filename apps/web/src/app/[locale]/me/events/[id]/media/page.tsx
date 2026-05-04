'use client';

import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { eventsApi, eventMediaApi, type EventMediaCaptionSuggestion, type EventMediaItem, type MediaInput } from '@/lib/api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type ParticipantMediaTab = 'upload' | 'mine' | 'captions' | 'suggest';
type TargetType = 'all' | 'image' | 'video';

function emptyDraft(): MediaInput {
  return { title: '', caption: '', credit: '', altText: '' };
}

function statusTone(status: EventMediaItem['status'] | EventMediaCaptionSuggestion['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function statusLabel(status: string, isRu: boolean) {
  const ru: Record<string, string> = {
    PENDING: 'На модерации',
    APPROVED: 'Принято',
    REJECTED: 'Отклонено',
    DELETED: 'Удалено',
    CANCELLED: 'Отменено',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    DELETED: 'Deleted',
    CANCELLED: 'Cancelled',
  };
  return (isRu ? ru : en)[status] ?? status;
}

export default function ParticipantEventMediaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');
  const isRu = locale === 'ru';

  const [eventTitle, setEventTitle] = useState('');
  const [activeTab, setActiveTab] = useState<ParticipantMediaTab>('upload');
  const [myMedia, setMyMedia] = useState<EventMediaItem[]>([]);
  const [suggestions, setSuggestions] = useState<EventMediaCaptionSuggestion[]>([]);
  const [targets, setTargets] = useState<EventMediaItem[]>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [selectedTarget, setSelectedTarget] = useState<EventMediaItem | null>(null);
  const [targetDraft, setTargetDraft] = useState<MediaInput>(emptyDraft());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState<MediaInput>(emptyDraft());
  const [pageLoading, setPageLoading] = useState(true);
  const [targetLoading, setTargetLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setPageLoading(true);
    setError('');
    try {
      const [eventResult, myMediaResult, suggestionsResult] = await Promise.all([
        eventsApi.myEvents(),
        eventMediaApi.myList(eventId),
        eventMediaApi.captionSuggestions.myList(eventId),
      ]);
      const event = (eventResult.events ?? []).find((item: any) => item.id === eventId);
      setEventTitle(event?.title ?? '');
      setMyMedia(myMediaResult.media);
      setSuggestions(suggestionsResult.suggestions);
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
      setMyMedia([]);
      setSuggestions([]);
    } finally {
      setPageLoading(false);
    }
  }, [eventId, locale]);

  const loadTargets = useCallback(async () => {
    if (!eventId) return;
    setTargetLoading(true);
    try {
      const result = await eventMediaApi.captionSuggestions.listTargets(eventId, { search: targetSearch, type: targetType, limit: 40 });
      setTargets(result.media);
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
      setTargets([]);
    } finally {
      setTargetLoading(false);
    }
  }, [eventId, locale, targetSearch, targetType]);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!user || activeTab !== 'suggest') return;
    const handle = window.setTimeout(() => void loadTargets(), 220);
    return () => window.clearTimeout(handle);
  }, [user, activeTab, loadTargets]);

  const pendingUploads = useMemo(() => myMedia.filter((item) => item.status === 'PENDING').length, [myMedia]);
  const pendingSuggestions = useMemo(() => suggestions.filter((item) => item.status === 'PENDING').length, [suggestions]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setUploadFile(event.currentTarget.files?.[0] ?? null);
    setError('');
    setNotice('');
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventId || !uploadFile) {
      setError(isRu ? 'Выберите фото или видео.' : 'Choose a photo or video.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await eventMediaApi.submit(eventId, uploadFile, uploadDraft);
      setUploadFile(null);
      setUploadDraft(emptyDraft());
      setNotice(isRu ? 'Материал отправлен. Статус будет виден в “Мои загрузки”.' : 'Media submitted. You can track it in My uploads.');
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  function chooseTarget(item: EventMediaItem) {
    setSelectedTarget(item);
    setTargetDraft({
      title: item.title ?? '',
      caption: item.caption ?? '',
      credit: item.credit ?? '',
      altText: item.altText ?? '',
    });
    setNotice('');
    setError('');
  }

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventId || !selectedTarget) {
      setError(isRu ? 'Выберите медиа, к которому хотите предложить подпись.' : 'Choose a media item to suggest a caption for.');
      return;
    }
    if (!targetDraft.title && !targetDraft.caption && !targetDraft.credit && !targetDraft.altText) {
      setError(isRu ? 'Заполните хотя бы одно поле предложения.' : 'Fill at least one suggestion field.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await eventMediaApi.captionSuggestions.create(eventId, selectedTarget.id, targetDraft);
      setSelectedTarget(null);
      setTargetDraft(emptyDraft());
      setNotice(isRu ? 'Предложение отправлено на модерацию.' : 'Suggestion sent for moderation.');
      await Promise.all([loadData(), loadTargets()]);
      setActiveTab('captions');
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell participant-event-media-page">
      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader
          title={isRu ? 'Фотобанк участника' : 'Participant media bank'}
          subtitle={eventTitle
            ? `${eventTitle} · ${isRu ? 'загрузка материалов и предложения подписей' : 'uploads and caption suggestions'}`
            : (isRu ? 'Загрузка материалов и предложения подписей' : 'Uploads and caption suggestions')}
        />
        <div className="workspace-status-strip workspace-status-strip-v2">
          <div className="workspace-status-card"><small>{isRu ? 'Мои загрузки' : 'My uploads'}</small><strong>{myMedia.length}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Загрузки ждут' : 'Uploads pending'}</small><strong>{pendingUploads}</strong></div>
          <div className="workspace-status-card"><small>{isRu ? 'Подписи ждут' : 'Captions pending'}</small><strong>{pendingSuggestions}</strong></div>
        </div>
        <ToolbarRow>
          <button type="button" className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('upload')}>{isRu ? 'Загрузить' : 'Upload'}</button>
          <button type="button" className={`btn btn-sm ${activeTab === 'mine' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('mine')}>{isRu ? 'Мои загрузки' : 'My uploads'}</button>
          <button type="button" className={`btn btn-sm ${activeTab === 'captions' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('captions')}>{isRu ? 'Мои подписи' : 'My captions'}</button>
          <button type="button" className={`btn btn-sm ${activeTab === 'suggest' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('suggest')}>{isRu ? 'Предложить подпись' : 'Suggest caption'}</button>
          <Link href={`/${locale}/me/media`} className="btn btn-ghost btn-sm">{isRu ? 'Все мои фотобанки' : 'All my media banks'}</Link>
        </ToolbarRow>
      </Panel>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {pageLoading ? <LoadingLines rows={8} /> : null}

      {!pageLoading && activeTab === 'upload' ? (
        <Panel variant="elevated" className="admin-command-panel admin-media-upload-panel">
          <SectionHeader title={isRu ? 'Загрузить фото или видео' : 'Upload photo or video'} subtitle={isRu ? 'После отправки материал может попасть на модерацию.' : 'After submission, the media may be moderated.'} />
          <form className="admin-media-upload-form" onSubmit={handleUpload}>
            <label className="media-upload-dropzone">
              <span>{uploadFile ? uploadFile.name : (isRu ? 'Выбрать файл' : 'Choose file')}</span>
              <small>image/* или video/*</small>
              <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
            <FieldInput value={uploadDraft.title ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, title: event.target.value }))} placeholder={isRu ? 'Название' : 'Title'} />
            <FieldTextarea value={uploadDraft.caption ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, caption: event.target.value }))} placeholder={isRu ? 'Подпись' : 'Caption'} rows={3} />
            <FieldInput value={uploadDraft.credit ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, credit: event.target.value }))} placeholder="Credit" />
            <FieldInput value={uploadDraft.altText ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, altText: event.target.value }))} placeholder="Alt text" />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !uploadFile}>{busy ? (isRu ? 'Отправляем...' : 'Submitting...') : (isRu ? 'Отправить' : 'Submit')}</button>
          </form>
        </Panel>
      ) : null}

      {!pageLoading && activeTab === 'mine' ? (
        myMedia.length ? <MediaList items={myMedia} isRu={isRu} locale={locale} /> : <EmptyState title={isRu ? 'Вы ещё ничего не загружали' : 'No uploads yet'} description={isRu ? 'Загрузите первое фото или видео.' : 'Upload your first photo or video.'} />
      ) : null}

      {!pageLoading && activeTab === 'captions' ? (
        suggestions.length ? <SuggestionList suggestions={suggestions} isRu={isRu} locale={locale} /> : <EmptyState title={isRu ? 'Предложений подписей пока нет' : 'No caption suggestions yet'} description={isRu ? 'Откройте вкладку “Предложить подпись”.' : 'Open the Suggest caption tab.'} />
      ) : null}

      {!pageLoading && activeTab === 'suggest' ? (
        <div className="admin-media-albums-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)', gap: 18, alignItems: 'start' }}>
          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={isRu ? 'Выберите опубликованное медиа' : 'Choose published media'} subtitle={isRu ? 'Найдите фото или видео и предложите более точную подпись.' : 'Find a photo or video and suggest a better caption.'} />
            <ToolbarRow>
              <FieldInput value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder={isRu ? 'Поиск по номеру, подписи, автору' : 'Search by number, caption, author'} />
              <select className="signal-field signal-select" value={targetType} onChange={(event) => setTargetType(event.target.value as TargetType)}>
                <option value="all">{isRu ? 'Все' : 'All'}</option>
                <option value="image">{isRu ? 'Фото' : 'Photos'}</option>
                <option value="video">{isRu ? 'Видео' : 'Videos'}</option>
              </select>
            </ToolbarRow>
            {targetLoading ? <LoadingLines rows={6} /> : targets.length ? <MediaList items={targets} isRu={isRu} locale={locale} onChoose={chooseTarget} /> : <EmptyState title={isRu ? 'Медиа не найдены' : 'No media found'} description={isRu ? 'Попробуйте изменить поиск.' : 'Try changing search.'} />}
          </Panel>

          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader title={isRu ? 'Ваше предложение' : 'Your suggestion'} subtitle={selectedTarget ? (selectedTarget.title || selectedTarget.asset.originalFilename) : (isRu ? 'Сначала выберите медиа слева' : 'First choose media on the left')} />
            {selectedTarget ? (
              <form className="admin-media-upload-form" onSubmit={submitSuggestion}>
                <MediaPreview publicUrl={selectedTarget.asset.publicUrl} storageKey={selectedTarget.asset.storageKey} kind={selectedTarget.kind} alt={selectedTarget.altText || selectedTarget.title || selectedTarget.caption || selectedTarget.asset.originalFilename} sizes="360px" />
                <FieldInput value={targetDraft.title ?? ''} onChange={(event) => setTargetDraft((current) => ({ ...current, title: event.target.value }))} placeholder={isRu ? 'Название' : 'Title'} />
                <FieldTextarea value={targetDraft.caption ?? ''} onChange={(event) => setTargetDraft((current) => ({ ...current, caption: event.target.value }))} placeholder={isRu ? 'Подпись' : 'Caption'} rows={4} />
                <FieldInput value={targetDraft.credit ?? ''} onChange={(event) => setTargetDraft((current) => ({ ...current, credit: event.target.value }))} placeholder="Credit" />
                <FieldInput value={targetDraft.altText ?? ''} onChange={(event) => setTargetDraft((current) => ({ ...current, altText: event.target.value }))} placeholder="Alt text" />
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? (isRu ? 'Отправляем...' : 'Submitting...') : (isRu ? 'Отправить на модерацию' : 'Send for moderation')}</button>
              </form>
            ) : <Notice tone="info">{isRu ? 'Выберите материал, чтобы предложить подпись.' : 'Choose a media item to suggest a caption.'}</Notice>}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function MediaList({ items, isRu, locale, onChoose }: { items: EventMediaItem[]; isRu: boolean; locale: string; onChoose?: (item: EventMediaItem) => void }) {
  return (
    <div className="admin-event-media-list">
      {items.map((item) => (
        <article key={item.id} className="admin-event-media-card">
          <div className="admin-event-media-preview">
            <MediaPreview publicUrl={item.asset.publicUrl} storageKey={item.asset.storageKey} kind={item.kind} alt={item.altText || item.title || item.caption || item.asset.originalFilename} sizes="(max-width: 768px) 100vw, 280px" />
          </div>
          <div className="admin-event-media-body">
            <div className="admin-event-media-title-row">
              <strong>{item.title || item.asset.originalFilename}</strong>
              <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, isRu)}</StatusBadge>
            </div>
            <div className="signal-muted">{item.kind} · #{item.displayNumber ?? '—'} · {new Date(item.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}</div>
            {item.caption ? <div className="signal-muted">{item.caption}</div> : null}
            {onChoose ? <ToolbarRow><button type="button" className="btn btn-secondary btn-sm" onClick={() => onChoose(item)}>{isRu ? 'Выбрать' : 'Choose'}</button></ToolbarRow> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function SuggestionList({ suggestions, isRu, locale }: { suggestions: EventMediaCaptionSuggestion[]; isRu: boolean; locale: string }) {
  return (
    <div className="admin-event-media-list">
      {suggestions.map((item) => (
        <article className="admin-event-media-card" key={item.id}>
          {item.media ? <div className="admin-event-media-preview"><MediaPreview publicUrl={item.media.asset.publicUrl} storageKey={item.media.asset.storageKey} kind={item.media.kind} alt={item.media.altText || item.media.title || item.media.caption || item.media.asset.originalFilename} sizes="(max-width: 768px) 100vw, 280px" /></div> : null}
          <div className="admin-event-media-body">
            <div className="admin-event-media-title-row">
              <strong>{item.suggestedTitle || item.media?.title || item.media?.asset.originalFilename || (isRu ? 'Предложение' : 'Suggestion')}</strong>
              <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, isRu)}</StatusBadge>
            </div>
            <div className="signal-muted">{new Date(item.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}</div>
            {item.suggestedCaption ? <div className="signal-muted">{item.suggestedCaption}</div> : null}
            {item.moderationReason ? <Notice tone="warning">{item.moderationReason}</Notice> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
