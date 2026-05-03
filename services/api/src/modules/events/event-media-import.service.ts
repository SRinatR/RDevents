import { createHash, randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import type { User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { readStoredFile, saveUploadedFile } from '../../common/storage.js';
import { EVENT_MEDIA_ALLOWED_MIME_TYPES, EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB, uploadEventMedia } from './event-media.service.js';

const ARCHIVE_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'multipart/x-zip']);
const MAX_ARCHIVE_SIZE_MB = 500;
const MAX_ENTRIES = 1000;
const MAX_TOTAL_UNCOMPRESSED_SIZE_BYTES = 4096 * 1024 * 1024;
const MAX_SINGLE_MEDIA_SIZE_BYTES = EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB * 1024 * 1024;
const IGNORED_FILENAMES = new Set(['.DS_Store', 'Thumbs.db']);

type ImportOptions = {
  publishMode: 'approved' | 'pending';
  useFilenameAsTitle: boolean;
  skipDuplicates: boolean;
  preserveFolders: boolean;
};

type ImportItemReport = {
  archivePath: string;
  originalFilename: string;
  status: string;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  mediaId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
};

export class EventMediaImportError extends Error {
  constructor(message: string, public code = 'EVENT_MEDIA_IMPORT_INVALID') {
    super(message);
    this.name = 'EventMediaImportError';
  }
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1';
}

function normalizeImportOptions(input: Record<string, unknown> = {}): ImportOptions {
  const publishMode = input['publishMode'] === 'pending' ? 'pending' : 'approved';
  return {
    publishMode,
    useFilenameAsTitle: parseBoolean(input['useFilenameAsTitle'], true),
    skipDuplicates: parseBoolean(input['skipDuplicates'], true),
    preserveFolders: parseBoolean(input['preserveFolders'], false),
  };
}

function assertZipArchive(file: Express.Multer.File | undefined) {
  if (!file || !file.path || file.size <= 0) {
    throw new EventMediaImportError('Archive is required', 'EVENT_MEDIA_IMPORT_ARCHIVE_REQUIRED');
  }
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (extension !== '.zip' || !ARCHIVE_MIME_TYPES.has(file.mimetype)) {
    throw new EventMediaImportError('Only .zip archives are supported', 'EVENT_MEDIA_IMPORT_UNSUPPORTED_ARCHIVE');
  }
  if (file.size > MAX_ARCHIVE_SIZE_MB * 1024 * 1024) {
    throw new EventMediaImportError(`Archive must be ${MAX_ARCHIVE_SIZE_MB} MB or smaller`, 'EVENT_MEDIA_IMPORT_ARCHIVE_TOO_LARGE');
  }
}

function isIgnoredArchivePath(archivePath: string) {
  const normalized = archivePath.replace(/\\/g, '/');
  const filename = path.posix.basename(normalized);
  return normalized.startsWith('__MACOSX/') || IGNORED_FILENAMES.has(filename);
}

function isUnsafeArchivePath(archivePath: string) {
  const normalized = archivePath.replace(/\\/g, '/');
  return path.posix.isAbsolute(normalized) || normalized.split('/').some((part) => part === '..');
}

function inferMimeType(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.webm') return 'video/webm';
  if (extension === '.mov' || extension === '.qt') return 'video/quicktime';
  return null;
}

function titleFromFilename(filename: string) {
  return path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim().slice(0, 120) || null;
}

function csvEscape(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function serializeJob(job: any) {
  return {
    id: job.id,
    eventId: job.eventId,
    status: job.status,
    originalFilename: job.originalFilename,
    totalEntries: job.totalEntries,
    mediaEntries: job.mediaEntries,
    importedCount: job.importedCount,
    skippedCount: job.skippedCount,
    failedCount: job.failedCount,
    duplicateCount: job.duplicateCount,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    errorMessage: job.errorMessage,
    optionsJson: job.optionsJson,
    reportJson: job.reportJson,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    items: job.items,
  };
}

export async function startEventMediaImport(eventId: string, actor: User, file: Express.Multer.File | undefined, body: Record<string, unknown> = {}) {
  assertZipArchive(file);
  const archive = file!;
  const options = normalizeImportOptions(body);
  const archiveBuffer = await readFile(archive.path);
  const checksumSha256 = createHash('sha256').update(archiveBuffer).digest('hex');
  const saved = await saveUploadedFile({
    buffer: archiveBuffer,
    mimeType: archive.mimetype,
    originalFilename: archive.originalname || 'media-import.zip',
    folder: `events/${eventId}/media-imports`,
  });
  await rm(archive.path, { force: true });

  const archiveAsset = await prisma.mediaAsset.create({
    data: {
      ownerUserId: actor.id,
      purpose: 'EVENT_MEDIA',
      originalFilename: archive.originalname || 'media-import.zip',
      mimeType: archive.mimetype,
      sizeBytes: archive.size,
      storageDriver: saved.storageDriver,
      storageKey: saved.storageKey,
      publicUrl: saved.publicUrl,
      checksumSha256,
    },
  });

  const job = await prisma.eventMediaImportJob.create({
    data: {
      eventId,
      createdByUserId: actor.id,
      archiveAssetId: archiveAsset.id,
      originalFilename: archive.originalname || 'media-import.zip',
      optionsJson: options,
    },
  });

  setImmediate(() => {
    void processEventMediaImportJob(job.id, actor).catch(async (err) => {
      await prisma.eventMediaImportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : 'Import failed',
        },
      }).catch(() => undefined);
    });
  });

  return serializeJob(job);
}

export async function listEventMediaImports(eventId: string) {
  const jobs = await prisma.eventMediaImportJob.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return jobs.map(serializeJob);
}

export async function getEventMediaImport(eventId: string, jobId: string) {
  const job = await prisma.eventMediaImportJob.findFirst({
    where: { id: jobId, eventId },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  });
  if (!job) throw new Error('EVENT_MEDIA_IMPORT_NOT_FOUND');
  return serializeJob(job);
}

export async function cancelEventMediaImport(eventId: string, jobId: string) {
  const job = await prisma.eventMediaImportJob.findFirst({ where: { id: jobId, eventId } });
  if (!job) throw new Error('EVENT_MEDIA_IMPORT_NOT_FOUND');
  if (!['QUEUED', 'PROCESSING'].includes(job.status)) return serializeJob(job);

  const updated = await prisma.eventMediaImportJob.update({
    where: { id: job.id },
    data: { status: 'CANCELLED', completedAt: new Date() },
  });
  return serializeJob(updated);
}

export async function buildEventMediaImportCsv(eventId: string, jobId: string) {
  const job = await prisma.eventMediaImportJob.findFirst({
    where: { id: jobId, eventId },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  });
  if (!job) throw new Error('EVENT_MEDIA_IMPORT_NOT_FOUND');

  const header = ['archivePath', 'originalFilename', 'status', 'reasonCode', 'reasonMessage', 'mediaId', 'mimeType', 'sizeBytes', 'checksumSha256'];
  const rows = job.items.map((item: any) => [
    item.archivePath,
    item.originalFilename,
    item.status,
    item.reasonCode,
    item.reasonMessage,
    item.mediaId,
    item.mimeType,
    item.sizeBytes,
    item.checksumSha256,
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

async function createImportItem(jobId: string, eventId: string, report: ImportItemReport) {
  return prisma.eventMediaImportItem.create({
    data: {
      jobId,
      eventId,
      mediaId: report.mediaId ?? null,
      archivePath: report.archivePath,
      originalFilename: report.originalFilename,
      mimeType: report.mimeType ?? null,
      sizeBytes: report.sizeBytes ?? null,
      checksumSha256: report.checksumSha256 ?? null,
      status: report.status as any,
      reasonCode: report.reasonCode ?? null,
      reasonMessage: report.reasonMessage ?? null,
    },
  });
}

async function processEventMediaImportJob(jobId: string, actor: User) {
  const job = await prisma.eventMediaImportJob.findUnique({
    where: { id: jobId },
    include: { archiveAsset: true },
  });
  if (!job || !job.archiveAsset) return;

  const options = normalizeImportOptions((job.optionsJson ?? {}) as Record<string, unknown>);
  await prisma.eventMediaImportJob.update({
    where: { id: job.id },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });

  const archiveBuffer = await readStoredFile(job.archiveAsset.storageKey);
  const zip = await JSZip.loadAsync(archiveBuffer);
  const entries = Object.values(zip.files);
  const report: ImportItemReport[] = [];
  let totalUncompressedSize = 0;

  await prisma.eventMediaImportJob.update({
    where: { id: job.id },
    data: { totalEntries: entries.length },
  });

  if (entries.length > MAX_ENTRIES) {
    throw new EventMediaImportError(`Archive contains more than ${MAX_ENTRIES} entries`, 'EVENT_MEDIA_IMPORT_TOO_MANY_ENTRIES');
  }

  for (const entry of entries) {
    const archivePath = entry.name;
    if (entry.dir || isIgnoredArchivePath(archivePath)) continue;

    const currentJob = await prisma.eventMediaImportJob.findUnique({ where: { id: job.id }, select: { status: true } });
    if (currentJob?.status === 'CANCELLED') return;

    const originalFilename = options.preserveFolders ? archivePath : path.posix.basename(archivePath);
    if (isUnsafeArchivePath(archivePath)) {
      const item = {
        archivePath,
        originalFilename,
        status: 'FAILED',
        reasonCode: 'ZIP_SLIP',
        reasonMessage: 'Unsafe archive path',
      };
      report.push(item);
      await createImportItem(job.id, job.eventId, item);
      continue;
    }

    const mimeType = inferMimeType(originalFilename);
    if (!mimeType || !EVENT_MEDIA_ALLOWED_MIME_TYPES.has(mimeType)) {
      const item = {
        archivePath,
        originalFilename,
        mimeType,
        status: 'SKIPPED_UNSUPPORTED_TYPE',
        reasonCode: 'UNSUPPORTED_TYPE',
        reasonMessage: 'Unsupported media type',
      };
      report.push(item);
      await createImportItem(job.id, job.eventId, item);
      continue;
    }

    try {
      const buffer = await entry.async('nodebuffer');
      totalUncompressedSize += buffer.length;
      if (buffer.length === 0 || buffer.length > MAX_SINGLE_MEDIA_SIZE_BYTES) {
        const item = {
          archivePath,
          originalFilename,
          mimeType,
          sizeBytes: buffer.length,
          status: 'SKIPPED_TOO_LARGE',
          reasonCode: buffer.length === 0 ? 'EMPTY_FILE' : 'FILE_TOO_LARGE',
          reasonMessage: buffer.length === 0 ? 'Empty file' : 'Media file is too large',
        };
        report.push(item);
        await createImportItem(job.id, job.eventId, item);
        continue;
      }
      if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED_SIZE_BYTES) {
        throw new EventMediaImportError('Archive uncompressed size limit exceeded', 'EVENT_MEDIA_IMPORT_UNCOMPRESSED_TOO_LARGE');
      }

      const checksumSha256 = createHash('sha256').update(buffer).digest('hex');
      if (options.skipDuplicates) {
        const duplicate = await prisma.mediaAsset.findFirst({
          where: {
            checksumSha256,
            eventMedia: { eventId: job.eventId },
          },
          select: { id: true, eventMedia: { select: { id: true } } },
        });
        if (duplicate) {
          const item = {
            archivePath,
            originalFilename,
            mimeType,
            sizeBytes: buffer.length,
            checksumSha256,
            mediaId: duplicate.eventMedia?.id ?? null,
            status: 'SKIPPED_DUPLICATE',
            reasonCode: 'DUPLICATE_CHECKSUM',
            reasonMessage: 'Duplicate media checksum',
          };
          report.push(item);
          await createImportItem(job.id, job.eventId, item);
          continue;
        }
      }

      const fakeFile = {
        fieldname: 'file',
        originalname: path.posix.basename(originalFilename) || `${randomUUID()}.bin`,
        encoding: '7bit',
        mimetype: mimeType,
        size: buffer.length,
        buffer,
      } as Express.Multer.File;
      const media = await uploadEventMedia(
        job.eventId,
        actor,
        fakeFile,
        { title: options.useFilenameAsTitle ? titleFromFilename(originalFilename) : null },
        { mode: 'admin', forceStatus: options.publishMode === 'pending' ? 'PENDING' : 'APPROVED' },
      );
      const item = {
        archivePath,
        originalFilename,
        mimeType,
        sizeBytes: buffer.length,
        checksumSha256,
        mediaId: media.id,
        status: 'IMPORTED',
      };
      report.push(item);
      await createImportItem(job.id, job.eventId, item);
    } catch (err: any) {
      const item = {
        archivePath,
        originalFilename,
        mimeType,
        status: 'FAILED',
        reasonCode: err.code ?? err.message ?? 'IMPORT_FAILED',
        reasonMessage: err.message ?? 'Import failed',
      };
      report.push(item);
      await createImportItem(job.id, job.eventId, item);
    }

    await updateJobCounters(job.id);
  }

  await updateJobCounters(job.id);
  const failedCount = report.filter((item) => item.status === 'FAILED').length;
  const finalStatus = failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  await prisma.eventMediaImportJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      reportJson: report as any,
    },
  });
}

async function updateJobCounters(jobId: string) {
  const rows = await prisma.eventMediaImportItem.groupBy({
    by: ['status'],
    where: { jobId },
    _count: true,
  });
  const countByStatus = new Map(rows.map((row: any) => [row.status, row._count]));
  const importedCount = countByStatus.get('IMPORTED') ?? 0;
  const duplicateCount = countByStatus.get('SKIPPED_DUPLICATE') ?? 0;
  const failedCount = countByStatus.get('FAILED') ?? 0;
  const skippedCount = [...countByStatus.entries()]
    .filter(([status]) => String(status).startsWith('SKIPPED_'))
    .reduce((sum, [, count]) => sum + Number(count), 0);

  await prisma.eventMediaImportJob.update({
    where: { id: jobId },
    data: {
      mediaEntries: importedCount + skippedCount + failedCount,
      importedCount,
      skippedCount,
      failedCount,
      duplicateCount,
    },
  });
}
