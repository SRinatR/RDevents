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
const DEFAULT_CAPTION_TEMPLATE = '{date} {time}';

type ImportDateMode = 'metadata' | 'filename' | 'manual' | 'none';
type ImportGroupMode = 'none' | 'first_folder' | 'full_path';

type ImportOptions = {
  publishMode: 'approved' | 'pending';
  useFilenameAsTitle: boolean;
  skipDuplicates: boolean;
  preserveFolders: boolean;
  dateMode: ImportDateMode;
  manualCapturedAt: string | null;
  timezone: string | null;
  groupMode: ImportGroupMode;
  captionTemplate: string | null;
  defaultCredit: string | null;
};

type CapturedAtResult = {
  value: Date | null;
  source: 'METADATA' | 'FILENAME' | 'MANUAL' | 'NONE';
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
  capturedAt?: string | null;
  capturedAtSource?: string | null;
  groupKey?: string | null;
  groupTitle?: string | null;
  title?: string | null;
  caption?: string | null;
  credit?: string | null;
  metadataJson?: Record<string, unknown> | null;
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

function normalizeText(value: unknown, maxLength = 1000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeDateMode(value: unknown): ImportDateMode {
  if (value === 'filename' || value === 'manual' || value === 'none') return value;
  return 'metadata';
}

function normalizeGroupMode(value: unknown): ImportGroupMode {
  if (value === 'first_folder' || value === 'full_path') return value;
  return 'none';
}

function normalizeImportOptions(input: Record<string, unknown> = {}): ImportOptions {
  return {
    publishMode: input['publishMode'] === 'pending' ? 'pending' : 'approved',
    useFilenameAsTitle: parseBoolean(input['useFilenameAsTitle'], true),
    skipDuplicates: parseBoolean(input['skipDuplicates'], true),
    preserveFolders: parseBoolean(input['preserveFolders'], false),
    dateMode: normalizeDateMode(input['dateMode']),
    manualCapturedAt: normalizeText(input['manualCapturedAt'], 80),
    timezone: normalizeText(input['timezone'], 80),
    groupMode: normalizeGroupMode(input['groupMode']),
    captionTemplate: normalizeText(input['captionTemplate'], 400) ?? DEFAULT_CAPTION_TEMPLATE,
    defaultCredit: normalizeText(input['defaultCredit'], 120),
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

function normalizeArchivePath(archivePath: string) {
  return archivePath.replace(/\\/g, '/').replace(/^\.\//, '');
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

function parseManualCapturedAt(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseExifDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFilenameDate(filename: string): Date | null {
  const base = path.basename(filename, path.extname(filename));
  const compact = base.match(/(?:IMG|VID|PHOTO|VIDEO|DSC|PXL)?[_-]?(20\d{2})([01]\d)([0-3]\d)[_ -]?([0-2]\d)([0-5]\d)([0-5]\d)?/i);
  if (compact) {
    const [, year, month, day, hour, minute, second = '00'] = compact;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const separated = base.match(/(20\d{2})[-_.]([01]\d)[-_.]([0-3]\d)(?:[ T_-]([0-2]\d)[-_.:]?([0-5]\d)(?:[-_.:]?([0-5]\d))?)?/);
  if (!separated) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = separated;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function readUInt16(buffer: Buffer, offset: number, littleEndian: boolean) {
  if (offset + 2 > buffer.length) return 0;
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer: Buffer, offset: number, littleEndian: boolean) {
  if (offset + 4 > buffer.length) return 0;
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function readAsciiFromTiff(buffer: Buffer, tiffStart: number, entryOffset: number, littleEndian: boolean) {
  const type = readUInt16(buffer, entryOffset + 2, littleEndian);
  const count = readUInt32(buffer, entryOffset + 4, littleEndian);
  if (type !== 2 || count <= 1 || count > 64) return null;
  const valueOffset = count <= 4 ? entryOffset + 8 : tiffStart + readUInt32(buffer, entryOffset + 8, littleEndian);
  if (valueOffset < 0 || valueOffset + count > buffer.length) return null;
  return buffer.subarray(valueOffset, valueOffset + count).toString('ascii').replace(/\0/g, '').trim() || null;
}

function findExifDateInIfd(buffer: Buffer, tiffStart: number, ifdOffset: number, littleEndian: boolean): { dateText: string | null; exifIfdOffset: number | null } {
  const absoluteIfdOffset = tiffStart + ifdOffset;
  if (absoluteIfdOffset < 0 || absoluteIfdOffset + 2 > buffer.length) return { dateText: null, exifIfdOffset: null };
  const entryCount = readUInt16(buffer, absoluteIfdOffset, littleEndian);
  let dateText: string | null = null;
  let exifIfdOffset: number | null = null;

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = absoluteIfdOffset + 2 + index * 12;
    if (entryOffset + 12 > buffer.length) break;
    const tag = readUInt16(buffer, entryOffset, littleEndian);
    if (tag === 0x0132 || tag === 0x9003 || tag === 0x9004) {
      dateText = readAsciiFromTiff(buffer, tiffStart, entryOffset, littleEndian) ?? dateText;
    }
    if (tag === 0x8769) exifIfdOffset = readUInt32(buffer, entryOffset + 8, littleEndian);
  }

  return { dateText, exifIfdOffset };
}

function extractJpegExifDate(buffer: Buffer): Date | null {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const segmentStart = offset + 4;
    const segmentEnd = offset + 2 + length;
    if (length < 2 || segmentEnd > buffer.length) break;

    if (marker === 0xe1 && buffer.subarray(segmentStart, segmentStart + 6).toString('ascii') === 'Exif\0\0') {
      const tiffStart = segmentStart + 6;
      const byteOrder = buffer.subarray(tiffStart, tiffStart + 2).toString('ascii');
      const littleEndian = byteOrder === 'II';
      if (!littleEndian && byteOrder !== 'MM') return null;
      const firstIfdOffset = readUInt32(buffer, tiffStart + 4, littleEndian);
      const firstIfd = findExifDateInIfd(buffer, tiffStart, firstIfdOffset, littleEndian);
      const exifIfd = firstIfd.exifIfdOffset ? findExifDateInIfd(buffer, tiffStart, firstIfd.exifIfdOffset, littleEndian) : null;
      return parseExifDateTime(exifIfd?.dateText ?? firstIfd.dateText);
    }

    offset = segmentEnd;
  }
  return null;
}

function detectCapturedAt(buffer: Buffer, originalFilename: string, mimeType: string, options: ImportOptions): CapturedAtResult {
  const manual = parseManualCapturedAt(options.manualCapturedAt);
  const filenameDate = parseFilenameDate(originalFilename);
  const metadataDate = mimeType === 'image/jpeg' ? extractJpegExifDate(buffer) : null;

  if (options.dateMode === 'none') return { value: null, source: 'NONE' };
  if (options.dateMode === 'manual') return manual ? { value: manual, source: 'MANUAL' } : { value: null, source: 'NONE' };
  if (options.dateMode === 'filename') {
    if (filenameDate) return { value: filenameDate, source: 'FILENAME' };
    if (manual) return { value: manual, source: 'MANUAL' };
    return { value: null, source: 'NONE' };
  }

  if (metadataDate) return { value: metadataDate, source: 'METADATA' };
  if (filenameDate) return { value: filenameDate, source: 'FILENAME' };
  if (manual) return { value: manual, source: 'MANUAL' };
  return { value: null, source: 'NONE' };
}

function groupInfoFromArchivePath(archivePath: string, mode: ImportGroupMode) {
  if (mode === 'none') return { groupKey: null, groupTitle: null };
  const normalized = normalizeArchivePath(archivePath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return { groupKey: null, groupTitle: null };
  const groupKey = mode === 'first_folder' ? parts[0] : parts.slice(0, -1).join('/');
  if (!groupKey) return { groupKey: null, groupTitle: null };
  const groupTitle = groupKey
    .split('/')
    .map((part) => part.replace(/[_-]+/g, ' ').trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
    .slice(0, 120);
  return { groupKey: groupKey.slice(0, 180), groupTitle: groupTitle || groupKey.slice(0, 120) };
}

function formatCapturedDate(date: Date | null, options: ImportOptions, locale = 'ru-RU') {
  if (!date) return { date: '', time: '', datetime: '' };
  const timeZone = options.timezone || 'UTC';
  const datePart = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone });
  const timePart = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone });
  return { date: datePart, time: timePart, datetime: `${datePart} ${timePart}` };
}

function renderCaptionTemplate(template: string | null, variables: Record<string, string | null | undefined>) {
  if (!template) return null;
  const rendered = template.replace(/\{(filename|title|folder|group|date|time|datetime|size|index|eventTitle)\}/g, (_, key: string) => variables[key] ?? '');
  const normalized = rendered.replace(/\s+·\s+·\s+/g, ' · ').replace(/^\s*[·-]\s*/, '').replace(/\s*[·-]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return normalized ? normalized.slice(0, 1000) : null;
}

function humanSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function metadataJsonForImport(report: ImportItemReport, options: ImportOptions, extra: Record<string, unknown>) {
  return JSON.stringify({
    import: {
      archivePath: report.archivePath,
      originalFilename: report.originalFilename,
      capturedAtSource: report.capturedAtSource,
      groupKey: report.groupKey,
      groupTitle: report.groupTitle,
      timezone: options.timezone,
      dateMode: options.dateMode,
      groupMode: options.groupMode,
      captionTemplate: options.captionTemplate,
      ...extra,
    },
  });
}

async function persistEventMediaMetadata(mediaId: string, report: ImportItemReport, options: ImportOptions) {
  try {
    await prisma.$executeRaw`
      UPDATE "event_media"
      SET
        "capturedAt" = ${report.capturedAt ? new Date(report.capturedAt) : null},
        "capturedAtSource" = ${report.capturedAtSource ?? null},
        "capturedTimezone" = ${options.timezone ?? null},
        "groupKey" = ${report.groupKey ?? null},
        "groupTitle" = ${report.groupTitle ?? null},
        "downloadEnabled" = true,
        "metadataJson" = ${metadataJsonForImport(report, options, { persistedAt: new Date().toISOString() })}::jsonb
      WHERE "id" = ${mediaId}
    `;
  } catch {
    // Metadata persistence is additive. Keep imports working even if migrations
    // have not been applied yet in a local/dev environment.
  }
}

async function persistImportItemMetadata(importItemId: string, report: ImportItemReport) {
  try {
    await prisma.$executeRaw`
      UPDATE "event_media_import_items"
      SET
        "capturedAt" = ${report.capturedAt ? new Date(report.capturedAt) : null},
        "capturedAtSource" = ${report.capturedAtSource ?? null},
        "groupKey" = ${report.groupKey ?? null},
        "groupTitle" = ${report.groupTitle ?? null},
        "title" = ${report.title ?? null},
        "caption" = ${report.caption ?? null},
        "credit" = ${report.credit ?? null}
      WHERE "id" = ${importItemId}
    `;
  } catch {
    // See persistEventMediaMetadata: import item metadata is best-effort until
    // every environment has run the migration.
  }
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

  const reportRows = Array.isArray(job.reportJson) && job.reportJson.length > 0 ? job.reportJson as ImportItemReport[] : job.items;
  const header = ['archivePath', 'originalFilename', 'status', 'reasonCode', 'reasonMessage', 'mediaId', 'mimeType', 'sizeBytes', 'checksumSha256', 'capturedAt', 'capturedAtSource', 'groupKey', 'groupTitle', 'title', 'caption', 'credit'];
  const rows = reportRows.map((item: any) => [
    item.archivePath,
    item.originalFilename,
    item.status,
    item.reasonCode,
    item.reasonMessage,
    item.mediaId,
    item.mimeType,
    item.sizeBytes,
    item.checksumSha256,
    item.capturedAt,
    item.capturedAtSource,
    item.groupKey,
    item.groupTitle,
    item.title,
    item.caption,
    item.credit,
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

async function createImportItem(jobId: string, eventId: string, report: ImportItemReport) {
  const created = await prisma.eventMediaImportItem.create({
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
  await persistImportItemMetadata(created.id, report);
  return created;
}

async function processEventMediaImportJob(jobId: string, actor: User) {
  const job = await prisma.eventMediaImportJob.findUnique({
    where: { id: jobId },
    include: { archiveAsset: true, event: { select: { title: true } } },
  });
  if (!job || !job.archiveAsset) return;

  const options = normalizeImportOptions((job.optionsJson ?? {}) as Record<string, unknown>);
  await prisma.eventMediaImportJob.update({ where: { id: job.id }, data: { status: 'PROCESSING', startedAt: new Date() } });

  const archiveBuffer = await readStoredFile(job.archiveAsset.storageKey);
  const zip = await JSZip.loadAsync(archiveBuffer);
  const entries = Object.values(zip.files);
  const report: ImportItemReport[] = [];
  let totalUncompressedSize = 0;
  let mediaIndex = 0;

  await prisma.eventMediaImportJob.update({ where: { id: job.id }, data: { totalEntries: entries.length } });

  if (entries.length > MAX_ENTRIES) throw new EventMediaImportError(`Archive contains more than ${MAX_ENTRIES} entries`, 'EVENT_MEDIA_IMPORT_TOO_MANY_ENTRIES');

  for (const entry of entries) {
    const archivePath = entry.name;
    if (entry.dir || isIgnoredArchivePath(archivePath)) continue;

    const currentJob = await prisma.eventMediaImportJob.findUnique({ where: { id: job.id }, select: { status: true } });
    if (currentJob?.status === 'CANCELLED') return;

    const normalizedArchivePath = normalizeArchivePath(archivePath);
    const originalFilename = options.preserveFolders ? normalizedArchivePath : path.posix.basename(normalizedArchivePath);
    const group = groupInfoFromArchivePath(normalizedArchivePath, options.groupMode);

    if (isUnsafeArchivePath(archivePath)) {
      const item: ImportItemReport = { archivePath, originalFilename, groupKey: group.groupKey, groupTitle: group.groupTitle, status: 'FAILED', reasonCode: 'ZIP_SLIP', reasonMessage: 'Unsafe archive path' };
      report.push(item);
      await createImportItem(job.id, job.eventId, item);
      continue;
    }

    const mimeType = inferMimeType(originalFilename);
    if (!mimeType || !EVENT_MEDIA_ALLOWED_MIME_TYPES.has(mimeType)) {
      const item: ImportItemReport = { archivePath, originalFilename, groupKey: group.groupKey, groupTitle: group.groupTitle, mimeType, status: 'SKIPPED_UNSUPPORTED_TYPE', reasonCode: 'UNSUPPORTED_TYPE', reasonMessage: 'Unsupported media type' };
      report.push(item);
      await createImportItem(job.id, job.eventId, item);
      continue;
    }

    try {
      const buffer = await entry.async('nodebuffer');
      totalUncompressedSize += buffer.length;

      if (buffer.length === 0 || buffer.length > MAX_SINGLE_MEDIA_SIZE_BYTES) {
        const item: ImportItemReport = {
          archivePath,
          originalFilename,
          groupKey: group.groupKey,
          groupTitle: group.groupTitle,
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

      if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED_SIZE_BYTES) throw new EventMediaImportError('Archive uncompressed size limit exceeded', 'EVENT_MEDIA_IMPORT_UNCOMPRESSED_TOO_LARGE');

      const checksumSha256 = createHash('sha256').update(buffer).digest('hex');
      if (options.skipDuplicates) {
        const duplicate = await prisma.mediaAsset.findFirst({
          where: { checksumSha256, eventMedia: { eventId: job.eventId } },
          select: { id: true, eventMedia: { select: { id: true } } },
        });
        if (duplicate) {
          const item: ImportItemReport = {
            archivePath,
            originalFilename,
            groupKey: group.groupKey,
            groupTitle: group.groupTitle,
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

      mediaIndex += 1;
      const detectedDate = detectCapturedAt(buffer, originalFilename, mimeType, options);
      const title = options.useFilenameAsTitle ? titleFromFilename(originalFilename) : null;
      const formattedDate = formatCapturedDate(detectedDate.value, options);
      const caption = renderCaptionTemplate(options.captionTemplate, {
        filename: path.posix.basename(originalFilename),
        title,
        folder: group.groupKey,
        group: group.groupTitle,
        date: formattedDate.date,
        time: formattedDate.time,
        datetime: formattedDate.datetime,
        size: humanSize(buffer.length),
        index: String(mediaIndex),
        eventTitle: job.event?.title,
      });

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
        { title: title ?? undefined, caption: caption ?? undefined, credit: options.defaultCredit ?? undefined, altText: title ?? caption ?? undefined },
        { mode: 'admin', forceStatus: options.publishMode === 'pending' ? 'PENDING' : 'APPROVED' },
      );

      const baseItem: ImportItemReport = {
        archivePath,
        originalFilename,
        groupKey: group.groupKey,
        groupTitle: group.groupTitle,
        mimeType,
        sizeBytes: buffer.length,
        checksumSha256,
        mediaId: media.id,
        capturedAt: detectedDate.value?.toISOString() ?? null,
        capturedAtSource: detectedDate.source,
        title,
        caption,
        credit: options.defaultCredit,
        status: 'IMPORTED',
      };
      const item: ImportItemReport = {
        ...baseItem,
        metadataJson: JSON.parse(metadataJsonForImport(baseItem, options, { mimeType, sizeBytes: buffer.length, checksumSha256 })) as Record<string, unknown>,
      };
      report.push(item);
      await persistEventMediaMetadata(media.id, item, options);
      await createImportItem(job.id, job.eventId, item);
    } catch (err: any) {
      const item: ImportItemReport = {
        archivePath,
        originalFilename,
        groupKey: group.groupKey,
        groupTitle: group.groupTitle,
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
  await prisma.eventMediaImportJob.update({
    where: { id: job.id },
    data: {
      status: failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      completedAt: new Date(),
      reportJson: report as any,
    },
  });
}

async function updateJobCounters(jobId: string) {
  const rows = await prisma.eventMediaImportItem.groupBy({ by: ['status'], where: { jobId }, _count: true });
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
