'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { mediaBankAdminApi } from '@/lib/media-bank-admin-api';
import { adminMediaAlbumsApi, type EventMediaAlbum } from '@/lib/media-albums-api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { formatMediaDisplayNumber } from '@/components/media/MediaCard';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';
import { AdminMediaBulkUploadPanel } from '@/components/admin/media/AdminMediaBulkUploadPanel';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type MediaStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED' | 'ALL';
type MediaTypeFilter = 'all' | 'image' | 'video';
type AdminMediaTab = 'media' | 'bulk' | 'settings';
type AlbumFilter = 'ALL' | 'UNASSIGNED' | string;
type MediaEditorDraft = MediaInput & {
  capturedAt?: string;
  groupTitle?: string;
  downloadEnabled?: boolean;
};
type BulkField = 'title' | 'caption' | 'credit' | 'altText' | 'groupTitle' | 'capturedAt' | 'downloadEnabled';

const STATUS_FILTERS: MediaStatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'DELETED', 'ALL'];
const TYPE_FILTERS: MediaTypeFilter[] = ['all', 'image', 'video'];
const BULK_FIELDS: BulkField[] = ['title', 'caption', 'credit', 'altText', 'groupTitle', 'capturedAt', 'downloadEnabled'];
const ADMIN_PAGE_SIZE = 80;

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

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toApiDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyDraft(item?: EventMediaItem): MediaEditorDraft {
  return {
    title: item?.title ?? '',
    caption: item?.caption ?? '',
    credit: item?.credit ?? '',
    altText: item?.altText ?? '',
    groupTitle: item?.groupTitle ?? '',
    capturedAt: toDateTimeLocal(item?.capturedAt),
    downloadEnabled: item?.downloadEnabled ?? true,
  };
}

function emptyBulkDraft(): MediaEditorDraft {
  return {
    title: '',
    caption: '',
    credit: '',
    altText: '',
    groupTitle: '',
    capturedAt: '',
    downloadEnabled: true,
  };
}

function defaultBulkApply(): Record<BulkField, boolean> {
  return Object.fromEntries(BULK_FIELDS.map((field) => [field, false])) as Record<BulkField, boolean>;
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

function bulkFieldLabel(field: BulkField, isRu: boolean) {
  const ru: Record<BulkField, string> = {
    title: 'Название',
    caption: 'Описание',
    credit: 'Автор / credit',
    altText: 'Alt text',
    groupTitle: 'Группа / метка',
    capturedAt: 'Дата съёмки',
    downloadEnabled: 'Скачивание',
  };
  const en: Record<BulkField, string> = {
    title: 'Title',
    caption: 'Description',
    credit: 'Author / credit',
    altText: 'Alt text',
    groupTitle: 'Group / tag',
    capturedAt: 'Captured at',
    downloadEnabled: 'Download',
  };
  return (isRu ? ru : en)[field];
}

function statusTone(status: EventMediaItem['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function itemTitle(item: EventMediaItem, locale: string) {
  return item.title
    || item.caption
    || item.asset.originalFilename
    || (locale === 'ru' ? 'Материал фотобанка' : 'Media item');
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || !Number.isFinite(bytes)) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatMediaDate(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildPatchFromDraft(draft: MediaEditorDraft): AdminMediaUpdate {
  return {
    title: draft.title ?? '',
    caption: draft.caption ?? '',
    credit: draft.credit ?? '',
    altText: draft.altText ?? '',
    groupTitle: draft.groupTitle ?? '',
    capturedAt: toApiDateTime(draft.capturedAt),
    downloadEnabled: Boolean(draft.downloadEnabled),
  };
}

function albumFilterLabel(filter: AlbumFilter, albums: EventMediaAlbum[], isRu: boolean) {
  if (filter === 'ALL') return isRu ? 'Все альбомы' : 'All albums';
  if (filter === 'UNASSIGNED') return isRu ? 'Без альбома' : 'Unassigned';
  return albums.find((album) => album.id === filter)?.title ?? filter;
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
  const [albums, setAlbums] = useState<EventMediaAlbum[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<EventMediaSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<EventMediaSummary>({ total: 0, activeTotal: 0, pending: 0, approved: 0, rejected: 0, deleted: 0, participant: 0, admin: 0, images: 0, videos: 0 });
  const [mediaMeta, setMediaMeta] = useState({ total: 0, page: 1, limit: ADMIN_PAGE_SIZE, pages: 0 });
  const [visibility, setVisibility] = useState<EventMediaPublicVisibility | null>(null);
  const [status, setStatus] = useState<MediaStatusFilter>('PENDING');
  const [type, setType] = useState<MediaTypeFilter>('all');
  const [albumFilter, setAlbumFilter] = useState<AlbumFilter>('ALL');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, MediaEditorDraft>>({});
  const [albumTargets, setAlbumTargets] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [activeMediaId, setActiveMediaId] = useState('');
  const [viewerMediaId, setViewerMediaId] = useState('');
  const [bulkDraft, setBulkDraft] = useState<MediaEditorDraft>(emptyBulkDraft);
  const [bulkApply, setBulkApply] = useState<Record<BulkField, boolean>>(defaultBulkApply);
  const [bulkAlbumId, setBulkAlbumId] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState<MediaEditorDraft>(emptyDraft());
  const [pageLoading, setPageLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [listError, setListError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedMedia = useMemo(
    () => media.filter((item) => selectedMediaIds.includes(item.id)),
    [media, selectedMediaIds],
  );
  const activeMedia = useMemo(
    () => media.find((item) => item.id === activeMediaId) ?? selectedMedia[0] ?? null,
    [activeMediaId, media, selectedMedia],
  );
  const viewerIndex = useMemo(
    () => media.findIndex((item) => item.id === viewerMediaId),
    [media, viewerMediaId],
  );
  const viewerMedia = viewerIndex >= 0 ? media[viewerIndex] : null;
  const selectedCount = selectedMediaIds.length;

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

  const loadAlbums = useCallback(async () => {
    if (!eventId) return;
    try {
      const result = await adminMediaAlbumsApi.list(eventId);
      setAlbums(result.albums);
      setBulkAlbumId((current) => current && result.albums.some((album) => album.id === current) ? current : '');
    } catch (err) {
      console.error('[media-bank] albums load failed', err);
      setAlbums([]);
    }
  }, [eventId]);

  const loadMedia = useCallback(async (nextPage = 1) => {
    if (!eventId) return;
    setMediaLoading(true);
    setListError('');
    try {
      const result = await eventMediaApi.adminList(eventId, {
        status,
        type,
        search,
        albumId: albumFilter === 'ALL' ? undefined : albumFilter,
        page: nextPage,
        limit: ADMIN_PAGE_SIZE,
      });
      const visibleIds = new Set(result.media.map((item) => item.id));
      setMedia(result.media);
      setMediaMeta(result.meta);
      setDrafts(Object.fromEntries(result.media.map((item) => [item.id, emptyDraft(item)])));
      setAlbumTargets(Object.fromEntries(result.media.map((item) => [item.id, item.albumId ?? ''])));
      setRejectReasons(Object.fromEntries(result.media.map((item) => [item.id, item.moderationNotes ?? ''])));
      setSelectedMediaIds((current) => current.filter((id) => visibleIds.has(id)));
      setActiveMediaId((current) => current && visibleIds.has(current) ? current : result.media[0]?.id ?? '');
    } catch (err: any) {
      console.error('[media-bank] media list failed', err);
      setListError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setMediaLoading(false);
    }
  }, [albumFilter, eventId, locale, search, status, type]);

  const refreshMediaState = useCallback(async (nextPage = 1) => {
    await Promise.all([loadMedia(nextPage), loadAlbums(), loadSummary(), loadVisibility()]);
  }, [loadAlbums, loadMedia, loadSummary, loadVisibility]);

  useEffect(() => {
    if (user && isAdmin) void loadEvent();
  }, [user, isAdmin, loadEvent]);

  useEffect(() => {
    if (user && isAdmin) void refreshMediaState();
  }, [user, isAdmin, refreshMediaState]);

  const openViewerAt = useCallback((index: number) => {
    if (!media.length) return;
    const nextIndex = (index + media.length) % media.length;
    setViewerMediaId(media[nextIndex]?.id ?? '');
  }, [media]);

  useEffect(() => {
    if (!viewerMedia) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setViewerMediaId('');
      if (event.key === 'ArrowLeft') openViewerAt(viewerIndex - 1);
      if (event.key === 'ArrowRight') openViewerAt(viewerIndex + 1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openViewerAt, viewerIndex, viewerMedia]);

  function patchDraft(mediaId: string, key: keyof MediaEditorDraft, value: string | boolean) {
    setDrafts((current) => ({ ...current, [mediaId]: { ...current[mediaId], [key]: value } }));
  }

  function patchBulkDraft(key: keyof MediaEditorDraft, value: string | boolean) {
    setBulkDraft((current) => ({ ...current, [key]: value }));
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

  function toggleMedia(id: string) {
    setSelectedMediaIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      if (!current.includes(id)) setActiveMediaId(id);
      if (activeMediaId === id && current.includes(id)) setActiveMediaId(next[0] ?? '');
      return next;
    });
  }

  function selectAllVisible() {
    const ids = media.map((item) => item.id);
    setSelectedMediaIds(ids);
    setActiveMediaId(ids[0] ?? '');
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
      await eventMediaApi.adminUpload(eventId, uploadFile, buildPatchFromDraft(uploadDraft));
      setUploadFile(null);
      setUploadDraft(emptyDraft());
      form.reset();
      setNotice(isRu ? 'Медиа от организатора опубликовано.' : 'Organizer media was published.');
      await refreshMediaState();
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
      ...buildPatchFromDraft(drafts[item.id] ?? emptyDraft(item)),
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
        : (isRu ? 'Карточка сохранена.' : 'Media card saved.'));
      await refreshMediaState(mediaMeta.page);
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
      await refreshMediaState(mediaMeta.page);
    } catch (err: any) {
      console.error('[media-bank] media delete failed', err);
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function handleSingleAlbumChange(item: EventMediaItem) {
    if (!eventId) return;
    const albumId = albumTargets[item.id] || null;
    setBusyId(item.id);
    setActionError('');
    setNotice('');
    try {
      if (albumId) {
        await adminMediaAlbumsApi.assignMedia(eventId, albumId, [item.id]);
      } else {
        await adminMediaAlbumsApi.unassignMedia(eventId, [item.id]);
      }
      setNotice(isRu ? 'Альбом обновлён.' : 'Album updated.');
      await refreshMediaState(mediaMeta.page);
    } catch (err: any) {
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function handleBulkMetadata() {
    if (!eventId || selectedCount === 0) return;
    const patch: AdminMediaUpdate = {};
    for (const field of BULK_FIELDS) {
      if (!bulkApply[field]) continue;
      if (field === 'capturedAt') patch.capturedAt = toApiDateTime(bulkDraft.capturedAt);
      else if (field === 'downloadEnabled') patch.downloadEnabled = Boolean(bulkDraft.downloadEnabled);
      else (patch as any)[field] = bulkDraft[field] ?? '';
    }

    if (Object.keys(patch).length === 0) {
      setActionError(isRu ? 'Выберите поля, которые нужно изменить.' : 'Choose fields to update.');
      return;
    }

    setBulkBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await mediaBankAdminApi.bulkUpdateMedia(eventId, selectedMediaIds, patch);
      setNotice(isRu ? `Обновлено карточек: ${result.updatedCount}.` : `Updated cards: ${result.updatedCount}.`);
      setBulkApply(defaultBulkApply());
      await refreshMediaState(mediaMeta.page);
    } catch (err: any) {
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkStatus(nextStatus: EventMediaItem['status']) {
    if (!eventId || selectedCount === 0) return;
    const reason = bulkReason.trim();
    if (nextStatus === 'REJECTED' && !reason) {
      setActionError(isRu ? 'Для массового отклонения нужна причина.' : 'Bulk rejection needs a reason.');
      return;
    }

    setBulkBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await mediaBankAdminApi.bulkUpdateMedia(eventId, selectedMediaIds, {
        status: nextStatus,
        moderationNotes: nextStatus === 'REJECTED' ? reason : reason || undefined,
      });
      setNotice(isRu ? `Статус обновлён у ${result.updatedCount} карточек.` : `Status updated for ${result.updatedCount} cards.`);
      await refreshMediaState(mediaMeta.page);
    } catch (err: any) {
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBulkBusy(false);
    }
  }

  async function moveSelectedToAlbum(albumId: string | null) {
    if (!eventId || selectedCount === 0) return;
    setBulkBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = albumId
        ? await adminMediaAlbumsApi.assignMedia(eventId, albumId, selectedMediaIds)
        : await adminMediaAlbumsApi.unassignMedia(eventId, selectedMediaIds);
      setNotice(albumId
        ? (isRu ? `Перемещено в альбом: ${result.movedCount}.` : `Moved to album: ${result.movedCount}.`)
        : (isRu ? `Убрано из альбомов: ${result.movedCount}.` : `Removed from albums: ${result.movedCount}.`));
      await refreshMediaState(mediaMeta.page);
    } catch (err: any) {
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBulkBusy(false);
    }
  }

  async function setActiveAsCover() {
    if (!eventId || !activeMedia || !bulkAlbumId) return;
    setBulkBusy(true);
    setActionError('');
    setNotice('');
    try {
      await adminMediaAlbumsApi.update(eventId, bulkAlbumId, { coverMediaId: activeMedia.id });
      setNotice(isRu ? 'Обложка альбома обновлена.' : 'Album cover updated.');
      await loadAlbums();
    } catch (err: any) {
      setActionError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleSaveSettings() {
    if (!eventId) return;
    setSavingSettings(true);
    setSettingsError('');
    setNotice('');
    try {
      const result = await eventMediaApi.updateSettings(eventId, settingsDraft);
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
        subtitle={event ? `${event.title} · ${statusLabel(status, locale)} · ${albumFilterLabel(albumFilter, albums, isRu)}` : undefined}
      />

      {pageError ? <Notice tone="danger">{pageError}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {pageLoading ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <>
          <div className="workspace-status-strip workspace-status-strip-v2">
            <div className="workspace-status-card"><small>{isRu ? 'Всего' : 'Total'}</small><strong>{summary.activeTotal}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'На модерации' : 'Pending'}</small><strong>{summary.pending}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Опубликовано' : 'Approved'}</small><strong>{summary.approved}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Фото' : 'Photos'}</small><strong>{summary.images}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Видео' : 'Videos'}</small><strong>{summary.videos}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Альбомов' : 'Albums'}</small><strong>{albums.length}</strong></div>
          </div>

          <ToolbarRow>
            <button type="button" className={`btn btn-sm ${activeTab === 'media' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('media')}>
              {isRu ? 'Медиа' : 'Media'}
            </button>
            <button type="button" className={`btn btn-sm ${activeTab === 'bulk' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('bulk')}>
              {isRu ? 'Загрузка' : 'Upload'}
            </button>
            <button type="button" className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('settings')}>
              {isRu ? 'Настройки' : 'Settings'}
            </button>
          </ToolbarRow>

          {activeTab === 'bulk' ? (
            <>
              <Panel variant="elevated" className="admin-command-panel admin-media-upload-panel">
                <SectionHeader
                  title={isRu ? 'Загрузить один файл' : 'Upload one file'}
                  subtitle={isRu ? 'Для больших наборов используйте ZIP ниже.' : 'Use ZIP below for larger sets.'}
                />
                <form className="admin-media-upload-form" onSubmit={handleUpload}>
                  <label className="media-upload-dropzone">
                    <span>{uploadFile ? uploadFile.name : (isRu ? 'Файл фото или видео' : 'Photo or video file')}</span>
                    <small>{isRu ? 'image/* или video/*' : 'image/* or video/*'}</small>
                    <input type="file" accept="image/*,video/*" onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)} />
                  </label>
                  <FieldInput value={uploadDraft.title ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, title: event.target.value }))} maxLength={120} placeholder={isRu ? 'Название' : 'Title'} />
                  <FieldInput value={uploadDraft.credit ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, credit: event.target.value }))} maxLength={120} placeholder={isRu ? 'Автор / credit' : 'Author / credit'} />
                  <FieldInput value={uploadDraft.groupTitle ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, groupTitle: event.target.value }))} maxLength={120} placeholder={isRu ? 'Группа / метка' : 'Group / tag'} />
                  <FieldInput value={uploadDraft.capturedAt ?? ''} type="datetime-local" onChange={(event) => setUploadDraft((current) => ({ ...current, capturedAt: event.target.value }))} />
                  <FieldInput value={uploadDraft.altText ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, altText: event.target.value }))} maxLength={180} placeholder="Alt text" />
                  <FieldTextarea value={uploadDraft.caption ?? ''} onChange={(event) => setUploadDraft((current) => ({ ...current, caption: event.target.value }))} maxLength={1000} rows={3} placeholder={isRu ? 'Описание' : 'Description'} />
                  <button className="btn btn-primary btn-sm" type="submit" disabled={uploading || !uploadFile}>
                    {uploading ? (isRu ? 'Публикуем...' : 'Publishing...') : (isRu ? 'Опубликовать' : 'Publish')}
                  </button>
                </form>
                {uploadError ? <Notice tone="danger">{uploadError}</Notice> : null}
              </Panel>
              <AdminMediaBulkUploadPanel eventId={eventId} locale={locale} onDone={refreshMediaState} />
            </>
          ) : null}

          {activeTab === 'media' ? (
            <div className="admin-media-workbench">
              <Panel variant="elevated" className="admin-command-panel admin-media-list-panel">
                <SectionHeader
                  title={isRu ? 'Материалы фотобанка' : 'Media bank items'}
                  subtitle={isRu
                    ? `Показано ${media.length} из ${mediaMeta.total} · выбрано ${selectedCount}`
                    : `Showing ${media.length} of ${mediaMeta.total} · selected ${selectedCount}`}
                />
                {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
                {listError ? <Notice tone="danger">{listError}</Notice> : null}

                <div className="admin-media-filterbar">
                  <div className="admin-media-filter-group">
                    {STATUS_FILTERS.map((item) => (
                      <button key={item} type="button" className={`btn btn-sm ${status === item ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(item)}>
                        {statusLabel(item, locale)}
                      </button>
                    ))}
                  </div>
                  <div className="admin-media-filter-group">
                    {TYPE_FILTERS.map((item) => (
                      <button key={item} type="button" className={`btn btn-sm ${type === item ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setType(item)}>
                        {typeLabel(item, locale)}
                      </button>
                    ))}
                  </div>
                  <select className="signal-field signal-select" value={albumFilter} onChange={(event) => setAlbumFilter(event.target.value as AlbumFilter)}>
                    <option value="ALL">{isRu ? 'Все альбомы' : 'All albums'}</option>
                    <option value="UNASSIGNED">{isRu ? 'Без альбома' : 'Unassigned'}</option>
                    {albums.map((album) => <option key={album.id} value={album.id}>{album.title} ({album.mediaCount})</option>)}
                  </select>
                  <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск по названию, автору, альбому' : 'Search title, author, album'} />
                  <div className="admin-media-filter-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible} disabled={!media.length}>{isRu ? 'Выбрать видимые' : 'Select visible'}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedMediaIds([])} disabled={!selectedCount}>{isRu ? 'Снять выбор' : 'Clear'}</button>
                  </div>
                </div>

                <div className="admin-media-pagination">
                  <span>
                    {isRu
                      ? `Показано ${media.length} из ${mediaMeta.total}. Страница ${mediaMeta.page} из ${mediaMeta.pages || 1}`
                      : `Showing ${media.length} of ${mediaMeta.total}. Page ${mediaMeta.page} of ${mediaMeta.pages || 1}`}
                  </span>
                  <div className="admin-media-pagination-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={mediaLoading || mediaMeta.page <= 1}
                      onClick={() => void loadMedia(mediaMeta.page - 1)}
                    >
                      {isRu ? 'Назад' : 'Previous'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={mediaLoading || mediaMeta.page >= mediaMeta.pages}
                      onClick={() => void loadMedia(mediaMeta.page + 1)}
                    >
                      {isRu ? 'Вперёд' : 'Next'}
                    </button>
                  </div>
                </div>

                {mediaLoading ? <LoadingLines rows={8} /> : media.length === 0 ? (
                  <EmptyState title={isRu ? 'Материалов нет' : 'No media yet'} description={isRu ? 'Загрузите первый файл или измените фильтры.' : 'Upload the first file or change filters.'} />
                ) : (
                  <div className="admin-media-tile-grid">
                    {media.map((item, index) => {
                      const selected = selectedMediaIds.includes(item.id);
                      const active = activeMedia?.id === item.id;
                      const title = itemTitle(item, locale);
                      return (
                        <article className={`admin-media-tile ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`} key={item.id}>
                          <div className="admin-media-tile-preview">
                            <MediaPreview
                              publicUrl={item.asset.publicUrl}
                              storageKey={item.asset.storageKey}
                              kind={item.kind}
                              alt={item.altText || title}
                              sizes="(max-width: 720px) 50vw, 180px"
                              controls={false}
                              objectFit="contain"
                              onOpen={() => openViewerAt(index)}
                            />
                            <label className="admin-media-tile-check" onClick={(event) => event.stopPropagation()}>
                              <input type="checkbox" checked={selected} onChange={() => toggleMedia(item.id)} />
                            </label>
                            <button type="button" className="admin-media-tile-open" onClick={() => openViewerAt(index)}>
                              {item.kind === 'video' ? (isRu ? 'Видео' : 'Video') : (isRu ? 'Фото' : 'Photo')}
                            </button>
                          </div>
                          <button type="button" className="admin-media-tile-body" onClick={() => setActiveMediaId(item.id)}>
                            <span>{formatMediaDisplayNumber(item, locale)}</span>
                            <strong title={title}>{title}</strong>
                            <small>{item.album?.title || item.groupTitle || (isRu ? 'Без альбома' : 'Unassigned')}</small>
                            <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, locale)}</StatusBadge>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel variant="elevated" className="admin-command-panel admin-media-inspector">
                {selectedCount > 1 ? (
                  <>
                    <SectionHeader
                      title={isRu ? 'Массовые действия' : 'Bulk actions'}
                      subtitle={isRu ? `Выбрано карточек: ${selectedCount}` : `Selected cards: ${selectedCount}`}
                    />
                    <p className="signal-muted admin-media-bulk-page-note">
                      {isRu
                        ? 'Массовые действия применяются к выбранным материалам на текущей странице.'
                        : 'Bulk actions apply to selected media on the current page.'}
                    </p>
                    <div className="admin-media-bulk-box">
                      <div className="admin-media-bulk-status">
                        <button type="button" className="btn btn-secondary btn-sm" disabled={bulkBusy} onClick={() => void handleBulkStatus('APPROVED')}>{isRu ? 'Одобрить' : 'Approve'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => void handleBulkStatus('PENDING')}>{isRu ? 'Вернуть на модерацию' : 'Move to pending'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => void handleBulkStatus('REJECTED')}>{isRu ? 'Отклонить' : 'Reject'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => void handleBulkStatus('DELETED')}>{isRu ? 'Удалить' : 'Delete'}</button>
                      </div>
                      <FieldTextarea value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} rows={2} maxLength={1000} placeholder={isRu ? 'Причина для отклонения / заметка' : 'Rejection reason / note'} />
                    </div>

                    <div className="admin-media-bulk-box">
                      <select className="signal-field signal-select" value={bulkAlbumId} onChange={(event) => setBulkAlbumId(event.target.value)}>
                        <option value="">{isRu ? 'Выберите альбом' : 'Choose album'}</option>
                        {albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                      </select>
                      <ToolbarRow>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={bulkBusy || !bulkAlbumId} onClick={() => void moveSelectedToAlbum(bulkAlbumId)}>{isRu ? 'Переместить выбранные' : 'Move selected'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => void moveSelectedToAlbum(null)}>{isRu ? 'Убрать из альбомов' : 'Remove from albums'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={bulkBusy || !bulkAlbumId || !activeMedia} onClick={() => void setActiveAsCover()}>{isRu ? 'Активную сделать обложкой' : 'Set active as cover'}</button>
                      </ToolbarRow>
                    </div>

                    <div className="admin-media-bulk-fields">
                      {BULK_FIELDS.map((field) => (
                        <label key={field} className="admin-media-bulk-field">
                          <span><input type="checkbox" checked={bulkApply[field]} onChange={(event) => setBulkApply((current) => ({ ...current, [field]: event.target.checked }))} /> {bulkFieldLabel(field, isRu)}</span>
                          {field === 'caption' ? (
                            <FieldTextarea value={bulkDraft.caption ?? ''} onChange={(event) => patchBulkDraft(field, event.target.value)} rows={3} disabled={!bulkApply[field]} />
                          ) : field === 'capturedAt' ? (
                            <FieldInput type="datetime-local" value={bulkDraft.capturedAt ?? ''} onChange={(event) => patchBulkDraft(field, event.target.value)} disabled={!bulkApply[field]} />
                          ) : field === 'downloadEnabled' ? (
                            <select className="signal-field signal-select" value={bulkDraft.downloadEnabled ? 'true' : 'false'} onChange={(event) => patchBulkDraft(field, event.target.value === 'true')} disabled={!bulkApply[field]}>
                              <option value="true">{isRu ? 'Разрешить' : 'Allow'}</option>
                              <option value="false">{isRu ? 'Запретить' : 'Disallow'}</option>
                            </select>
                          ) : (
                            <FieldInput value={String(bulkDraft[field] ?? '')} onChange={(event) => patchBulkDraft(field, event.target.value)} disabled={!bulkApply[field]} />
                          )}
                        </label>
                      ))}
                      <button type="button" className="btn btn-secondary btn-sm" disabled={bulkBusy} onClick={() => void handleBulkMetadata()}>{isRu ? 'Применить метаданные' : 'Apply metadata'}</button>
                    </div>
                  </>
                ) : activeMedia ? (
                  <>
                    <SectionHeader
                      title={isRu ? 'Редактирование карточки' : 'Edit media card'}
                      subtitle={formatMediaDisplayNumber(activeMedia, locale)}
                    />
                    <div className="admin-media-inspector-preview">
                      <MediaPreview
                        publicUrl={activeMedia.asset.publicUrl}
                        storageKey={activeMedia.asset.storageKey}
                        kind={activeMedia.kind}
                        alt={activeMedia.altText || itemTitle(activeMedia, locale)}
                        sizes="360px"
                        controls={false}
                        objectFit="contain"
                        onOpen={() => openViewerAt(Math.max(0, media.findIndex((item) => item.id === activeMedia.id)))}
                      />
                    </div>
                    <div className="admin-media-inspector-meta">
                      <StatusBadge tone={statusTone(activeMedia.status)}>{statusLabel(activeMedia.status, locale)}</StatusBadge>
                      <span>{activeMedia.asset.originalFilename}</span>
                      <span>{formatFileSize(activeMedia.asset.sizeBytes)}</span>
                      {formatMediaDate(activeMedia.capturedAt ?? activeMedia.createdAt, locale) ? <span>{formatMediaDate(activeMedia.capturedAt ?? activeMedia.createdAt, locale)}</span> : null}
                    </div>
                    <FieldInput value={drafts[activeMedia.id]?.title ?? ''} onChange={(event) => patchDraft(activeMedia.id, 'title', event.target.value)} maxLength={120} placeholder={isRu ? 'Название' : 'Title'} />
                    <FieldInput value={drafts[activeMedia.id]?.credit ?? ''} onChange={(event) => patchDraft(activeMedia.id, 'credit', event.target.value)} maxLength={120} placeholder={isRu ? 'Автор / credit' : 'Author / credit'} />
                    <FieldInput value={drafts[activeMedia.id]?.groupTitle ?? ''} onChange={(event) => patchDraft(activeMedia.id, 'groupTitle', event.target.value)} maxLength={120} placeholder={isRu ? 'Группа / метка' : 'Group / tag'} />
                    <FieldInput value={drafts[activeMedia.id]?.capturedAt ?? ''} type="datetime-local" onChange={(event) => patchDraft(activeMedia.id, 'capturedAt', event.target.value)} />
                    <FieldInput value={drafts[activeMedia.id]?.altText ?? ''} onChange={(event) => patchDraft(activeMedia.id, 'altText', event.target.value)} maxLength={180} placeholder="Alt text" />
                    <FieldTextarea value={drafts[activeMedia.id]?.caption ?? ''} onChange={(event) => patchDraft(activeMedia.id, 'caption', event.target.value)} rows={4} maxLength={1000} placeholder={isRu ? 'Описание' : 'Description'} />
                    <label className="signal-muted"><input type="checkbox" checked={drafts[activeMedia.id]?.downloadEnabled ?? true} onChange={(event) => patchDraft(activeMedia.id, 'downloadEnabled', event.target.checked)} /> {isRu ? 'Разрешить скачивание' : 'Allow download'}</label>
                    <div className="admin-media-album-editor">
                      <select className="signal-field signal-select" value={albumTargets[activeMedia.id] ?? ''} onChange={(event) => setAlbumTargets((current) => ({ ...current, [activeMedia.id]: event.target.value }))}>
                        <option value="">{isRu ? 'Без альбома' : 'No album'}</option>
                        {albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                      </select>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === activeMedia.id} onClick={() => void handleSingleAlbumChange(activeMedia)}>{isRu ? 'Обновить альбом' : 'Update album'}</button>
                    </div>
                    <FieldTextarea value={rejectReasons[activeMedia.id] ?? ''} onChange={(event) => setRejectReasons((current) => ({ ...current, [activeMedia.id]: event.target.value }))} rows={2} maxLength={1000} placeholder={isRu ? 'Причина / заметка модератора' : 'Rejection reason / moderator note'} />
                    <div className="admin-event-media-actions">
                      <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === activeMedia.id} onClick={() => void handleUpdate(activeMedia)}>{isRu ? 'Сохранить' : 'Save'}</button>
                      <button className="btn btn-secondary btn-sm" type="button" disabled={busyId === activeMedia.id} onClick={() => void handleUpdate(activeMedia, 'APPROVED')}>{isRu ? 'Одобрить' : 'Approve'}</button>
                      <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === activeMedia.id} onClick={() => void handleUpdate(activeMedia, 'REJECTED')}>{isRu ? 'Отклонить' : 'Reject'}</button>
                      <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === activeMedia.id} onClick={() => void handleDelete(activeMedia)}>{isRu ? 'Удалить' : 'Delete'}</button>
                    </div>
                  </>
                ) : (
                  <EmptyState title={isRu ? 'Выберите карточку' : 'Select a card'} description={isRu ? 'Редактирование и настройки появятся здесь после выбора медиа.' : 'Editing and settings appear here after you select media.'} />
                )}
              </Panel>
            </div>
          ) : null}

          {activeTab === 'settings' ? (
            <>
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
                  <button className="btn btn-secondary btn-sm" type="button" disabled={savingSettings} onClick={() => void handleSaveSettings()}>
                    {savingSettings ? (isRu ? 'Сохраняем...' : 'Saving...') : (isRu ? 'Сохранить настройки' : 'Save settings')}
                  </button>
                </ToolbarRow>
                {settingsError ? <Notice tone="danger">{settingsError}</Notice> : null}
              </Panel>
            </>
          ) : null}

          {viewerMedia ? (
            <div className="media-bank-viewer admin-media-viewer" role="dialog" aria-modal="true" aria-label={itemTitle(viewerMedia, locale)}>
              <button className="media-bank-viewer-backdrop" type="button" onClick={() => setViewerMediaId('')} aria-label={isRu ? 'Закрыть' : 'Close'} />
              <div className="media-bank-viewer-dialog admin-media-viewer-dialog">
                <div className="admin-media-viewer-toolbar">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => openViewerAt(viewerIndex - 1)}>{isRu ? 'Назад' : 'Prev'}</button>
                  <span>{viewerIndex + 1} / {media.length}</span>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => openViewerAt(viewerIndex + 1)}>{isRu ? 'Далее' : 'Next'}</button>
                  <button className="media-bank-viewer-close" type="button" onClick={() => setViewerMediaId('')}>{isRu ? 'Закрыть' : 'Close'}</button>
                </div>
                <div className="media-bank-viewer-media admin-media-viewer-media">
                  <MediaPreview
                    publicUrl={viewerMedia.asset.publicUrl}
                    storageKey={viewerMedia.asset.storageKey}
                    kind={viewerMedia.kind}
                    alt={viewerMedia.altText || itemTitle(viewerMedia, locale)}
                    sizes="96vw"
                    controls
                    objectFit="contain"
                  />
                </div>
                <div className="media-bank-viewer-caption">
                  <strong>{itemTitle(viewerMedia, locale)}</strong>
                  {viewerMedia.caption ? <p>{viewerMedia.caption}</p> : null}
                  <span>{viewerMedia.album?.title || viewerMedia.groupTitle || (isRu ? 'Без альбома' : 'Unassigned')} · {statusLabel(viewerMedia.status, locale)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
