'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import {
  adminApi,
  eventMediaApi,
  type AdminMediaUpdate,
  type EventMediaItem,
  type EventMediaPublicVisibility,
  type EventMediaSettings,
  type EventMediaSummary,
  type MediaInput,
} from '@/lib/api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type MediaStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED' | 'ALL';
type MediaTypeFilter = 'all' | 'image' | 'video';
type AdminMediaTab = 'media' | 'settings';

const STATUS_FILTERS: MediaStatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'DELETED', 'ALL'];
const TYPE_FILTERS: MediaTypeFilter[] = ['all', 'image', 'video'];

const DEFAULT_SETTINGS: EventMediaSettings = {
  enabled: true,
  participantUploadEnabled: true,
  moderationEnabled: true,
  showUploaderName: false,
  showCredit: true,
  allowParticipantTitle: true,
  allowParticipantCaption: true,
  maxFileSizeMb: 25,
  allowedTypes: ['image', 'video'],
};

function emptyDraft(item?: EventMediaItem): MediaInput {
  return {
    title: item?.title ?? '',
    caption: item?.caption ?? '',
    credit: item?.credit ?? '',
    altText: item?.altText ?? '',
  };
}

function statusLabel(status: MediaStatusFilter | EventMediaItem['status'], locale: string) {
  const ru: Record<string, string> = {
    PENDING: 'На модерации',
    APPROVED: 'Опубликовано',
    REJECTED: 'Отклонено',
    DELETED: 'Удалено',
    ALL: 'Все',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    DELETED: 'Deleted',
    ALL: 'All',
  };
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

function typeLabel(type: MediaTypeFilter, locale: string) {
  const ru: Record<MediaTypeFilter, string> = { all: 'Все типы', image: 'Фото', video: 'Видео' };
  const en: Record<MediaTypeFilter, string> = { all: 'All types', image: 'Photos', video: 'Videos' };
  return (locale === 'ru' ? ru : en)[type];
}

function statusTone(status: EventMediaItem['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function renderPreview(item: EventMediaItem) {
  const label = item.altText || item.title || item.caption || item.asset.originalFilename;
  return (
    <MediaPreview
      publicUrl={item.asset.publicUrl}
      storageKey={item.asset.storageKey}
      kind={item.kind}
      alt={label}
      sizes="(max-width: 768px) 100vw, 280px"
    />
  );
}

export default function AdminEventMediaPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');
  const isRu = locale === 'ru';

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [activeTab, setActiveTab] = useState<AdminMediaTab>('media');
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [settings, setSettings] = useState<EventMediaSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<EventMediaSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<EventMediaSummary>({ total: 0, pending: 0, approved: 0, rejected: 0, deleted: 0, participant: 0, admin: 0, images: 0, videos: 0 });
  const [visibility, setVisibility] = useState<EventMediaPublicVisibility | null>(null);
  const [status, setStatus] = useState<MediaStatusFilter>('PENDING');
  const [type, setType] = useState<MediaTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, MediaInput>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState<MediaInput>(emptyDraft());
  const [pageLoading, setPageLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [pageError, setPageError] = useState('');
  const [listError, setListError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setPageLoading(true);
    setPageError('');
    try {
      const [eventResult, settingsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        eventMediaApi.getSettings(eventId).catch(() => ({ settings: DEFAULT_SETTINGS })),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setSettings(settingsResult.settings);
      setSettingsDraft(settingsResult.settings);
    } catch (err: any) {
      console.error('[media-bank] page load failed', err);
      setPageError(getFriendlyApiErrorMessage(err, locale));
      setEvent(null);
    } finally {
      setPageLoading(false);
    }
  }, [eventId, locale]);

  const loadSummary = useCallback(async () => {
    if (!eventId) return;
    try {
      const result = await eventMediaApi.summary(eventId);
      setSummary(result.summary);
    } catch (err) {
      console.error('[media-bank] summary load failed', err);
    }
  }, [eventId]);

  const loadVisibility = useCallback(async () => {
    if (!eventId) return;
    try {
      const result = await eventMediaApi.publicVisibility(eventId);
      setVisibility(result.visibility);
    } catch (err) {
      console.error('[media-bank] public visibility load failed', err);
      setVisibility(null);
    }
  }, [eventId]);

  const loadMedia = useCallback(async () => {
    if (!eventId) return;
    setMediaLoading(true);
    setListError('');
    try {
      const result = await eventMediaApi.adminList(eventId, { status, type, search, limit: 50 });
      setMedia(result.media);
      setDrafts(Object.fromEntries(result.media.map((item) => [item.id, emptyDraft(item)])));
      setRejectReasons(Object.fromEntries(result.media.map((item) => [item.id, item.moderationNotes ?? ''])));
    } catch (err: any) {
      console.error('[media-bank] media list failed', err);
      setListError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setMediaLoading(false);
    }
  }, [eventId, status, type, search, locale]);

  useEffect(() => {
    if (user && isAdmin) void loadEvent();
  }, [user, isAdmin, loadEvent]);

  useEffect(() => {
    if (user && isAdmin) void Promise.all([loadMedia(), loadSummary(), loadVisibility()]);
  }, [user, isAdmin, loadMedia, loadSummary, loadVisibility]);

  function patchDraft(mediaId: string, key: keyof MediaInput, value: string) {
    setDrafts((current) => ({ ...current, [mediaId]: { ...current[mediaId], [key]: value } }));
  }

  function patchSettings(key: keyof EventMediaSettings, value: boolean | number | Array<'image' | 'video'>) {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleAllowedType(kind: 'image' | 'video', checked: boolean) {
    const next = checked
      ? ([...new Set([...settingsDraft.allowedTypes, kind])] as Array<'image' | 'video'>)
      : settingsDraft.allowedTypes.filter((item): item is 'image' | 'video' => item !== kind);
    if (!checked && settingsDraft.allowedTypes.length <= 1) {
      setNotice(isRu ? 'Нужно оставить хотя бы один тип медиа.' : 'At least one media type must stay enabled.');
      return;
    }
    patchSettings('allowedTypes', next);
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    if (!eventId || !uploadFile) {
      setUploadError(isRu ? 'Выберите фото или видео.' : 'Choose a photo or video.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setNotice('');
    try {
      await eventMediaApi.adminUpload(eventId, uploadFile, uploadDraft);
      setUploadFile(null);
      setUploadDraft(emptyDraft());
      form.reset();
      setNotice(isRu ? 'Медиа от организатора опубликовано.' : 'Organizer media was published.');
      await Promise.all([loadMedia(), loadSummary(), loadVisibility()]);
    } catch (err: any) {
      console.error('[media-bank] upload failed', err);
      setUploadError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate(item: EventMediaItem, nextStatus?: EventMediaItem['status']) {
    if (!eventId) return;
    const reason = rejectReasons[item.id]?.trim() ?? '';
    if (nextStatus === 'REJECTED' && !reason) {
      setActionError(isRu ? 'Причина отклонения обязательна.' : 'Rejection reason is required.');
      return;
    }

    const body: AdminMediaUpdate = {
      ...drafts[item.id],
      status: nextStatus,
      moderationNotes: nextStatus === 'REJECTED' ? reason : reason || undefined,
    };

    setBusyId(item.id);
    setActionError('');
    setNotice('');
    try {
      await eventMediaApi.adminUpdate(eventId, item.id, body);
      setNotice(nextStatus
        ? (isRu ? `Статус обновлён: ${statusLabel(nextStatus, locale)}.` : `Status updated: ${statusLabel(nextStatus, locale)}.`)
        : (isRu ? 'Подписи сохранены.' : 'Captions saved.'));
      await Promise.all([loadMedia(), loadSummary(), loadVisibility()]);
    } catch (err: any) {
      console.error('[media-bank] media action failed', err);
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(item: EventMediaItem) {
    if (!eventId) return;
    setBusyId(item.id);
    setActionError('');
    setNotice('');
    try {
      await eventMediaApi.adminDelete(eventId, item.id);
      setNotice(isRu ? 'Медиа скрыто из фотобанка.' : 'Media was hidden from the bank.');
      await Promise.all([loadMedia(), loadSummary(), loadVisibility()]);
    } catch (err: any) {
      console.error('[media-bank] media delete failed', err);
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function handleSaveSettings() {
    if (!eventId) return;
    setSavingSettings(true);
    setSettingsError('');
    setNotice('');
    try {
      const result = await eventMediaApi.updateSettings(eventId, settingsDraft);
      setSettings(result.settings);
      setSettingsDraft(result.settings);
      setNotice(isRu ? 'Настройки фотобанка сохранены.' : 'Media bank settings saved.');
      await Promise.all([loadSummary(), loadVisibility()]);
    } catch (err: any) {
      console.error('[media-bank] settings save failed', err);
      setSettingsError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!pageLoading && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page admin-media-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={isRu ? 'Фотобанк мероприятия' : 'Event media bank'}
        subtitle={event ? `${event.title} · ${statusLabel(status, locale)}` : undefined}
      />

      {pageError ? <Notice tone="danger">{pageError}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {pageLoading ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <>
          <div className="workspace-status-strip workspace-status-strip-v2">
            <div className="workspace-status-card"><small>{isRu ? 'Всего' : 'Total'}</small><strong>{summary.total}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'На модерации' : 'Pending'}</small><strong>{summary.pending}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Опубликовано' : 'Approved'}</small><strong>{summary.approved}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Фотобанк' : 'Media bank'}</small><strong>{settings.enabled ? (isRu ? 'Включён' : 'Enabled') : (isRu ? 'Выключен' : 'Disabled')}</strong></div>
          </div>

          {visibility ? (
            <Panel variant="elevated" className="admin-command-panel admin-media-visibility-panel">
              <SectionHeader
                title={isRu ? 'Публичная видимость' : 'Public visibility'}
                subtitle={visibility.visibleOnPublicPages
                  ? (isRu ? 'Материалы доступны на публичных страницах.' : 'Media is visible on public pages.')
                  : visibility.reason}
              />
              <div className="admin-media-visibility-grid">
                <div><small>{isRu ? 'Событие опубликовано' : 'Event published'}</small><strong>{visibility.eventPublished ? (isRu ? 'Да' : 'Yes') : (isRu ? 'Нет' : 'No')}</strong></div>
                <div><small>{isRu ? 'Фотобанк включён' : 'Media bank enabled'}</small><strong>{visibility.mediaBankEnabled ? (isRu ? 'Да' : 'Yes') : (isRu ? 'Нет' : 'No')}</strong></div>
                <div><small>{isRu ? 'Опубликованных медиа' : 'Approved media'}</small><strong>{visibility.approvedMedia}</strong></div>
                <div><small>{isRu ? 'Активных файлов' : 'Active files'}</small><strong>{visibility.activeAssets}</strong></div>
                <div><small>{isRu ? 'Публично' : 'Public'}</small><strong>{visibility.visibleOnPublicPages ? (isRu ? 'Да' : 'Yes') : (isRu ? 'Нет' : 'No')}</strong></div>
                <div><small>{isRu ? 'Причина' : 'Reason'}</small><strong>{visibility.reasonCode}</strong></div>
              </div>
            </Panel>
          ) : null}

          <ToolbarRow>
            <button type="button" className={`btn btn-sm ${activeTab === 'media' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('media')}>
              {isRu ? 'Медиа' : 'Media'}
            </button>
            <button type="button" className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('settings')}>
              {isRu ? 'Настройки' : 'Settings'}
            </button>
          </ToolbarRow>

          {activeTab === 'media' ? (
            <>
              <Panel variant="elevated" className="admin-command-panel admin-media-upload-panel">
                <SectionHeader
                  title={isRu ? 'Загрузить от организатора' : 'Upload as organizer'}
                  subtitle={isRu ? 'Материал сразу публикуется в фотобанке' : 'Organizer uploads are published immediately'}
                />
                <form className="admin-media-upload-form" onSubmit={handleUpload}>
                  <label className="media-upload-dropzone">
                    <span>{uploadFile ? uploadFile.name : (isRu ? 'Файл фото или видео' : 'Photo or video file')}</span>
                    <small>{isRu ? 'image/* или video/*' : 'image/* or video/*'}</small>
                    <input type="file" accept="image/*,video/*" onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)} />
                  </label>
                  <FieldInput value={uploadDraft.title ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, title: event.target.value }))} maxLength={120} placeholder={isRu ? 'Название' : 'Title'} />
                  <FieldInput value={uploadDraft.credit ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, credit: event.target.value }))} maxLength={120} placeholder={isRu ? 'Автор / credit' : 'Author / credit'} />
                  <FieldInput value={uploadDraft.altText ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, altText: event.target.value }))} maxLength={180} placeholder="Alt text" />
                  <FieldTextarea value={uploadDraft.caption ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, caption: event.target.value }))} maxLength={1000} rows={3} placeholder={isRu ? 'Подпись' : 'Caption'} />
                  <button className="btn btn-primary btn-sm" type="submit" disabled={uploading || !uploadFile}>
                    {uploading ? (isRu ? 'Публикуем...' : 'Publishing...') : (isRu ? 'Опубликовать' : 'Publish')}
                  </button>
                </form>
                {uploadError ? <Notice tone="danger">{uploadError}</Notice> : null}
              </Panel>

              <Panel variant="elevated" className="admin-command-panel admin-media-list-panel">
                <SectionHeader title={isRu ? 'Материалы фотобанка' : 'Media bank items'} subtitle={isRu ? 'Фильтры, подписи и модерация' : 'Filters, captions, and moderation'} />
                {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
                {listError ? <Notice tone="danger">{listError}</Notice> : null}
                <ToolbarRow>
                  {STATUS_FILTERS.map((item) => (
                    <button key={item} type="button" className={`btn btn-sm ${status === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(item)}>
                      {statusLabel(item, locale)}
                    </button>
                  ))}
                </ToolbarRow>
                <ToolbarRow>
                  {TYPE_FILTERS.map((item) => (
                    <button key={item} type="button" className={`btn btn-sm ${type === item ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setType(item)}>
                      {typeLabel(item, locale)}
                    </button>
                  ))}
                  <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск' : 'Search'} />
                </ToolbarRow>

                {mediaLoading ? <LoadingLines rows={6} /> : media.length === 0 ? (
                  <EmptyState title={isRu ? 'Материалов нет' : 'No media yet'} description={isRu ? 'Загрузите первый файл или измените фильтры.' : 'Upload the first file or change filters.'} />
                ) : (
                  <div className="admin-event-media-list">
                    {media.map((item) => {
                      const draft = drafts[item.id] ?? emptyDraft(item);
                      return (
                        <article className="admin-event-media-card" key={item.id}>
                          <div className="admin-event-media-preview">{renderPreview(item)}</div>
                          <div className="admin-event-media-body">
                            <div className="admin-event-media-title-row">
                              <strong>{item.title || item.asset.originalFilename}</strong>
                              <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, locale)}</StatusBadge>
                            </div>
                            <div className="signal-muted">
                              {formatMediaDisplayNumber(item, locale)} · {item.kind} · {item.source}
                              {item.uploader?.email ? ` · ${item.uploader.email}` : ''}
                            </div>
                            <FieldInput value={draft.title ?? ''} onChange={(event) => patchDraft(item.id, 'title', event.target.value)} maxLength={120} placeholder={isRu ? 'Название' : 'Title'} />
                            <FieldInput value={draft.credit ?? ''} onChange={(event) => patchDraft(item.id, 'credit', event.target.value)} maxLength={120} placeholder={isRu ? 'Автор / credit' : 'Author / credit'} />
                            <FieldInput value={draft.altText ?? ''} onChange={(event) => patchDraft(item.id, 'altText', event.target.value)} maxLength={180} placeholder="Alt text" />
                            <FieldTextarea value={draft.caption ?? ''} onChange={(event) => patchDraft(item.id, 'caption', event.target.value)} rows={3} maxLength={1000} placeholder={isRu ? 'Подпись' : 'Caption'} />
                            <FieldTextarea value={rejectReasons[item.id] ?? ''} onChange={(event) => setRejectReasons((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} maxLength={1000} placeholder={isRu ? 'Причина / заметка модератора' : 'Rejection reason / moderator note'} />
                            <div className="admin-event-media-actions">
                              <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleUpdate(item)}>{isRu ? 'Сохранить' : 'Save'}</button>
                              <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleUpdate(item, 'APPROVED')}>{isRu ? 'Одобрить' : 'Approve'}</button>
                              <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleUpdate(item, 'REJECTED')}>{isRu ? 'Отклонить' : 'Reject'}</button>
                              <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleDelete(item)}>{isRu ? 'Удалить' : 'Delete'}</button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </>
          ) : null}

          {activeTab === 'settings' ? (
            <Panel variant="elevated" className="admin-command-panel admin-media-settings-panel">
              <SectionHeader title={isRu ? 'Настройки фотобанка' : 'Media bank settings'} subtitle={isRu ? 'Видимость, премодерация и правила загрузки' : 'Visibility, moderation, and upload rules'} />
              <div className="admin-media-settings-grid">
                <label><input type="checkbox" checked={settingsDraft.enabled} onChange={(event) => patchSettings('enabled', event.target.checked)} /> {isRu ? 'Фотобанк включён' : 'Media bank enabled'}</label>
                <label><input type="checkbox" checked={settingsDraft.participantUploadEnabled} onChange={(event) => patchSettings('participantUploadEnabled', event.target.checked)} /> {isRu ? 'Загрузка участниками включена' : 'Participant upload enabled'}</label>
                <label><input type="checkbox" checked={settingsDraft.moderationEnabled} onChange={(event) => patchSettings('moderationEnabled', event.target.checked)} /> {isRu ? 'Премодерация включена' : 'Pre-moderation enabled'}</label>
                <label><input type="checkbox" checked={settingsDraft.showUploaderName} onChange={(event) => patchSettings('showUploaderName', event.target.checked)} /> {isRu ? 'Показывать uploader' : 'Show uploader name'}</label>
                <label><input type="checkbox" checked={settingsDraft.showCredit} onChange={(event) => patchSettings('showCredit', event.target.checked)} /> {isRu ? 'Показывать credit' : 'Show credit'}</label>
                <label><input type="checkbox" checked={settingsDraft.allowParticipantTitle} onChange={(event) => patchSettings('allowParticipantTitle', event.target.checked)} /> {isRu ? 'Участник задаёт название' : 'Participants can set title'}</label>
                <label><input type="checkbox" checked={settingsDraft.allowParticipantCaption} onChange={(event) => patchSettings('allowParticipantCaption', event.target.checked)} /> {isRu ? 'Участник задаёт подпись' : 'Participants can set caption'}</label>
                <label className="admin-media-settings-size">
                  <span>{isRu ? 'Максимальный размер, MB' : 'Max file size, MB'}</span>
                  <FieldInput type="number" min={1} max={100} value={settingsDraft.maxFileSizeMb} onChange={(event) => patchSettings('maxFileSizeMb', Number(event.target.value))} />
                </label>
                <label><input type="checkbox" checked={settingsDraft.allowedTypes.includes('image')} onChange={(event) => toggleAllowedType('image', event.target.checked)} /> {isRu ? 'Фото' : 'Photos'}</label>
                <label><input type="checkbox" checked={settingsDraft.allowedTypes.includes('video')} onChange={(event) => toggleAllowedType('video', event.target.checked)} /> {isRu ? 'Видео' : 'Videos'}</label>
              </div>
              <ToolbarRow>
                <button className="btn btn-secondary btn-sm" type="button" disabled={savingSettings} onClick={handleSaveSettings}>
                  {savingSettings ? (isRu ? 'Сохраняем...' : 'Saving...') : (isRu ? 'Сохранить настройки' : 'Save settings')}
                </button>
              </ToolbarRow>
              {settingsError ? <Notice tone="danger">{settingsError}</Notice> : null}
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
