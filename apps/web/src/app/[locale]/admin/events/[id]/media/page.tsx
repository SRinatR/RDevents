'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, eventMediaApi, type EventMediaItem, type EventMediaSettings, type MediaInput } from '@/lib/api';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { EventNotFound, EventWorkspaceHeader, formatAdminDateTime, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type MediaStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED' | 'ALL';
type MediaTypeFilter = 'all' | 'image' | 'video';

const STATUS_FILTERS: MediaStatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'DELETED', 'ALL'];

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
  if (item.kind === 'image') {
    return <Image src={item.asset.publicUrl} alt={label} fill sizes="220px" />;
  }
  return <video src={item.asset.publicUrl} controls preload="metadata" aria-label={label} />;
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
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [settings, setSettings] = useState<EventMediaSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<EventMediaSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<MediaStatusFilter>('PENDING');
  const [type, setType] = useState<MediaTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, MediaInput>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState<MediaInput>(emptyDraft());
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setPageLoading(true);
    setError('');
    try {
      const [eventResult, settingsResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        eventMediaApi.getSettings(eventId).catch(() => ({ settings: DEFAULT_SETTINGS })),
      ]);
      setEvent(eventResult.data[0] ?? null);
      setSettings(settingsResult.settings);
      setSettingsDraft(settingsResult.settings);
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
      setEvent(null);
    } finally {
      setPageLoading(false);
    }
  }, [eventId, locale]);

  const loadMedia = useCallback(async () => {
    if (!eventId) return;
    setMediaLoading(true);
    setError('');
    try {
      const result = await eventMediaApi.adminList(eventId, { status, type, search, limit: 50 });
      setMedia(result.media);
      setDrafts(Object.fromEntries(result.media.map((item) => [item.id, emptyDraft(item)])));
      setRejectReasons(Object.fromEntries(result.media.map((item) => [item.id, item.moderationNotes ?? ''])));
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setMediaLoading(false);
    }
  }, [eventId, status, type, search, locale]);

  useEffect(() => {
    if (user && isAdmin) void loadEvent();
  }, [user, isAdmin, loadEvent]);

  useEffect(() => {
    if (user && isAdmin) void loadMedia();
  }, [user, isAdmin, loadMedia]);

  const stats = useMemo(() => ({
    pending: media.filter((item) => item.status === 'PENDING').length,
    approved: media.filter((item) => item.status === 'APPROVED').length,
    rejected: media.filter((item) => item.status === 'REJECTED').length,
  }), [media]);

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
    patchSettings('allowedTypes', next);
  }

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventId || !uploadFile) {
      setError(isRu ? 'Выберите фото или видео.' : 'Choose a photo or video.');
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
    try {
      await eventMediaApi.adminUpload(eventId, uploadFile, uploadDraft);
      setUploadFile(null);
      setUploadDraft(emptyDraft());
      e.currentTarget.reset();
      setNotice(isRu ? 'Медиа от организатора опубликовано.' : 'Organizer media was published.');
      await loadMedia();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate(item: EventMediaItem, nextStatus?: EventMediaItem['status']) {
    if (!eventId) return;
    const reason = rejectReasons[item.id]?.trim() ?? '';
    if (nextStatus === 'REJECTED' && !reason) {
      setError(isRu ? 'Причина отклонения обязательна.' : 'Rejection reason is required.');
      return;
    }

    setBusyId(item.id);
    setError('');
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
      await loadMedia();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(item: EventMediaItem) {
    if (!eventId) return;
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      await eventMediaApi.adminDelete(eventId, item.id);
      setNotice(isRu ? 'Медиа скрыто из фотобанка.' : 'Media was hidden from the bank.');
      await loadMedia();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusyId('');
    }
  }

  async function handleSaveSettings() {
    if (!eventId) return;
    setSavingSettings(true);
    setError('');
    setNotice('');
    try {
      const result = await eventMediaApi.updateSettings(eventId, settingsDraft);
      setSettings(result.settings);
      setSettingsDraft(result.settings);
      setNotice(isRu ? 'Настройки фотобанка сохранены.' : 'Media bank settings saved.');
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
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

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {pageLoading ? (
        <LoadingLines rows={8} />
      ) : event ? (
        <>
          <div className="workspace-status-strip workspace-status-strip-v2">
            <div className="workspace-status-card"><small>{isRu ? 'На модерации' : 'Pending'}</small><strong>{stats.pending}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Опубликовано' : 'Approved'}</small><strong>{stats.approved}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Отклонено' : 'Rejected'}</small><strong>{stats.rejected}</strong></div>
            <div className="workspace-status-card"><small>{isRu ? 'Фотобанк' : 'Media bank'}</small><strong>{settings.enabled ? (isRu ? 'Включён' : 'Enabled') : (isRu ? 'Выключен' : 'Disabled')}</strong></div>
          </div>

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
          </Panel>

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
          </Panel>

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
                              {item.kind === 'image' ? (isRu ? 'Фото' : 'Photo') : (isRu ? 'Видео' : 'Video')}
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
        </>
      ) : null}
    </div>
  );
}
