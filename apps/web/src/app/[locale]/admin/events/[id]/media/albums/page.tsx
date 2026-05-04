'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi, eventMediaApi, type EventMediaItem } from '@/lib/api';
import { adminMediaAlbumsApi, type EventMediaAlbum } from '@/lib/media-albums-api';
import { MediaPreview } from '@/components/media/MediaPreview';
import { EmptyState, FieldInput, FieldTextarea, LoadingLines, Notice, Panel, SectionHeader, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';

type MediaStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED';

function statusTone(status: EventMediaItem['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function statusLabel(status: EventMediaItem['status'], isRu: boolean) {
  const ru: Record<EventMediaItem['status'], string> = { PENDING: 'На модерации', APPROVED: 'Опубликовано', REJECTED: 'Отклонено', DELETED: 'Удалено' };
  const en: Record<EventMediaItem['status'], string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', DELETED: 'Deleted' };
  return (isRu ? ru : en)[status] ?? status;
}

export default function AdminMediaAlbumsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');
  const isRu = locale === 'ru';

  const [eventTitle, setEventTitle] = useState('');
  const [albums, setAlbums] = useState<EventMediaAlbum[]>([]);
  const [media, setMedia] = useState<EventMediaItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [status, setStatus] = useState<MediaStatus>('APPROVED');
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setPageLoading(true);
    setError('');
    try {
      const [eventResult, albumsResult, mediaResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminMediaAlbumsApi.list(eventId),
        eventMediaApi.adminList(eventId, { status, search, limit: 80 }),
      ]);
      setEventTitle(eventResult.data?.[0]?.title ?? '');
      setAlbums(albumsResult.albums);
      setMedia(mediaResult.media);
      setSelectedMediaIds([]);
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
      setAlbums([]);
      setMedia([]);
    } finally {
      setPageLoading(false);
    }
  }, [eventId, locale, search, status]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const handle = window.setTimeout(() => void loadData(), 220);
    return () => window.clearTimeout(handle);
  }, [user, isAdmin, loadData]);

  const selectedAlbum = useMemo(() => albums.find((album) => album.id === selectedAlbumId) ?? null, [albums, selectedAlbumId]);
  const selectedCount = selectedMediaIds.length;

  function toggleMedia(id: string) {
    setSelectedMediaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectAllVisible() {
    setSelectedMediaIds(media.map((item) => item.id));
  }

  async function createAlbum() {
    if (!eventId) return;
    const title = newTitle.trim();
    if (!title) {
      setError(isRu ? 'Введите название альбома.' : 'Enter album title.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await adminMediaAlbumsApi.create(eventId, { title, description: newDescription.trim() || undefined });
      setNewTitle('');
      setNewDescription('');
      setSelectedAlbumId(result.album.id);
      setNotice(isRu ? 'Альбом создан.' : 'Album created.');
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  async function moveSelectedToAlbum(albumId: string) {
    if (!eventId || !selectedCount) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await adminMediaAlbumsApi.assignMedia(eventId, albumId, selectedMediaIds);
      setSelectedMediaIds([]);
      setNotice(isRu ? `Перемещено файлов: ${result.movedCount}.` : `Moved items: ${result.movedCount}.`);
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  async function unassignSelected() {
    if (!eventId || !selectedCount) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await adminMediaAlbumsApi.unassignMedia(eventId, selectedMediaIds);
      setSelectedMediaIds([]);
      setNotice(isRu ? `Убрано из альбомов: ${result.movedCount}.` : `Removed from albums: ${result.movedCount}.`);
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAlbum(album: EventMediaAlbum) {
    if (!eventId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminMediaAlbumsApi.remove(eventId, album.id);
      if (selectedAlbumId === album.id) setSelectedAlbumId('');
      setNotice(isRu ? 'Альбом удалён. Медиа остались в фотобанке.' : 'Album deleted. Media items stayed in the bank.');
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  async function setCover(mediaId: string) {
    if (!eventId || !selectedAlbum) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminMediaAlbumsApi.update(eventId, selectedAlbum.id, { coverMediaId: mediaId });
      setNotice(isRu ? 'Обложка альбома обновлена.' : 'Album cover updated.');
      await loadData();
    } catch (err: any) {
      setError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;

  return (
    <div className="signal-page-shell admin-control-page admin-media-albums-page">
      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader
          title={isRu ? 'Альбомы фотобанка' : 'Media bank albums'}
          subtitle={eventTitle
            ? `${eventTitle} · ${isRu ? 'создание альбомов и распределение уже загруженных медиа' : 'create albums and organize already uploaded media'}`
            : (isRu ? 'Создание альбомов и распределение уже загруженных медиа' : 'Create albums and organize already uploaded media')}
        />
        <ToolbarRow>
          <Link href={`/${locale}/admin/events/${eventId}/media`} className="btn btn-ghost btn-sm">{isRu ? 'К фотобанку' : 'Back to media bank'}</Link>
          <Link href={`/${locale}/admin/events/${eventId}/media/captions`} className="btn btn-secondary btn-sm">{isRu ? 'Подписи на модерации' : 'Caption moderation'}</Link>
          <Link href={`/${locale}/admin/media`} className="btn btn-ghost btn-sm">{isRu ? 'Все фотобанки' : 'All media banks'}</Link>
        </ToolbarRow>
      </Panel>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {pageLoading ? <LoadingLines rows={8} /> : (
        <div className="admin-media-albums-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 18, alignItems: 'start' }}>
          <div className="admin-media-albums-sidebar" style={{ display: 'grid', gap: 14 }}>
            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={isRu ? 'Создать альбом' : 'Create album'} subtitle={isRu ? 'Например: Открытие, Волонтёры, Финал' : 'For example: Opening, Volunteers, Final'} />
              <FieldInput value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={isRu ? 'Название альбома' : 'Album title'} maxLength={120} />
              <FieldTextarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder={isRu ? 'Описание' : 'Description'} rows={3} maxLength={1000} />
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void createAlbum()}>{isRu ? 'Создать' : 'Create'}</button>
            </Panel>

            <Panel variant="elevated" className="admin-command-panel">
              <SectionHeader title={isRu ? 'Альбомы' : 'Albums'} subtitle={isRu ? 'Выберите альбом для перемещения выбранных медиа' : 'Choose an album for selected media'} />
              {albums.length ? albums.map((album) => (
                <article key={album.id} className={`admin-event-media-card ${selectedAlbumId === album.id ? 'is-selected' : ''}`}>
                  <div className="admin-event-media-body">
                    <div className="admin-event-media-title-row">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedAlbumId(album.id)}>{album.title}</button>
                      <span className="badge badge-muted">{album.mediaCount}</span>
                    </div>
                    {album.description ? <div className="signal-muted">{album.description}</div> : null}
                    <ToolbarRow>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !selectedCount} onClick={() => void moveSelectedToAlbum(album.id)}>
                        {isRu ? `Поместить (${selectedCount})` : `Move (${selectedCount})`}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void deleteAlbum(album)}>{isRu ? 'Удалить' : 'Delete'}</button>
                    </ToolbarRow>
                  </div>
                </article>
              )) : <EmptyState title={isRu ? 'Альбомов пока нет' : 'No albums yet'} description={isRu ? 'Создайте первый альбом.' : 'Create the first album.'} />}
            </Panel>
          </div>

          <Panel variant="elevated" className="admin-command-panel">
            <SectionHeader
              title={isRu ? 'Медиа для распределения' : 'Media to organize'}
              subtitle={selectedAlbum ? (isRu ? `Выбран альбом: ${selectedAlbum.title}` : `Selected album: ${selectedAlbum.title}`) : (isRu ? 'Выберите файлы и альбом слева' : 'Select files and an album on the left')}
            />
            <ToolbarRow>
              <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRu ? 'Поиск медиа' : 'Search media'} />
              <select className="signal-field signal-select" value={status} onChange={(event) => setStatus(event.target.value as MediaStatus)}>
                <option value="ALL">{isRu ? 'Все статусы' : 'All statuses'}</option>
                <option value="APPROVED">{isRu ? 'Опубликовано' : 'Approved'}</option>
                <option value="PENDING">{isRu ? 'На модерации' : 'Pending'}</option>
                <option value="REJECTED">{isRu ? 'Отклонено' : 'Rejected'}</option>
                <option value="DELETED">{isRu ? 'Удалено' : 'Deleted'}</option>
              </select>
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible} disabled={!media.length}>{isRu ? 'Выбрать видимые' : 'Select visible'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedMediaIds([])} disabled={!selectedCount}>{isRu ? 'Снять выбор' : 'Clear'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void unassignSelected()} disabled={busy || !selectedCount}>{isRu ? 'Убрать из альбомов' : 'Remove from albums'}</button>
            </ToolbarRow>

            {media.length ? (
              <div className="admin-event-media-list">
                {media.map((item) => {
                  const selected = selectedMediaIds.includes(item.id);
                  return (
                    <article className={`admin-event-media-card ${selected ? 'is-selected' : ''}`} key={item.id}>
                      <div className="admin-event-media-preview">
                        <MediaPreview publicUrl={item.asset.publicUrl} storageKey={item.asset.storageKey} kind={item.kind} alt={item.altText || item.title || item.caption || item.asset.originalFilename} sizes="(max-width: 768px) 100vw, 280px" />
                      </div>
                      <div className="admin-event-media-body">
                        <div className="admin-event-media-title-row">
                          <label className="signal-muted"><input type="checkbox" checked={selected} onChange={() => toggleMedia(item.id)} /> {item.title || item.asset.originalFilename}</label>
                          <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status, isRu)}</StatusBadge>
                        </div>
                        <div className="signal-muted">{item.kind} · {item.source} · #{item.displayNumber ?? '—'}</div>
                        {item.caption ? <div className="signal-muted">{item.caption}</div> : null}
                        <ToolbarRow>
                          {selectedAlbum ? <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void moveSelectedToAlbum(selectedAlbum.id)}>{isRu ? 'В выбранный альбом' : 'Move to selected album'}</button> : null}
                          {selectedAlbum ? <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void setCover(item.id)}>{isRu ? 'Сделать обложкой' : 'Set as cover'}</button> : null}
                        </ToolbarRow>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState title={isRu ? 'Медиа не найдены' : 'No media found'} description={isRu ? 'Измените фильтры или загрузите медиа в фотобанк.' : 'Change filters or upload media to the bank.'} />
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
