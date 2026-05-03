'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, eventMediaApi, type EventMediaCaptionSuggestion, type EventMediaImportJob, type EventMediaItem, type EventMediaPublicVisibility, type EventMediaSettings, type EventMediaSummary, type MediaInput } from '@/lib/api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type MediaStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED' | 'ALL';
type MediaTypeFilter = 'all' | 'image' | 'video';
type AdminMediaTab = 'media' | 'imports' | 'captions' | 'settings';
type CaptionSuggestionStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ALL';

const STATUS_FILTERS: MediaStatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'DELETED', 'ALL'];
const ADMIN_MEDIA_TABS: AdminMediaTab[] = ['media', 'imports', 'captions', 'settings'];

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
      sizes="220px"
    />
  );
}

function tabLabel(tab: AdminMediaTab, locale: string) {
  const ru: Record<AdminMediaTab, string> = {
    media: 'Медиа',
    imports: 'Импорты',
    captions: 'Предложения подписей',
    settings: 'Настройки',
  };
  const en: Record<AdminMediaTab, string> = {
    media: 'Media',
    imports: 'Imports',
    captions: 'Caption suggestions',
    settings: 'Settings',
  };
  return (locale === 'ru' ? ru : en)[tab];
}

function emptyDraft(item?: EventMediaItem): MediaInput {
  return {
    title: item?.title ?? '',
    caption: item?.caption ?? '',
    credit: item?.credit ?? '',
    altText: item?.altText ?? '',
  };
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
  const [status, setStatus] = useState<MediaStatusFilter>('PENDING');
  const [summary, setSummary] = useState<EventMediaSummary>({ total: 0, pending: 0, approved: 0, rejected: 0, deleted: 0, participant: 0, admin: 0, images: 0, videos: 0 });
  const [visibility, setVisibility] = useState<EventMediaPublicVisibility | null>(null);
  const [type, setType] = useState<MediaTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, MediaInput>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState<MediaInput>(emptyDraft());
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJobs, setImportJobs] = useState<EventMediaImportJob[]>([]);
  const [importError, setImportError] = useState('');
  const [importUploading, setImportUploading] = useState(false);
  const [importOptions, setImportOptions] = useState({
    publishMode: 'approved' as 'approved' | 'pending',
    useFilenameAsTitle: true,
    skipDuplicates: true,
    preserveFolders: false,
  });
  const [captionStatus, setCaptionStatus] = useState<CaptionSuggestionStatusFilter>('PENDING');
  const [captionSuggestions, setCaptionSuggestions] = useState<EventMediaCaptionSuggestion[]>([]);
  const [captionError, setCaptionError] = useState('');
  const [captionBusyId, setCaptionBusyId] = useState('');
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, MediaInput>>({});
  const [captionRejectReasons, setCaptionRejectReasons] = useState<Record<string, string>>({});

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
    setSummaryError('');
    try {
      const result = await eventMediaApi.summary(eventId);
      setSummary(result.summary);
    } catch (err) {
      console.error('[media-bank] summary load failed', err);
      setSummaryError(isRu ? 'Не удалось обновить счётчики медиабанка.' : 'Could not refresh media counters.');
    }
  }, [eventId, isRu]);

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

  const loadImports = useCallback(async () => {
    if (!eventId) return;
    setImportError('');
    try {
      const result = await eventMediaApi.imports.list(eventId);
      setImportJobs(result.jobs);
    } catch (err: any) {
      console.error('[media-bank] imports list failed', err);
      setImportError(getFriendlyApiErrorMessage(err, locale));
    }
  }, [eventId, locale]);

  const loadCaptionSuggestions = useCallback(async () => {
    if (!eventId) return;
    setCaptionError('');
    try {
      const result = await eventMediaApi.captionSuggestions.adminList(eventId, { status: captionStatus });
      setCaptionSuggestions(result.suggestions);
      setCaptionDrafts(Object.fromEntries(result.suggestions.map((item) => [item.id, {
        title: item.suggestedTitle ?? '',
        caption: item.suggestedCaption ?? '',
        credit: item.suggestedCredit ?? '',
        altText: item.suggestedAltText ?? '',
      }])));
      setCaptionRejectReasons(Object.fromEntries(result.suggestions.map((item) => [item.id, item.moderationReason ?? ''])));
    } catch (err: any) {
      console.error('[media-bank] caption suggestions list failed', err);
      setCaptionError(getFriendlyApiErrorMessage(err, locale));
    }
  }, [eventId, captionStatus, locale]);

  useEffect(() => {
    if (user && isAdmin) void loadEvent();
  }, [user, isAdmin, loadEvent]);

  useEffect(() => {
    if (user && isAdmin) { void loadMedia(); void loadSummary(); void loadVisibility(); }
  }, [user, isAdmin, loadMedia, loadSummary, loadVisibility]);

  useEffect(() => {
    if (user && isAdmin && activeTab === 'imports') void loadImports();
  }, [user, isAdmin, activeTab, loadImports]);

  useEffect(() => {
    if (user && isAdmin && activeTab === 'imports' && importJobs.some((job) => job.status === 'QUEUED' || job.status === 'PROCESSING')) {
      const handle = window.setInterval(() => void loadImports(), 2500);
      return () => window.clearInterval(handle);
    }
    return undefined;
  }, [user, isAdmin, activeTab, importJobs, loadImports]);

  useEffect(() => {
    if (user && isAdmin && activeTab === 'captions') void loadCaptionSuggestions();
  }, [user, isAdmin, activeTab, loadCaptionSuggestions]);

  function patchDraft(mediaId: string, key: keyof MediaInput, value: string) {
    setDrafts((current) => ({
      ...current,
      [mediaId]: { ...current[mediaId], [key]: value },
    }));
  }

  function patchSettings(key: keyof EventMediaSettings, value: boolean | number | Array<'image' | 'video'>) {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleAllowedType(kind: 'image' | 'video', checked: boolean) {
    const next = checked
      ? ([...new Set([...settingsDraft.allowedTypes, kind])] as Array<'image' | 'video'>)
      : settingsDraft.allowedTypes.filter((item): item is 'image' | 'video' => item !== kind);
    if (!checked && settingsDraft.allowedTypes.length <= 1) {
      setNotice(isRu ? 'Нужно оставить хотя бы один тип медиа: фото или видео.' : 'At least one media type must stay enabled: photos or videos.');
      return;
    }
    patchSettings('allowedTypes', next);
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      e.currentTarget.reset();
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

    setBusyId(item.id);
    setActionError('');
    setNotice('');
    try {
      await eventMediaApi.adminUpdate(eventId, item.id, {
        ...drafts[item.id],
        status: nextStatus,
        moderationNotes: nextStatus === 'REJECTED' ? reason : reason || undefined,
      });
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
      await loadVisibility();
    } catch (err: any) {
      console.error('[media-bank] settings save failed', err);
      setSettingsError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleStartImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventId || !importFile) {
      setImportError(isRu ? 'Выберите .zip архив.' : 'Choose a .zip archive.');
      return;
    }

    const formData = new FormData();
    formData.append('archive', importFile);
    formData.append('publishMode', importOptions.publishMode);
    formData.append('useFilenameAsTitle', String(importOptions.useFilenameAsTitle));
    formData.append('skipDuplicates', String(importOptions.skipDuplicates));
    formData.append('preserveFolders', String(importOptions.preserveFolders));

    setImportUploading(true);
    setImportError('');
    setNotice('');
    try {
      await eventMediaApi.imports.start(eventId, formData);
      setImportFile(null);
      e.currentTarget.reset();
      setNotice(isRu ? 'Импорт поставлен в очередь.' : 'Import job was queued.');
      await loadImports();
    } catch (err: any) {
      console.error('[media-bank] import start failed', err);
      setImportError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setImportUploading(false);
    }
  }

  function patchCaptionDraft(suggestionId: string, key: keyof MediaInput, value: string) {
    setCaptionDrafts((current) => ({
      ...current,
      [suggestionId]: { ...current[suggestionId], [key]: value },
    }));
  }

  async function handleApproveCaption(suggestion: EventMediaCaptionSuggestion) {
    if (!eventId) return;
    setCaptionBusyId(suggestion.id);
    setCaptionError('');
    setNotice('');
    try {
      await eventMediaApi.captionSuggestions.approve(eventId, suggestion.id, captionDrafts[suggestion.id] ?? {});
      setNotice(isRu ? 'Предложение подписи утверждено.' : 'Caption suggestion approved.');
      await Promise.all([loadCaptionSuggestions(), loadMedia(), loadSummary(), loadVisibility()]);
    } catch (err: any) {
      console.error('[media-bank] caption approve failed', err);
      setCaptionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setCaptionBusyId('');
    }
  }

  async function handleRejectCaption(suggestion: EventMediaCaptionSuggestion) {
    if (!eventId) return;
    const reason = captionRejectReasons[suggestion.id]?.trim() ?? '';
    if (!reason) {
      setCaptionError(isRu ? 'Причина отклонения обязательна.' : 'Rejection reason is required.');
      return;
    }

    setCaptionBusyId(suggestion.id);
    setCaptionError('');
    setNotice('');
    try {
      await eventMediaApi.captionSuggestions.reject(eventId, suggestion.id, reason);
      setNotice(isRu ? 'Предложение подписи отклонено.' : 'Caption suggestion rejected.');
      await loadCaptionSuggestions();
    } catch (err: any) {
      console.error('[media-bank] caption reject failed', err);
      setCaptionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setCaptionBusyId('');
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
            <div className="workspace-status-card"><small>{isRu ? 'На модерации' : 'Pending'}</small><strong>{summary.pending}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Опубликовано' : 'Approved'}</small><strong>{summary.approved}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Отклонено' : 'Rejected'}</small><strong>{summary.rejected}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Фотобанк' : 'Media bank'}</small><strong>{settings.enabled ? (isRu ? 'Включён' : 'Enabled') : (isRu ? 'Выключен' : 'Disabled')}</strong></div>
          </div>
          {summaryError ? <Notice tone="warning">{summaryError}</Notice> : null}

          <ToolbarRow>
            {ADMIN_MEDIA_TABS.map((item) => (
              <button
                key={item}
                type="button"
                className={`btn btn-sm ${activeTab === item ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(item)}
              >
                {tabLabel(item, locale)}
              </button>
            ))}
          </ToolbarRow>

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
                <div><small>{isRu ? 'Попадает на главную' : 'Visible on home'}</small><strong>{visibility.visibleOnPublicPages ? (isRu ? 'Да' : 'Yes') : (isRu ? 'Нет' : 'No')}</strong></div>
                <div><small>{isRu ? 'Причина' : 'Reason'}</small><strong>{visibility.reasonCode}</strong></div>
              </div>
            </Panel>
          ) : null}

          {activeTab === 'media' ? (
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
          ) : null}

          {activeTab === 'settings' ? (
          <Panel variant="elevated" className="admin-command-panel admin-media-settings-panel">
            <SectionHeader
              title={isRu ? 'Настройки фотобанка' : 'Media bank settings'}
              subtitle={isRu ? 'Видимость, премодерация и правила загрузки' : 'Visibility, moderation, and upload rules'}
            />
            <div className="admin-media-settings-grid">
              <label><input type="checkbox" checked={settingsDraft.enabled} onChange={(event) => patchSettings('enabled', event.target.checked)} /> {isRu ? 'Фотобанк включён' : 'Media bank enabled'}</label>
              <label><input type="checkbox" checked={settingsDraft.participantUploadEnabled} onChange={(event) => patchSettings('participantUploadEnabled', event.target.checked)} /> {isRu ? 'Загрузка участниками включена' : 'Participant upload enabled'}</label>
              <label><input type="checkbox" checked={settingsDraft.moderationEnabled} onChange={(event) => patchSettings('moderationEnabled', event.target.checked)} /> {isRu ? 'Премодерация включена' : 'Pre-moderation enabled'}</label>
              <label><input type="checkbox" checked={settingsDraft.showUploaderName} onChange={(event) => patchSettings('showUploaderName', event.target.checked)} /> {isRu ? 'Показывать автора / uploader' : 'Show uploader name'}</label>
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

          {activeTab === 'imports' ? (
            <Panel variant="elevated" className="admin-command-panel admin-media-imports-panel">
              <SectionHeader
                title={isRu ? 'Массовая загрузка архива' : 'Bulk archive upload'}
                subtitle={isRu ? '.zip архив обрабатывается в фоне, с прогрессом и CSV-отчётом' : '.zip archive is processed in the background with progress and CSV report'}
              />
              <form className="admin-media-import-form" onSubmit={handleStartImport}>
                <label className="media-upload-dropzone">
                  <span>{importFile ? importFile.name : (isRu ? 'Выберите .zip архив' : 'Choose .zip archive')}</span>
                  <small>{isRu ? 'До 500 MB, до 1000 файлов' : 'Up to 500 MB, up to 1000 files'}</small>
                  <input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => setImportFile(event.currentTarget.files?.[0] ?? null)} />
                </label>
                <div className="admin-media-import-options">
                  <label>
                    <span>{isRu ? 'Режим публикации' : 'Publish mode'}</span>
                    <select className="signal-field signal-select" value={importOptions.publishMode} onChange={(event) => setImportOptions((current) => ({ ...current, publishMode: event.target.value as 'approved' | 'pending' }))}>
                      <option value="approved">{isRu ? 'Сразу опубликовано' : 'Approved immediately'}</option>
                      <option value="pending">{isRu ? 'На модерацию' : 'Pending review'}</option>
                    </select>
                  </label>
                  <label><input type="checkbox" checked={importOptions.useFilenameAsTitle} onChange={(event) => setImportOptions((current) => ({ ...current, useFilenameAsTitle: event.target.checked }))} /> {isRu ? 'Использовать имя файла как название' : 'Use filename as title'}</label>
                  <label><input type="checkbox" checked={importOptions.skipDuplicates} onChange={(event) => setImportOptions((current) => ({ ...current, skipDuplicates: event.target.checked }))} /> {isRu ? 'Пропускать дубликаты' : 'Skip duplicates'}</label>
                  <label><input type="checkbox" checked={importOptions.preserveFolders} onChange={(event) => setImportOptions((current) => ({ ...current, preserveFolders: event.target.checked }))} /> {isRu ? 'Сохранять путь папок в отчёте' : 'Keep folder paths in report'}</label>
                </div>
                <ToolbarRow>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={importUploading || !importFile}>
                    {importUploading ? (isRu ? 'Ставим в очередь...' : 'Queueing...') : (isRu ? 'Начать импорт' : 'Start import')}
                  </button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => void loadImports()}>{isRu ? 'Обновить' : 'Refresh'}</button>
                </ToolbarRow>
              </form>
              {importError ? <Notice tone="danger">{importError}</Notice> : null}

              <div className="admin-media-import-list">
                {importJobs.length === 0 ? (
                  <EmptyState title={isRu ? 'Импортов пока нет' : 'No imports yet'} description={isRu ? 'После загрузки архива job появится здесь.' : 'Upload a zip archive to create an import job.'} />
                ) : importJobs.map((job) => (
                  <article className="admin-media-import-card" key={job.id}>
                    <div>
                      <strong>{job.originalFilename}</strong>
                      <div className="signal-muted">{job.status} · {formatAdminDateTime(job.createdAt, locale)}</div>
                    </div>
                    <div className="admin-media-import-progress">
                      <span>{isRu ? 'Импортировано' : 'Imported'}: {job.importedCount}</span>
                      <span>{isRu ? 'Пропущено' : 'Skipped'}: {job.skippedCount}</span>
                      <span>{isRu ? 'Ошибок' : 'Failed'}: {job.failedCount}</span>
                      <span>{isRu ? 'Дубликатов' : 'Duplicates'}: {job.duplicateCount}</span>
                    </div>
                    {job.errorMessage ? <Notice tone="danger">{job.errorMessage}</Notice> : null}
                    <ToolbarRow>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => void eventMediaApi.imports.downloadReport(String(eventId), job.id)}>{isRu ? 'CSV отчёт' : 'CSV report'}</button>
                      {job.status === 'QUEUED' || job.status === 'PROCESSING' ? (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={async () => { await eventMediaApi.imports.cancel(String(eventId), job.id); await loadImports(); }}>{isRu ? 'Отменить' : 'Cancel'}</button>
                      ) : null}
                    </ToolbarRow>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}

          {activeTab === 'captions' ? (
            <Panel variant="elevated" className="admin-command-panel admin-media-caption-panel">
              <SectionHeader
                title={isRu ? 'Предложения подписей' : 'Caption suggestions'}
                subtitle={isRu ? 'Участники предлагают подписи, админ утверждает или отклоняет с причиной' : 'Participants suggest captions; admins approve or reject with a reason'}
              />
              <ToolbarRow>
                {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as CaptionSuggestionStatusFilter[]).map((item) => (
                  <button key={item} type="button" className={`btn btn-sm ${captionStatus === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCaptionStatus(item)}>
                    {statusLabel(item as any, locale)}
                  </button>
                ))}
              </ToolbarRow>
              {captionError ? <Notice tone="danger">{captionError}</Notice> : null}
              <div className="admin-media-caption-list">
                {captionSuggestions.length === 0 ? (
                  <EmptyState title={isRu ? 'Предложений нет' : 'No suggestions'} description={isRu ? 'Новые предложения появятся здесь после отправки участниками.' : 'New participant suggestions will appear here.'} />
                ) : captionSuggestions.map((suggestion) => {
                  const draft = captionDrafts[suggestion.id] ?? {};
                  const rejectReason = captionRejectReasons[suggestion.id] ?? '';
                  const mediaItem = suggestion.media;
                  return (
                    <article className="admin-media-caption-card" key={suggestion.id}>
                      {mediaItem ? <div className="admin-media-preview">{renderPreview(mediaItem)}</div> : null}
                      <div className="admin-media-card-body">
                        <div className="admin-media-title-row">
                          <div>
                            <strong>{mediaItem ? formatMediaDisplayNumber(mediaItem, locale) : suggestion.mediaId}</strong>
                            <div className="signal-muted">{suggestion.author?.email ?? suggestion.author?.name ?? (isRu ? 'Участник' : 'Participant')}</div>
                          </div>
                          <StatusBadge tone={suggestion.status === 'APPROVED' ? 'success' : suggestion.status === 'REJECTED' ? 'danger' : 'warning'}>{suggestion.status}</StatusBadge>
                        </div>
                        <div className="admin-media-edit-grid">
                          <FieldInput value={draft.title ?? ''} onChange={(event) => patchCaptionDraft(suggestion.id, 'title', event.target.value)} maxLength={120} placeholder={isRu ? 'Название' : 'Title'} />
                          <FieldInput value={draft.credit ?? ''} onChange={(event) => patchCaptionDraft(suggestion.id, 'credit', event.target.value)} maxLength={120} placeholder="Credit" />
                          <FieldInput value={draft.altText ?? ''} onChange={(event) => patchCaptionDraft(suggestion.id, 'altText', event.target.value)} maxLength={180} placeholder="Alt text" />
                          <FieldTextarea value={draft.caption ?? ''} onChange={(event) => patchCaptionDraft(suggestion.id, 'caption', event.target.value)} maxLength={1000} rows={3} placeholder={isRu ? 'Подпись' : 'Caption'} />
                        </div>
                        {suggestion.status === 'REJECTED' && suggestion.moderationReason ? <Notice tone="danger">{suggestion.moderationReason}</Notice> : null}
                        {suggestion.status === 'PENDING' ? (
                          <>
                            <FieldTextarea
                              value={rejectReason}
                              onChange={(event) => setCaptionRejectReasons((current) => ({ ...current, [suggestion.id]: event.target.value }))}
                              maxLength={1000}
                              rows={2}
                              placeholder={isRu ? 'Причина отклонения' : 'Rejection reason'}
                            />
                            <ToolbarRow>
                              <button className="btn btn-primary btn-sm" type="button" disabled={captionBusyId === suggestion.id} onClick={() => handleApproveCaption(suggestion)}>{isRu ? 'Утвердить' : 'Approve'}</button>
                              <button className="btn btn-ghost btn-sm" type="button" disabled={captionBusyId === suggestion.id || !rejectReason.trim()} onClick={() => handleRejectCaption(suggestion)}>{isRu ? 'Отклонить' : 'Reject'}</button>
                            </ToolbarRow>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          {activeTab === 'media' ? (
          <Panel variant="elevated" className="admin-command-panel admin-media-board-panel">
            <SectionHeader
              title={isRu ? 'Очередь и история' : 'Queue and history'}
              subtitle={isRu ? 'Автор, подписи, статусы и действия модерации' : 'Uploader, captions, statuses, and moderation actions'}
            />
            <div className="admin-media-filters">
              <ToolbarRow>
                {STATUS_FILTERS.map((item) => (
                  <button key={item} type="button" className={`btn btn-sm ${status === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(item)}>
                    {statusLabel(item, locale)}
                  </button>
                ))}
              </ToolbarRow>
              <ToolbarRow>
                {(['all', 'image', 'video'] as MediaTypeFilter[]).map((item) => (
                  <button key={item} type="button" className={`btn btn-sm ${type === item ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setType(item)}>
                    {item === 'all' ? (isRu ? 'Все типы' : 'All types') : item === 'image' ? (isRu ? 'Фото' : 'Photos') : (isRu ? 'Видео' : 'Videos')}
                  </button>
                ))}
                <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск по автору, подписи, файлу' : 'Search author, caption, file'} />
              </ToolbarRow>
            </div>

            {listError ? <Notice tone="danger">{listError}</Notice> : null}
            {actionError ? <Notice tone="danger">{actionError}</Notice> : null}

            {mediaLoading ? (
              <LoadingLines rows={6} />
            ) : media.length === 0 ? (
              <EmptyState
                title={isRu ? 'Нет материалов' : 'No media'}
                description={isRu ? 'В выбранном фильтре ничего нет.' : 'Nothing matches the selected filter.'}
              />
            ) : (
              <div className="admin-media-card-list">
                {media.map((item) => {
                  const draft = drafts[item.id] ?? emptyDraft(item);
                  const rejectReason = rejectReasons[item.id] ?? '';
                  return (
                    <article className="admin-media-card" key={item.id}>
                      <div className="admin-media-preview">{renderPreview(item)}</div>
                      <div className="admin-media-card-body">
                        <div className="admin-media-title-row">
                          <div>
                            <strong>{item.title || item.asset.originalFilename}</strong>
                            <div className="signal-muted">
                              {formatMediaDisplayNumber(item, locale)}
                              {' · '}
                              {item.source === 'ADMIN' ? (isRu ? 'Организатор' : 'Organizer') : (isRu ? 'Участник' : 'Participant')}
                              {item.uploader?.email ? ` · ${item.uploader.email}` : ''}
                            </div>
                          </div>
                          <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, locale)}</StatusBadge>
                        </div>

                        <div className="admin-media-edit-grid">
                          <FieldInput value={draft.title ?? ''} onChange={(event) => patchDraft(item.id, 'title', event.target.value)} maxLength={120} placeholder={isRu ? 'Название' : 'Title'} />
                          <FieldInput value={draft.credit ?? ''} onChange={(event) => patchDraft(item.id, 'credit', event.target.value)} maxLength={120} placeholder="Credit" />
                          <FieldInput value={draft.altText ?? ''} onChange={(event) => patchDraft(item.id, 'altText', event.target.value)} maxLength={180} placeholder="Alt text" />
                          <FieldTextarea value={draft.caption ?? ''} onChange={(event) => patchDraft(item.id, 'caption', event.target.value)} maxLength={1000} rows={3} placeholder={isRu ? 'Подпись' : 'Caption'} />
                        </div>

                        <div className="admin-media-decision-grid">
                          <FieldTextarea
                            value={rejectReason}
                            onChange={(event) => setRejectReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                            maxLength={1000}
                            rows={2}
                            placeholder={isRu ? 'Причина отклонения или комментарий модератора' : 'Rejection reason or moderator note'}
                          />
                          <div className="admin-media-meta-line">
                            <span>{isRu ? 'Отправлено' : 'Submitted'}: {formatAdminDateTime(item.createdAt, locale)}</span>
                            {item.approvedAt ? <span>{isRu ? 'Решение' : 'Decision'}: {formatAdminDateTime(item.approvedAt, locale)}</span> : null}
                            {item.rejectedAt ? <span>{isRu ? 'Решение' : 'Decision'}: {formatAdminDateTime(item.rejectedAt, locale)}</span> : null}
                          </div>
                        </div>

                        <details className="media-history-details">
                          <summary>{isRu ? 'История' : 'History'}</summary>
                          <div className="media-history-timeline">
                            {(item.history ?? []).map((entry) => (
                              <div className="media-history-entry" key={entry.id}>
                                <strong>{entry.action}</strong>
                                <span>{formatAdminDateTime(entry.createdAt, locale)}{entry.actor?.email ? ` · ${entry.actor.email}` : ''}</span>
                                {entry.reason ? <p>{entry.reason}</p> : null}
                              </div>
                            ))}
                          </div>
                        </details>

                        <ToolbarRow>
                          <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleUpdate(item)}>
                            {isRu ? 'Сохранить подписи' : 'Save captions'}
                          </button>
                          <button className="btn btn-primary btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleUpdate(item, 'APPROVED')}>
                            {isRu ? 'Утвердить' : 'Approve'}
                          </button>
                          <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === item.id || !rejectReason.trim()} onClick={() => handleUpdate(item, 'REJECTED')}>
                            {isRu ? 'Отклонить' : 'Reject'}
                          </button>
                          <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === item.id} onClick={() => handleDelete(item)}>
                            {isRu ? 'Удалить / скрыть' : 'Delete / hide'}
                          </button>
                        </ToolbarRow>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
