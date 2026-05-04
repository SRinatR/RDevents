'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventMediaApi, type EventMediaImportJob } from '@/lib/api';
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
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function jobProgress(job: EventMediaImportJob) {
  const done = job.importedCount + job.skippedCount + job.failedCount;
  const total = Math.max(job.mediaEntries, done, 1);
  return Math.min(100, Math.round((done / total) * 100));
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
  const [archiveOptions, setArchiveOptions] = useState<ArchiveOptions>(DEFAULT_ARCHIVE_OPTIONS);
  const [archiveJobs, setArchiveJobs] = useState<EventMediaImportJob[]>([]);
  const [activeArchiveJob, setActiveArchiveJob] = useState<EventMediaImportJob | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveStarting, setArchiveStarting] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [notice, setNotice] = useState('');

  const bulkTotalSize = useMemo(() => bulkFiles.reduce((sum, file) => sum + file.size, 0), [bulkFiles]);

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

      const result = await eventMediaApi.imports.start(eventId, formData);
      setActiveArchiveJob(result.job);
      setArchiveJobs((current) => [result.job, ...current.filter((job) => job.id !== result.job.id)]);
      setNotice(isRu ? 'Архив поставлен в обработку.' : 'Archive import has started.');
    } catch (err: any) {
      setArchiveError(getFriendlyApiErrorMessage(err, locale));
    } finally {
      setArchiveStarting(false);
    }
  }

  function patchArchiveOption<K extends keyof ArchiveOptions>(key: K, value: ArchiveOptions[K]) {
    setArchiveOptions((current) => ({ ...current, [key]: value }));
  }

  const runningProgress = activeArchiveJob ? jobProgress(activeArchiveJob) : 0;

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
            <small>{isRu ? 'До 500 MB, до 1000 файлов внутри' : 'Up to 500 MB, up to 1000 entries inside'}</small>
            <input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={handleArchiveFileChange} />
          </label>

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

          <Notice tone="info">
            {isRu
              ? 'Сейчас дата и группы попадают в подпись и CSV-отчёт. Постоянные поля capturedAt/groupTitle/downloadEnabled будут добавлены отдельной миграцией БД.'
              : 'Date and groups currently go into captions and the CSV report. Persistent capturedAt/groupTitle/downloadEnabled fields will be added in a separate DB migration.'}
          </Notice>

          <button className="btn btn-primary btn-sm" type="submit" disabled={archiveStarting || !archiveFile}>
            {archiveStarting ? (isRu ? 'Запускаем...' : 'Starting...') : (isRu ? 'Запустить импорт архива' : 'Start archive import')}
          </button>
        </form>

        {archiveError ? <Notice tone="danger">{archiveError}</Notice> : null}
      </Panel>

      {activeArchiveJob ? (
        <Panel variant="elevated" className="admin-command-panel">
          <SectionHeader title={isRu ? 'Текущая обработка архива' : 'Current archive processing'} subtitle={`${activeArchiveJob.originalFilename} · ${jobStatusLabel(activeArchiveJob.status, isRu)}`} />
          <div className="signal-muted">
            {isRu ? 'Прогресс' : 'Progress'}: {runningProgress}% · {isRu ? 'импортировано' : 'imported'}: {activeArchiveJob.importedCount} · {isRu ? 'пропущено' : 'skipped'}: {activeArchiveJob.skippedCount} · {isRu ? 'ошибок' : 'failed'}: {activeArchiveJob.failedCount}
          </div>
          <ToolbarRow>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => eventMediaApi.imports.downloadReport(eventId, activeArchiveJob.id)}>
              {isRu ? 'Скачать CSV-отчёт' : 'Download CSV report'}
            </button>
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
