'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventMediaApi, type EventMediaImportJob, type UploadProgress } from '@/lib/api';
import { mediaBankAdminApi } from '@/lib/media-bank-admin-api';
import { getFriendlyApiErrorMessage } from '@/lib/api-errors';
import { EmptyState, FieldInput, LoadingLines, Notice, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';

type AdminMediaBulkUploadPanelProps = {
  eventId: string;
  locale: string;
  onDone?: () => void | Promise<void>;
};

type BulkProgress = {
  total: number;
  uploaded: number;
  failed: number;
};

type ArchiveOptions = {
  publishMode: 'approved' | 'pending';
  useFilenameAsTitle: boolean;
  skipDuplicates: boolean;
  preserveFolders: boolean;
  dateMode: 'metadata' | 'filename' | 'manual' | 'none';
  manualCapturedAt: string;
  timezone: string;
  groupMode: 'none' | 'first_folder' | 'full_path';
  captionTemplate: string;
  defaultCredit: string;
};

type ArchiveUploadPhase = 'selected' | 'uploading' | 'finalizing' | 'complete' | 'error';

type ArchiveUploadState = {
  phase: ArchiveUploadPhase;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
};

const MAX_CONCURRENT_UPLOADS = 4;

const DEFAULT_ARCHIVE_OPTIONS: ArchiveOptions = {
  publishMode: 'approved',
  useFilenameAsTitle: true,
  skipDuplicates: true,
  preserveFolders: true,
  dateMode: 'metadata',
  manualCapturedAt: '',
  timezone: 'Asia/Tashkent',
  groupMode: 'first_folder',
  captionTemplate: '{group} · {date} {time}',
  defaultCredit: '',
};

function isRunningJob(job?: EventMediaImportJob | null) {
  return job?.status === 'QUEUED' || job?.status === 'PROCESSING';
}

function jobStatusLabel(status: EventMediaImportJob['status'], isRu: boolean) {
  const ru: Record<EventMediaImportJob['status'], string> = {
    QUEUED: 'В очереди',
    PROCESSING: 'Обрабатывается',
    COMPLETED: 'Готово',
    COMPLETED_WITH_ERRORS: 'Готово с ошибками',
    FAILED: 'Ошибка',
    CANCELLED: 'Отменено',
  };
  const en: Record<EventMediaImportJob['status'], string> = {
    QUEUED: 'Queued',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    COMPLETED_WITH_ERRORS: 'Completed with errors',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  };
  return (isRu ? ru : en)[status] ?? status;
}

function formatFileSize(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return '0 KB';
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 * 1024 ? 1 : 0)} GB`;
}

function formatDuration(seconds: number | null, isRu: boolean) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return isRu ? 'считаем' : 'calculating';
  if (seconds < 5) return isRu ? 'несколько секунд' : 'a few seconds';

  const totalSeconds = Math.ceil(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  const restSeconds = totalSeconds % 60;

  if (hours > 0) {
    return isRu ? `${hours} ч ${restMinutes} мин` : `${hours} h ${restMinutes} min`;
  }
  if (minutes > 0) {
    return isRu ? `${minutes} мин ${restSeconds} сек` : `${minutes} min ${restSeconds} sec`;
  }
  return isRu ? `${totalSeconds} сек` : `${totalSeconds} sec`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function archiveUploadPhaseLabel(phase: ArchiveUploadPhase, isRu: boolean) {
  const ru: Record<ArchiveUploadPhase, string> = {
    selected: 'Архив выбран',
    uploading: 'Загружаем на сервер',
    finalizing: 'Проверяем и запускаем импорт',
    complete: 'Архив загружен',
    error: 'Загрузка не удалась',
  };
  const en: Record<ArchiveUploadPhase, string> = {
    selected: 'Archive selected',
    uploading: 'Uploading to server',
    finalizing: 'Checking and starting import',
    complete: 'Archive uploaded',
    error: 'Upload failed',
  };
  return (isRu ? ru : en)[phase];
}

function jobProgress(job: EventMediaImportJob) {
  const done = job.importedCount + job.skippedCount + job.failedCount;
  const total = Math.max(job.mediaEntries, done, 1);
  return Math.min(100, Math.round((done / total) * 100));
}

function jobProcessingStats(job: EventMediaImportJob) {
  const done = job.importedCount + job.skippedCount + job.failedCount;
  const total = Math.max(job.mediaEntries, done, 0);
  const remaining = Math.max(total - done, 0);
  const percent = total > 0 ? clampPercent((done / total) * 100) : 0;
  return { done, total, remaining, percent };
}

function normalizeMediaFiles(fileList: FileList | null) {
  return Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
}

export function AdminMediaBulkUploadPanel({ eventId, locale, onDone }: AdminMediaBulkUploadPanelProps) {
  const isRu = locale === 'ru';
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkCredit, setBulkCredit] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress>({ total: 0, uploaded: 0, failed: 0 });
  const [bulkError, setBulkError] = useState('');

  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [archiveUpload, setArchiveUpload] = useState<ArchiveUploadState | null>(null);
  const [archiveOptions, setArchiveOptions] = useState<ArchiveOptions>(DEFAULT_ARCHIVE_OPTIONS);
  const [archiveJobs, setArchiveJobs] = useState<EventMediaImportJob[]>([]);
  const [activeArchiveJob, setActiveArchiveJob] = useState<EventMediaImportJob | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveStarting, setArchiveStarting] = useState(false);
  const [archiveBusyId, setArchiveBusyId] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [notice, setNotice] = useState('');

  const bulkTotalSize = useMemo(() => bulkFiles.reduce((sum, file) => sum + file.size, 0), [bulkFiles]);
  const archiveRemainingBytes = archiveUpload ? Math.max(archiveUpload.totalBytes - archiveUpload.loadedBytes, 0) : 0;
  const archiveProcessingStats = activeArchiveJob ? jobProcessingStats(activeArchiveJob) : null;

  const loadArchiveJobs = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const result = await eventMediaApi.imports.list(eventId);
      setArchiveJobs(result.jobs);
      const running = result.jobs.find(isRunningJob) ?? null;
      if (running) setActiveArchiveJob(running);
    } catch (err: any) {
      setArchiveError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setArchiveLoading(false);
    }
  }, [eventId, locale]);

  useEffect(() => {
    void loadArchiveJobs();
  }, [loadArchiveJobs]);

  useEffect(() => {
    if (!activeArchiveJob || !isRunningJob(activeArchiveJob)) return;

    const interval = window.setInterval(async () => {
      try {
        const result = await eventMediaApi.imports.get(eventId, activeArchiveJob.id);
        setActiveArchiveJob(result.job);
        setArchiveJobs((current) => current.map((job) => job.id === result.job.id ? result.job : job));
        if (!isRunningJob(result.job)) {
          window.clearInterval(interval);
          await onDone?.();
          await loadArchiveJobs();
        }
      } catch (err: any) {
        setArchiveError(getFriendlyApiErrorMessage(err, locale));
        window.clearInterval(interval);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [activeArchiveJob, eventId, loadArchiveJobs, locale, onDone]);

  function handleBulkFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = normalizeMediaFiles(event.currentTarget.files);
    setBulkFiles(files);
    setBulkProgress({ total: files.length, uploaded: 0, failed: 0 });
    setBulkError('');
    setNotice('');
  }

  async function handleBulkUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bulkFiles.length) {
      setBulkError(isRu ? 'Выберите несколько фото или видео.' : 'Choose multiple photos or videos.');
      return;
    }

    setBulkUploading(true);
    setBulkError('');
    setNotice('');
    setBulkProgress({ total: bulkFiles.length, uploaded: 0, failed: 0 });

    let nextIndex = 0;
    let uploaded = 0;
    let failed = 0;

    async function worker() {
      while (nextIndex < bulkFiles.length) {
        const file = bulkFiles[nextIndex];
        nextIndex += 1;
        if (!file) continue;

        try {
          await eventMediaApi.adminUpload(eventId, file, {
            credit: bulkCredit.trim() || undefined,
          });
          uploaded += 1;
        } catch {
          failed += 1;
        } finally {
          setBulkProgress({ total: bulkFiles.length, uploaded, failed });
        }
      }
    }

    try {
      const workers = Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, bulkFiles.length) }, () => worker());
      await Promise.all(workers);
      if (failed > 0) {
        setBulkError(isRu
          ? `Загружено ${uploaded}, ошибок: ${failed}. Проверьте размер и тип файлов.`
          : `Uploaded ${uploaded}, failed: ${failed}. Check file size and type.`);
      } else {
        setNotice(isRu ? `Загружено ${uploaded} файлов.` : `Uploaded ${uploaded} files.`);
        setBulkFiles([]);
      }
      await onDone?.();
    } finally {
      setBulkUploading(false);
    }
  }

  function handleArchiveFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setArchiveFile(file);
    setArchiveUpload(file
      ? {
          phase: 'selected',
          loadedBytes: 0,
          totalBytes: file.size,
          percent: 0,
          bytesPerSecond: null,
          etaSeconds: null,
        }
      : null);
    setArchiveError('');
    setNotice('');
  }

  async function handleArchiveImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!archiveFile) {
      setArchiveError(isRu ? 'Выберите ZIP-архив.' : 'Choose a ZIP archive.');
      return;
    }

    setArchiveStarting(true);
    setArchiveError('');
    setNotice('');
    setArchiveUpload({
      phase: 'uploading',
      loadedBytes: 0,
      totalBytes: archiveFile.size,
      percent: 0,
      bytesPerSecond: null,
      etaSeconds: null,
    });
    try {
      const formData = new FormData();
      formData.append('archive', archiveFile);
      formData.append('publishMode', archiveOptions.publishMode);
      formData.append('useFilenameAsTitle', String(archiveOptions.useFilenameAsTitle));
      formData.append('skipDuplicates', String(archiveOptions.skipDuplicates));
      formData.append('preserveFolders', String(archiveOptions.preserveFolders));
      formData.append('dateMode', archiveOptions.dateMode);
      formData.append('manualCapturedAt', archiveOptions.manualCapturedAt);
      formData.append('timezone', archiveOptions.timezone);
      formData.append('groupMode', archiveOptions.groupMode);
      formData.append('captionTemplate', archiveOptions.captionTemplate);
      formData.append('defaultCredit', archiveOptions.defaultCredit);

      const updateArchiveUpload = (progress: UploadProgress) => {
        const totalBytes = progress.total ?? archiveFile.size;
        const loadedBytes = Math.min(progress.loaded, totalBytes);
        const percent = progress.total
          ? progress.percent
          : clampPercent((loadedBytes / Math.max(totalBytes, 1)) * 100);
        setArchiveUpload({
          phase: percent >= 100 ? 'finalizing' : 'uploading',
          loadedBytes,
          totalBytes,
          percent,
          bytesPerSecond: progress.bytesPerSecond,
          etaSeconds: progress.etaSeconds,
        });
      };

      const result = await eventMediaApi.imports.start(eventId, formData, updateArchiveUpload);
      setActiveArchiveJob(result.job);
      setArchiveJobs((current) => [result.job, ...current.filter((job) => job.id !== result.job.id)]);
      setArchiveUpload((current) => current
        ? { ...current, phase: 'complete', loadedBytes: current.totalBytes, percent: 100, etaSeconds: 0 }
        : current);
      setNotice(isRu ? 'Архив поставлен в обработку.' : 'Archive import has started.');
    } catch (err: any) {
      setArchiveUpload((current) => current ? { ...current, phase: 'error' } : current);
      setArchiveError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setArchiveStarting(false);
    }
  }

  async function cancelImport(job: EventMediaImportJob) {
    setArchiveBusyId(job.id);
    setArchiveError('');
    try {
      const result = await eventMediaApi.imports.cancel(eventId, job.id);
      setActiveArchiveJob(result.job);
      setNotice(isRu ? 'Импорт отменён.' : 'Import cancelled.');
      await loadArchiveJobs();
    } catch (err: any) {
      setArchiveError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setArchiveBusyId('');
    }
  }

  async function rollbackImport(job: EventMediaImportJob) {
    setArchiveBusyId(job.id);
    setArchiveError('');
    try {
      const result = await mediaBankAdminApi.rollbackImport(eventId, job.id);
      setNotice(isRu ? `Импорт откатан. Скрыто медиа: ${result.deletedMediaCount}.` : `Import rolled back. Hidden media: ${result.deletedMediaCount}.`);
      await Promise.all([loadArchiveJobs(), onDone?.()]);
    } catch (err: any) {
      setArchiveError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setArchiveBusyId('');
    }
  }

  async function deleteImport(job: EventMediaImportJob, deleteImportedMedia: boolean) {
    setArchiveBusyId(job.id);
    setArchiveError('');
    try {
      const result = await mediaBankAdminApi.deleteImport(eventId, job.id, { deleteImportedMedia });
      if (activeArchiveJob?.id === job.id) setActiveArchiveJob(null);
      setNotice(deleteImportedMedia
        ? (isRu ? `Импорт удалён. Скрыто медиа: ${result.deletedMediaCount}.` : `Import deleted. Hidden media: ${result.deletedMediaCount}.`)
        : (isRu ? 'Запись импорта удалена. Медиа остались в фотобанке.' : 'Import record deleted. Media items stayed in the bank.'));
      await Promise.all([loadArchiveJobs(), onDone?.()]);
    } catch (err: any) {
      setArchiveError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setArchiveBusyId('');
    }
  }

  function patchArchiveOption<K extends keyof ArchiveOptions>(key: K, value: ArchiveOptions[K]) {
    setArchiveOptions((current) => ({ ...current, [key]: value }));
  }

  const runningProgress = activeArchiveJob ? jobProgress(activeArchiveJob) : 0;
  const archiveUploadStatus = archiveUpload ? archiveUploadPhaseLabel(archiveUpload.phase, isRu) : '';
  const archiveUploadEtaLabel = archiveUpload?.phase === 'uploading'
    ? formatDuration(archiveUpload.etaSeconds, isRu)
    : archiveUpload?.phase === 'finalizing'
      ? (isRu ? 'ждём ответ сервера' : 'waiting for server')
      : archiveUpload?.phase === 'complete'
        ? (isRu ? 'готово' : 'done')
        : archiveUpload?.phase === 'error'
          ? (isRu ? 'можно повторить' : 'ready to retry')
          : (isRu ? 'после старта' : 'after start');
  const archiveUploadSpeedLabel = archiveUpload?.bytesPerSecond
    ? `${formatFileSize(archiveUpload.bytesPerSecond)}/s`
    : (isRu ? 'появится при загрузке' : 'shown while uploading');
  const archiveRemainingLabel = archiveUpload?.phase === 'selected'
    ? formatFileSize(archiveUpload.totalBytes)
    : formatFileSize(archiveRemainingBytes);

  return (
    <div className="signal-page-shell">
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <Panel variant="elevated" className="admin-command-panel admin-media-upload-panel">
        <SectionHeader
          title={isRu ? 'Массовая загрузка файлов' : 'Bulk file upload'}
          subtitle={isRu
            ? 'Выберите сразу много фото и видео. Система загрузит их параллельно и опубликует от организатора.'
            : 'Choose many photos and videos at once. The system uploads them in parallel and publishes them as organizer media.'}
        />

        <form className="admin-media-upload-form" onSubmit={handleBulkUpload}>
          <label className="media-upload-dropzone">
            <span>{bulkFiles.length ? `${bulkFiles.length} ${isRu ? 'файлов выбрано' : 'files selected'}` : (isRu ? 'Выбрать фото и видео' : 'Choose photos and videos')}</span>
            <small>{isRu ? 'Можно выбрать сразу несколько файлов image/* и video/*' : 'You can select multiple image/* and video/* files'}</small>
            <input type="file" accept="image/*,video/*" multiple onChange={handleBulkFilesChange} />
          </label>

          <FieldInput
            value={bulkCredit}
            onChange={(event) => setBulkCredit(event.target.value)}
            maxLength={120}
            placeholder={isRu ? 'Общий автор / credit для всех файлов' : 'Shared author / credit for all files'}
          />

          {bulkFiles.length ? (
            <div className="signal-muted">
              {isRu ? 'Всего' : 'Total'}: {bulkFiles.length} · {formatFileSize(bulkTotalSize)} · {isRu ? 'параллельно до' : 'up to'} {MAX_CONCURRENT_UPLOADS}
            </div>
          ) : null}

          {bulkUploading ? (
            <div className="signal-muted">
              {isRu ? 'Загружено' : 'Uploaded'}: {bulkProgress.uploaded}/{bulkProgress.total}
              {bulkProgress.failed ? ` · ${isRu ? 'ошибок' : 'failed'}: ${bulkProgress.failed}` : ''}
            </div>
          ) : null}

          <button className="btn btn-primary btn-sm" type="submit" disabled={bulkUploading || !bulkFiles.length}>
            {bulkUploading ? (isRu ? 'Загружаем...' : 'Uploading...') : (isRu ? 'Загрузить все' : 'Upload all')}
          </button>
        </form>

        {bulkError ? <Notice tone="danger">{bulkError}</Notice> : null}
      </Panel>

      <Panel variant="elevated" className="admin-command-panel admin-media-upload-panel">
        <SectionHeader
          title={isRu ? 'Загрузка ZIP-архива' : 'ZIP archive import'}
          subtitle={isRu
            ? 'Загрузите архив с фото и видео разных типов. Система распакует, извлечёт даты, сгруппирует папки и создаст отчёт.'
            : 'Upload an archive with mixed photos/videos. The system extracts dates, groups folders, and creates a report.'}
        />

        <form className="admin-media-upload-form" onSubmit={handleArchiveImport}>
          <label className="media-upload-dropzone">
            <span>{archiveFile ? archiveFile.name : (isRu ? 'ZIP-архив с медиа' : 'ZIP archive with media')}</span>
            <small>{isRu ? 'До 2 GB, до 1000 файлов внутри' : 'Up to 2 GB, up to 1000 entries inside'}</small>
            <input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={handleArchiveFileChange} />
          </label>

          {archiveUpload && archiveFile ? (
            <div className={`archive-upload-card is-${archiveUpload.phase}`}>
              <div className="archive-upload-card-header">
                <div className="archive-upload-file">
                  <small>{isRu ? 'Выбранный архив' : 'Selected archive'}</small>
                  <strong title={archiveFile.name}>{archiveFile.name}</strong>
                  <span>{formatFileSize(archiveFile.size)} · ZIP</span>
                </div>
                <div className="archive-upload-percent">
                  <strong>{archiveUpload.percent}%</strong>
                  <span>{archiveUploadStatus}</span>
                </div>
              </div>
              <div className="archive-upload-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={archiveUpload.percent}>
                <span style={{ width: `${archiveUpload.percent}%` }} />
              </div>
              <div className="archive-upload-stats">
                <div>
                  <small>{archiveUpload.phase === 'selected' ? (isRu ? 'Размер' : 'Size') : (isRu ? 'Осталось' : 'Remaining')}</small>
                  <strong>{archiveRemainingLabel}</strong>
                </div>
                <div>
                  <small>{isRu ? 'Время' : 'Time left'}</small>
                  <strong>{archiveUploadEtaLabel}</strong>
                </div>
                <div>
                  <small>{isRu ? 'Скорость' : 'Speed'}</small>
                  <strong>{archiveUploadSpeedLabel}</strong>
                </div>
              </div>
            </div>
          ) : null}

          <ToolbarRow>
            <label className="signal-muted"><input type="radio" name="publishMode" checked={archiveOptions.publishMode === 'approved'} onChange={() => patchArchiveOption('publishMode', 'approved')} /> {isRu ? 'Сразу публиковать' : 'Publish immediately'}</label>
            <label className="signal-muted"><input type="radio" name="publishMode" checked={archiveOptions.publishMode === 'pending'} onChange={() => patchArchiveOption('publishMode', 'pending')} /> {isRu ? 'Отправить на модерацию' : 'Send to moderation'}</label>
          </ToolbarRow>

          <ToolbarRow>
            <label className="signal-muted"><input type="checkbox" checked={archiveOptions.useFilenameAsTitle} onChange={(event) => patchArchiveOption('useFilenameAsTitle', event.target.checked)} /> {isRu ? 'Имя файла как название' : 'Filename as title'}</label>
            <label className="signal-muted"><input type="checkbox" checked={archiveOptions.skipDuplicates} onChange={(event) => patchArchiveOption('skipDuplicates', event.target.checked)} /> {isRu ? 'Пропускать дубликаты' : 'Skip duplicates'}</label>
            <label className="signal-muted"><input type="checkbox" checked={archiveOptions.preserveFolders} onChange={(event) => patchArchiveOption('preserveFolders', event.target.checked)} /> {isRu ? 'Сохранять папки' : 'Preserve folders'}</label>
          </ToolbarRow>

          <ToolbarRow>
            <label className="signal-muted">
              {isRu ? 'Дата:' : 'Date:'}{' '}
              <select className="signal-field signal-select" value={archiveOptions.dateMode} onChange={(event) => patchArchiveOption('dateMode', event.target.value as ArchiveOptions['dateMode'])}>
                <option value="metadata">{isRu ? 'Из metadata, потом filename/manual' : 'Metadata, then filename/manual'}</option>
                <option value="filename">{isRu ? 'Из имени файла, потом manual' : 'Filename, then manual'}</option>
                <option value="manual">{isRu ? 'Одна дата вручную для всех' : 'Manual date for all'}</option>
                <option value="none">{isRu ? 'Не указывать дату' : 'No date'}</option>
              </select>
            </label>
            <label className="signal-muted">
              {isRu ? 'Дата вручную:' : 'Manual date:'}{' '}
              <input className="signal-field" type="datetime-local" value={archiveOptions.manualCapturedAt} onChange={(event) => patchArchiveOption('manualCapturedAt', event.target.value)} />
            </label>
            <FieldInput value={archiveOptions.timezone} onChange={(event) => patchArchiveOption('timezone', event.target.value)} placeholder="Asia/Tashkent" />
          </ToolbarRow>

          <ToolbarRow>
            <label className="signal-muted">
              {isRu ? 'Группы:' : 'Groups:'}{' '}
              <select className="signal-field signal-select" value={archiveOptions.groupMode} onChange={(event) => patchArchiveOption('groupMode', event.target.value as ArchiveOptions['groupMode'])}>
                <option value="first_folder">{isRu ? 'Первая папка' : 'First folder'}</option>
                <option value="full_path">{isRu ? 'Весь путь папки' : 'Full folder path'}</option>
                <option value="none">{isRu ? 'Без групп' : 'No groups'}</option>
              </select>
            </label>
            <FieldInput value={archiveOptions.defaultCredit} onChange={(event) => patchArchiveOption('defaultCredit', event.target.value)} placeholder={isRu ? 'Автор / credit для всех' : 'Author / credit for all'} />
          </ToolbarRow>

          <FieldInput
            value={archiveOptions.captionTemplate}
            onChange={(event) => patchArchiveOption('captionTemplate', event.target.value)}
            placeholder="{group} · {date} {time}"
          />
          <div className="signal-muted">
            {isRu ? 'Шаблон подписи поддерживает:' : 'Caption template supports:'} {'{filename} {title} {folder} {group} {date} {time} {datetime} {size} {index} {eventTitle}'}
          </div>

          <button className="btn btn-primary btn-sm" type="submit" disabled={archiveStarting || !archiveFile}>
            {archiveStarting ? (isRu ? 'Запускаем...' : 'Starting...') : (isRu ? 'Запустить импорт архива' : 'Start archive import')}
          </button>
        </form>

        {archiveError ? <Notice tone="danger">{archiveError}</Notice> : null}
      </Panel>

      {activeArchiveJob ? (
        <Panel variant="elevated" className="admin-command-panel">
          <SectionHeader title={isRu ? 'Текущая обработка архива' : 'Current archive processing'} subtitle={`${activeArchiveJob.originalFilename} · ${jobStatusLabel(activeArchiveJob.status, isRu)}`} />
          <div className="archive-processing-card">
            <div className="archive-processing-head">
              <div>
                <small>{isRu ? 'Серверная обработка' : 'Server processing'}</small>
                <strong>{jobStatusLabel(activeArchiveJob.status, isRu)}</strong>
              </div>
              <span>{runningProgress}%</span>
            </div>
            <div className="archive-upload-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={runningProgress}>
              <span style={{ width: `${runningProgress}%` }} />
            </div>
            <div className="archive-upload-stats">
              <div>
                <small>{isRu ? 'Готово' : 'Done'}</small>
                <strong>{archiveProcessingStats?.done ?? 0}{archiveProcessingStats?.total ? ` / ${archiveProcessingStats.total}` : ''}</strong>
              </div>
              <div>
                <small>{isRu ? 'Осталось' : 'Remaining'}</small>
                <strong>{archiveProcessingStats?.total ? archiveProcessingStats.remaining : (isRu ? 'считаем файлы' : 'counting files')}</strong>
              </div>
              <div>
                <small>{isRu ? 'Итоги' : 'Results'}</small>
                <strong>{isRu ? 'импорт' : 'import'} {activeArchiveJob.importedCount} · {isRu ? 'ошибки' : 'failed'} {activeArchiveJob.failedCount}</strong>
              </div>
            </div>
            <div className="signal-muted">
              {isRu ? 'Пропущено' : 'Skipped'}: {activeArchiveJob.skippedCount} · {isRu ? 'дубликатов' : 'duplicates'}: {activeArchiveJob.duplicateCount}
            </div>
          </div>
          <ToolbarRow>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => eventMediaApi.imports.downloadReport(eventId, activeArchiveJob.id)}>{isRu ? 'Скачать CSV-отчёт' : 'Download CSV report'}</button>
            {isRunningJob(activeArchiveJob) ? <button className="btn btn-ghost btn-sm" type="button" disabled={archiveBusyId === activeArchiveJob.id} onClick={() => void cancelImport(activeArchiveJob)}>{isRu ? 'Отменить' : 'Cancel'}</button> : null}
            {!isRunningJob(activeArchiveJob) ? <button className="btn btn-ghost btn-sm" type="button" disabled={archiveBusyId === activeArchiveJob.id} onClick={() => void rollbackImport(activeArchiveJob)}>{isRu ? 'Откатить импорт' : 'Rollback import'}</button> : null}
          </ToolbarRow>
        </Panel>
      ) : null}

      <Panel variant="elevated" className="admin-command-panel">
        <SectionHeader title={isRu ? 'История импортов' : 'Import history'} subtitle={isRu ? 'Последние ZIP-архивы и результаты обработки' : 'Recent ZIP archives and processing results'} />
        {archiveLoading ? <LoadingLines rows={4} /> : archiveJobs.length ? (
          <div className="admin-event-media-list">
            {archiveJobs.map((job) => (
              <article className="admin-event-media-card" key={job.id}>
                <div className="admin-event-media-body">
                  <div className="admin-event-media-title-row">
                    <strong>{job.originalFilename}</strong>
                    <span className="badge badge-muted">{jobStatusLabel(job.status, isRu)}</span>
                  </div>
                  <div className="signal-muted">
                    {isRu ? 'Импортировано' : 'Imported'}: {job.importedCount} · {isRu ? 'дубликатов' : 'duplicates'}: {job.duplicateCount} · {isRu ? 'пропущено' : 'skipped'}: {job.skippedCount} · {isRu ? 'ошибок' : 'failed'}: {job.failedCount}
                  </div>
                  <ToolbarRow>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setActiveArchiveJob(job)}>{isRu ? 'Открыть статус' : 'Open status'}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => eventMediaApi.imports.downloadReport(eventId, job.id)}>CSV</button>
                    {isRunningJob(job) ? <button className="btn btn-ghost btn-sm" type="button" disabled={archiveBusyId === job.id} onClick={() => void cancelImport(job)}>{isRu ? 'Отменить' : 'Cancel'}</button> : null}
                    {!isRunningJob(job) ? <button className="btn btn-ghost btn-sm" type="button" disabled={archiveBusyId === job.id} onClick={() => void rollbackImport(job)}>{isRu ? 'Откатить' : 'Rollback'}</button> : null}
                    {!isRunningJob(job) ? <button className="btn btn-ghost btn-sm" type="button" disabled={archiveBusyId === job.id} onClick={() => void deleteImport(job, false)}>{isRu ? 'Удалить запись' : 'Delete record'}</button> : null}
                    {!isRunningJob(job) ? <button className="btn btn-ghost btn-sm" type="button" disabled={archiveBusyId === job.id} onClick={() => void deleteImport(job, true)}>{isRu ? 'Удалить с медиа' : 'Delete with media'}</button> : null}
                  </ToolbarRow>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={isRu ? 'Импортов пока нет' : 'No imports yet'} description={isRu ? 'Загрузите первый архив с медиа.' : 'Upload the first media archive.'} />
        )}
      </Panel>
    </div>
  );
}
