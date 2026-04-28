'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteParams } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import {
  EmptyState,
  FieldInput,
  FieldSelect,
  LoadingLines,
  MetricCard,
  Notice,
  Panel,
  SectionHeader,
  ToolbarRow,
} from '@/components/ui/signal-primitives';
import { EventGalleryCard } from '@/components/event-gallery/EventGalleryCard';
import { EventGalleryUploadPanel } from '@/components/event-gallery/EventGalleryUploadPanel';
import { EventNotFound, EventWorkspaceHeader, type AdminEventRecord } from '@/components/admin/AdminEventWorkspace';

export default function AdminEventMediaPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { locale, get } = useRouteParams();
  const eventId = get('id');

  const [event, setEvent] = useState<AdminEventRecord | null>(null);
  const [gallery, setGallery] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'ALL' | 'OFFICIAL' | 'PARTICIPANT'>('ALL');
  const [type, setType] = useState<'ALL' | 'PHOTO' | 'VIDEO'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED'>('ALL');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [actionKey, setActionKey] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push(`/${locale}`);
  }, [user, loading, isAdmin, router, locale]);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoadingData(true);
    setError('');

    try {
      const [eventResult, galleryResult] = await Promise.all([
        adminApi.listEvents({ id: eventId, limit: 1 }),
        adminApi.listEventGallery(eventId, {
          page: 1,
          limit: 12,
          source,
          type,
          status,
          search,
        }),
      ]);

      setEvent(eventResult.data[0] ?? null);
      setGallery(galleryResult);
    } catch (err: any) {
      setError(err.message || 'Failed to load media workspace');
      setGallery(null);
    } finally {
      setLoadingData(false);
    }
  }, [eventId, source, type, status, search]);

  useEffect(() => {
    if (user && isAdmin) void loadData();
  }, [user, isAdmin, loadData]);

  async function reloadGallery() {
    if (!eventId) return;
    const galleryResult = await adminApi.listEventGallery(eventId, {
      page: 1,
      limit: 12,
      source,
      type,
      status,
      search,
    });
    setGallery(galleryResult);
  }

  async function handleLoadMore() {
    if (!eventId || !gallery?.meta?.hasMore || loadingData) return;
    setLoadingData(true);
    setError('');

    try {
      const nextPage = Number(gallery?.meta?.page ?? 1) + 1;
      const result = await adminApi.listEventGallery(eventId, {
        page: nextPage,
        limit: Number(gallery?.meta?.limit ?? 12),
        source,
        type,
        status,
        search,
      });

      setGallery((previous: any) => ({
        ...result,
        items: [...(previous?.items ?? []), ...(result.items ?? [])],
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to load more media');
    } finally {
      setLoadingData(false);
    }
  }

  async function handleOfficialUpload(file: File, caption: string) {
    if (!eventId) return;
    await adminApi.uploadEventGalleryAsset(eventId, file, caption);
    await reloadGallery();
  }

  async function handleStatusUpdate(assetId: string, nextStatus: 'PUBLISHED' | 'REJECTED' | 'ARCHIVED') {
    if (!eventId) return;
    setActionKey(`${assetId}:${nextStatus}`);
    setError('');

    try {
      await adminApi.updateEventGalleryAsset(eventId, assetId, { status: nextStatus });
      await reloadGallery();
    } catch (err: any) {
      setError(err.message || 'Failed to update media status');
    } finally {
      setActionKey('');
    }
  }

  async function handleDelete(assetId: string) {
    if (!eventId) return;
    const confirmed = window.confirm(locale === 'ru' ? 'Удалить этот материал без возможности восстановления?' : 'Delete this media item permanently?');
    if (!confirmed) return;

    setActionKey(`${assetId}:DELETE`);
    setError('');

    try {
      await adminApi.deleteEventGalleryAsset(eventId, assetId);
      await reloadGallery();
    } catch (err: any) {
      setError(err.message || 'Failed to delete media');
    } finally {
      setActionKey('');
    }
  }

  if (loading || !user || !isAdmin) return <div className="admin-loading-screen"><div className="spinner" /></div>;
  if (!loadingData && !event) return <EventNotFound locale={locale} />;

  return (
    <div className="signal-page-shell admin-control-page admin-event-workspace-page">
      <EventWorkspaceHeader
        event={event}
        locale={locale}
        title={locale === 'ru' ? 'Фотобанк события' : 'Event photobank'}
        subtitle={locale === 'ru'
          ? 'Официальные публикации, пользовательские загрузки и очередь модерации.'
          : 'Official uploads, participant contributions, and moderation queue.'}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData && !gallery ? (
        <LoadingLines rows={8} />
      ) : (
        <>
          <div className="signal-kpi-grid">
            <MetricCard tone="info" label={locale === 'ru' ? 'Всего файлов' : 'Total items'} value={gallery?.summary?.total ?? 0} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'На модерации' : 'Pending review'} value={gallery?.summary?.pending ?? 0} />
            <MetricCard tone="success" label={locale === 'ru' ? 'Опубликовано' : 'Published'} value={gallery?.summary?.published ?? 0} />
            <MetricCard tone="danger" label={locale === 'ru' ? 'Отклонено' : 'Rejected'} value={gallery?.summary?.rejected ?? 0} />
            <MetricCard tone="neutral" label={locale === 'ru' ? 'Официальные' : 'Official'} value={gallery?.summary?.official ?? 0} />
            <MetricCard tone="warning" label={locale === 'ru' ? 'От участников' : 'Participant'} value={gallery?.summary?.participant ?? 0} />
          </div>

          <EventGalleryUploadPanel
            locale={locale}
            title={locale === 'ru' ? 'Официальная загрузка' : 'Official upload'}
            subtitle={locale === 'ru'
              ? 'Материал публикуется сразу и попадает в публичный фотобанк.'
              : 'The upload is published immediately to the public photobank.'}
            helper={locale === 'ru'
              ? `JPG, PNG, WebP до ${gallery?.limits?.photoMb ?? 12} МБ; MP4, WebM, MOV до ${gallery?.limits?.videoMb ?? 40} МБ.`
              : `JPG, PNG, WebP up to ${gallery?.limits?.photoMb ?? 12} MB; MP4, WebM, MOV up to ${gallery?.limits?.videoMb ?? 40} MB.`}
            buttonLabel={locale === 'ru' ? 'Опубликовать материал' : 'Publish media'}
            uploadingLabel={locale === 'ru' ? 'Публикуем...' : 'Publishing...'}
            successMessage={locale === 'ru'
              ? 'Материал опубликован и сразу доступен в публичном фотобанке.'
              : 'The media item was published and is now visible in the public photobank.'}
            onUpload={handleOfficialUpload}
          />

          <Panel variant="elevated" className="event-gallery-panel">
            <SectionHeader
              title={locale === 'ru' ? 'Лента материалов' : 'Media feed'}
              subtitle={locale === 'ru'
                ? 'Фильтруйте ленту по источнику, типу и статусу.'
                : 'Filter by source, media type, and moderation status.'}
            />

            <div className="event-gallery-admin-toolbar">
              <FieldInput
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={locale === 'ru' ? 'Поиск по подписи, файлу или автору' : 'Search by caption, file, or author'}
              />
              <FieldSelect value={source} onChange={(event) => setSource(event.target.value as 'ALL' | 'OFFICIAL' | 'PARTICIPANT')}>
                <option value="ALL">{locale === 'ru' ? 'Все источники' : 'All sources'}</option>
                <option value="OFFICIAL">{locale === 'ru' ? 'Официальные' : 'Official'}</option>
                <option value="PARTICIPANT">{locale === 'ru' ? 'От участников' : 'Participant'}</option>
              </FieldSelect>
              <FieldSelect value={type} onChange={(event) => setType(event.target.value as 'ALL' | 'PHOTO' | 'VIDEO')}>
                <option value="ALL">{locale === 'ru' ? 'Все типы' : 'All types'}</option>
                <option value="PHOTO">{locale === 'ru' ? 'Фото' : 'Photo'}</option>
                <option value="VIDEO">{locale === 'ru' ? 'Видео' : 'Video'}</option>
              </FieldSelect>
              <FieldSelect value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED')}>
                <option value="ALL">{locale === 'ru' ? 'Все статусы' : 'All statuses'}</option>
                <option value="PENDING">{locale === 'ru' ? 'На модерации' : 'Pending'}</option>
                <option value="PUBLISHED">{locale === 'ru' ? 'Опубликовано' : 'Published'}</option>
                <option value="REJECTED">{locale === 'ru' ? 'Отклонено' : 'Rejected'}</option>
                <option value="ARCHIVED">{locale === 'ru' ? 'Архив' : 'Archived'}</option>
              </FieldSelect>
              <ToolbarRow>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch(searchDraft.trim())}>
                  {locale === 'ru' ? 'Применить' : 'Apply'}
                </button>
              </ToolbarRow>
            </div>

            {(gallery?.items?.length ?? 0) === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Материалы не найдены' : 'No media found'}
                description={locale === 'ru'
                  ? 'Попробуйте изменить фильтры или добавить официальный материал.'
                  : 'Try adjusting the filters or uploading an official item.'}
              />
            ) : (
              <>
                <div className="event-gallery-grid">
                  {gallery.items.map((item: any) => (
                    <EventGalleryCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      showStatus
                      actions={(
                        <>
                          {item.status !== 'PUBLISHED' ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleStatusUpdate(item.id, 'PUBLISHED')}
                              disabled={Boolean(actionKey)}
                            >
                              {actionKey === `${item.id}:PUBLISHED`
                                ? (locale === 'ru' ? 'Публикуем...' : 'Publishing...')
                                : (locale === 'ru' ? 'Опубликовать' : 'Publish')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleStatusUpdate(item.id, 'ARCHIVED')}
                              disabled={Boolean(actionKey)}
                            >
                              {actionKey === `${item.id}:ARCHIVED`
                                ? (locale === 'ru' ? 'Архивируем...' : 'Archiving...')
                                : (locale === 'ru' ? 'В архив' : 'Archive')}
                            </button>
                          )}

                          {item.status !== 'REJECTED' ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatusUpdate(item.id, 'REJECTED')}
                              disabled={Boolean(actionKey)}
                            >
                              {actionKey === `${item.id}:REJECTED`
                                ? (locale === 'ru' ? 'Отклоняем...' : 'Rejecting...')
                                : (locale === 'ru' ? 'Отклонить' : 'Reject')}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(item.id)}
                            disabled={Boolean(actionKey)}
                          >
                            {actionKey === `${item.id}:DELETE`
                              ? (locale === 'ru' ? 'Удаляем...' : 'Deleting...')
                              : (locale === 'ru' ? 'Удалить' : 'Delete')}
                          </button>
                        </>
                      )}
                    />
                  ))}
                </div>

                {gallery?.meta?.hasMore ? (
                  <div className="event-gallery-loadmore">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadMore} disabled={loadingData}>
                      {loadingData
                        ? (locale === 'ru' ? 'Загружаем...' : 'Loading...')
                        : (locale === 'ru' ? 'Показать ещё' : 'Load more')}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
