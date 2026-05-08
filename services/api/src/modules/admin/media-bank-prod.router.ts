import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { Prisma, type User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../common/middleware.js';
import { canAccessEvent } from '../access-control/access-control.service.js';
import {
  EventMediaImportError,
  startEventMediaImport,
} from '../events/event-media-import.service.js';
import { resetEventMediaDisplayCounter } from '../events/event-media.service.js';
import {
  bulkUpdateEventMediaAdmin,
  deleteEventMediaImportAdmin,
  rollbackEventMediaImportAdmin,
  updateEventMediaImportAdmin,
} from '../events/event-media-import-admin.service.js';

export const adminMediaBankProdRouter = Router({ mergeParams: true });

const MAX_ARCHIVE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const IMPORT_SERVICE_COMPAT_SIZE_BYTES = 500 * 1024 * 1024;
const MEDIA_STATUS_FILTERS = new Set(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'DELETED']);
const MEDIA_TYPE_FILTERS = new Set(['all', 'image', 'video']);
const MEDIA_ALBUM_FILTER_UNASSIGNED = 'UNASSIGNED';

const mediaImportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      const dir = path.join(os.tmpdir(), 'rdevents-media-imports');
      mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (_req, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(-120) || 'archive.zip';
      callback(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: MAX_ARCHIVE_SIZE_BYTES,
    files: 1,
    fields: 30,
    fieldSize: 64 * 1024,
  },
});

function handleImportArchiveUpload(upload: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        const code = err.code === 'LIMIT_FILE_SIZE'
          ? 'EVENT_MEDIA_IMPORT_UPLOAD_TOO_LARGE'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'EVENT_MEDIA_IMPORT_ARCHIVE_REQUIRED'
            : 'EVENT_MEDIA_IMPORT_UPLOAD_INVALID';
        const error = err.code === 'LIMIT_FILE_SIZE'
          ? 'ZIP archive is too large. Maximum archive size is 2 GB.'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Upload field must be archive.'
            : err.message;
        res.status(400).json({ error, code, details: { multerCode: err.code, field: err.field ?? null } });
        return;
      }
      next(err);
    });
  };
}

function getEventId(req: any) {
  return String(req.params.id ?? req.params.eventId ?? '');
}

function sendImportError(res: any, err: unknown) {
  if (err instanceof EventMediaImportError) {
    const status = err.code === 'EVENT_MEDIA_IMPORT_NOT_FOUND'
      ? 404
      : err.code === 'EVENT_MEDIA_IMPORT_RUNNING'
        ? 409
        : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return true;
  }
  return false;
}

function cleanSearch(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 120);
}

function normalizeMediaStatus(value: unknown) {
  const status = String(value ?? 'PENDING').toUpperCase();
  return MEDIA_STATUS_FILTERS.has(status) ? status : 'PENDING';
}

function normalizeMediaType(value: unknown) {
  const type = String(value ?? 'all').toLowerCase();
  return MEDIA_TYPE_FILTERS.has(type) ? type : 'all';
}

function toPositiveInt(value: unknown, fallback: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(numeric)));
}

function serializeRawMediaRow(row: any) {
  const mimeType = String(row.assetMimeType ?? 'image/jpeg');
  return {
    id: row.id,
    eventId: row.eventId,
    source: row.source,
    status: row.status,
    displayNumber: row.displayNumber,
    kind: mimeType.startsWith('video/') ? 'video' : 'image',
    title: row.title,
    caption: row.caption,
    altText: row.altText,
    credit: row.credit,
    albumId: row.albumId,
    album: row.albumId ? {
      id: row.albumId,
      title: row.albumTitle,
    } : null,
    capturedAt: row.capturedAt,
    capturedAtSource: row.capturedAtSource,
    capturedTimezone: row.capturedTimezone,
    groupKey: row.groupKey,
    groupTitle: row.groupTitle,
    downloadEnabled: row.downloadEnabled,
    durationSeconds: row.durationSeconds,
    metadataJson: row.metadataJson,
    moderationNotes: row.moderationNotes,
    approvedAt: row.approvedAt,
    rejectedAt: row.rejectedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    asset: {
      id: row.assetId,
      originalFilename: row.assetOriginalFilename,
      mimeType,
      sizeBytes: Number(row.assetSizeBytes ?? 0),
      publicUrl: row.assetPublicUrl,
      storageKey: row.assetStorageKey,
      checksumSha256: row.assetChecksumSha256,
    },
    uploader: row.uploaderId ? {
      id: row.uploaderId,
      name: row.uploaderName,
      email: row.uploaderEmail,
      avatarUrl: row.uploaderAvatarUrl,
    } : null,
    approvedBy: row.approvedById ? {
      id: row.approvedById,
      name: row.approvedByName,
      email: row.approvedByEmail,
    } : null,
    rejectedBy: row.rejectedById ? {
      id: row.rejectedById,
      name: row.rejectedByName,
      email: row.rejectedByEmail,
    } : null,
    history: [],
  };
}

function createImportServiceFile(file: Express.Multer.File | undefined) {
  if (!file) return { file, originalSizeBytes: 0 };
  const originalSizeBytes = file.size;
  if (file.size <= IMPORT_SERVICE_COMPAT_SIZE_BYTES) return { file, originalSizeBytes };
  return {
    file: {
      ...file,
      size: IMPORT_SERVICE_COMPAT_SIZE_BYTES,
    } as Express.Multer.File,
    originalSizeBytes,
  };
}

async function restoreArchiveAssetSize(jobId: string, originalSizeBytes: number) {
  if (!jobId || originalSizeBytes <= IMPORT_SERVICE_COMPAT_SIZE_BYTES) return;
  await prisma.$executeRaw`
    UPDATE "media_assets" asset
    SET "sizeBytes" = ${originalSizeBytes}, "updatedAt" = NOW()
    FROM "event_media_import_jobs" job
    WHERE job.id = ${jobId}
      AND job."archiveAssetId" = asset.id
  `;
}

async function listAdminMediaStable(req: Request) {
  const eventId = getEventId(req);
  const status = normalizeMediaStatus(req.query['status']);
  const type = normalizeMediaType(req.query['type']);
  const search = cleanSearch(req.query['search']);
  const albumId = cleanSearch(req.query['albumId']);
  const page = toPositiveInt(req.query['page'], 1, 100000);
  const limit = toPositiveInt(req.query['limit'], 20, 100);
  const offset = (page - 1) * limit;

  const whereParts: Prisma.Sql[] = [Prisma.sql`m."eventId" = ${eventId}`];

  if (status !== 'ALL') {
    whereParts.push(Prisma.sql`m."status" = ${status}`);
  }
  if (status !== 'DELETED' && status !== 'ALL') {
    whereParts.push(Prisma.sql`m."deletedAt" IS NULL`);
  }
  if (type === 'image') {
    whereParts.push(Prisma.sql`asset."mimeType" LIKE 'image/%'`);
  } else if (type === 'video') {
    whereParts.push(Prisma.sql`asset."mimeType" LIKE 'video/%'`);
  } else {
    whereParts.push(Prisma.sql`(asset."mimeType" LIKE 'image/%' OR asset."mimeType" LIKE 'video/%')`);
  }

  if (albumId && albumId !== 'ALL') {
    whereParts.push(albumId === MEDIA_ALBUM_FILTER_UNASSIGNED
      ? Prisma.sql`m."albumId" IS NULL`
      : Prisma.sql`m."albumId" = ${albumId}`);
  }

  if (search) {
    const pattern = `%${search}%`;
    const numericSearch = Number(search.replace(/^#/, ''));
    const numberFilter = Number.isInteger(numericSearch) && numericSearch > 0
      ? Prisma.sql`OR m."displayNumber" = ${numericSearch}`
      : Prisma.empty;
    whereParts.push(Prisma.sql`(
      m."title" ILIKE ${pattern}
      OR m."caption" ILIKE ${pattern}
      OR m."credit" ILIKE ${pattern}
      OR m."groupTitle" ILIKE ${pattern}
      OR album."title" ILIKE ${pattern}
      OR uploader."name" ILIKE ${pattern}
      OR uploader."email" ILIKE ${pattern}
      OR asset."originalFilename" ILIKE ${pattern}
      ${numberFilter}
    )`);
  }

  const whereSql = Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`;

  const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total
    FROM "event_media" m
    JOIN "media_assets" asset ON asset.id = m."assetId"
    LEFT JOIN "event_media_albums" album ON album.id = m."albumId"
    LEFT JOIN "users" uploader ON uploader.id = m."uploaderUserId"
    ${whereSql}
  `;
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      m.id,
      m."eventId",
      m."source",
      m."status",
      m."displayNumber",
      m."title",
      m."caption",
      m."altText",
      m."credit",
      m."albumId",
      album."title" AS "albumTitle",
      m."capturedAt",
      m."capturedAtSource",
      m."capturedTimezone",
      m."groupKey",
      m."groupTitle",
      m."downloadEnabled",
      m."durationSeconds",
      m."metadataJson",
      m."moderationNotes",
      m."approvedAt",
      m."rejectedAt",
      m."deletedAt",
      m."createdAt",
      m."updatedAt",
      asset.id AS "assetId",
      asset."originalFilename" AS "assetOriginalFilename",
      asset."mimeType" AS "assetMimeType",
      asset."sizeBytes" AS "assetSizeBytes",
      asset."publicUrl" AS "assetPublicUrl",
      asset."storageKey" AS "assetStorageKey",
      asset."checksumSha256" AS "assetChecksumSha256",
      uploader.id AS "uploaderId",
      uploader."name" AS "uploaderName",
      uploader."email" AS "uploaderEmail",
      uploader."avatarUrl" AS "uploaderAvatarUrl",
      approved_by.id AS "approvedById",
      approved_by."name" AS "approvedByName",
      approved_by."email" AS "approvedByEmail",
      rejected_by.id AS "rejectedById",
      rejected_by."name" AS "rejectedByName",
      rejected_by."email" AS "rejectedByEmail"
    FROM "event_media" m
    JOIN "media_assets" asset ON asset.id = m."assetId"
    LEFT JOIN "event_media_albums" album ON album.id = m."albumId"
    LEFT JOIN "users" uploader ON uploader.id = m."uploaderUserId"
    LEFT JOIN "users" approved_by ON approved_by.id = m."approvedByUserId"
    LEFT JOIN "users" rejected_by ON rejected_by.id = m."rejectedByUserId"
    ${whereSql}
    ORDER BY m."status" ASC, m."createdAt" DESC, m.id DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `;

  return {
    media: rows.map(serializeRawMediaRow),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

adminMediaBankProdRouter.use(requireAuth);
adminMediaBankProdRouter.use(async (req, res, next) => {
  const user = (req as any).user as User | undefined;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }
  const eventId = getEventId(req);
  if (!(await canAccessEvent(user, eventId, 'event.manageMedia'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  next();
});

// GET /api/admin/events/:id/media — stable production media list.
adminMediaBankProdRouter.get('/', async (req, res) => {
  try {
    const result = await listAdminMediaStable(req);
    res.json(result);
  } catch (err) {
    console.error('[media-bank] stable admin list failed', err);
    res.status(500).json({
      error: 'Media list failed',
      code: 'EVENT_MEDIA_LIST_FAILED',
    });
  }
});

// POST /api/admin/events/:id/media/reset-counter — align next display number after maintenance cleanup.
adminMediaBankProdRouter.post('/reset-counter', async (req, res) => {
  const result = await resetEventMediaDisplayCounter(getEventId(req));
  res.json(result);
});

// POST /api/admin/events/:id/media/imports — 2GB archive upload with import-specific errors.
adminMediaBankProdRouter.post('/imports', handleImportArchiveUpload(mediaImportUpload.single('archive')), async (req, res) => {
  const user = (req as any).user as User;
  try {
    const uploadedArchive = (req as any).file as Express.Multer.File | undefined;
    const normalizedArchive = createImportServiceFile(uploadedArchive);
    const job = await startEventMediaImport(getEventId(req), user, normalizedArchive.file, req.body ?? {});
    await restoreArchiveAssetSize(job.id, normalizedArchive.originalSizeBytes);
    res.status(202).json({ job });
  } catch (err) {
    if (sendImportError(res, err)) return;
    throw err;
  }
});

// PATCH /api/admin/events/:id/media/imports/:jobId — edit import status/note.
adminMediaBankProdRouter.patch('/imports/:jobId', async (req, res) => {
  try {
    const job = await updateEventMediaImportAdmin(getEventId(req), String(req.params.jobId), req.body ?? {});
    res.json({ job });
  } catch (err) {
    if (sendImportError(res, err)) return;
    throw err;
  }
});

// DELETE /api/admin/events/:id/media/imports/:jobId — delete import record, optionally imported media too.
adminMediaBankProdRouter.delete('/imports/:jobId', async (req, res) => {
  const user = (req as any).user as User;
  try {
    const result = await deleteEventMediaImportAdmin(getEventId(req), String(req.params.jobId), user, {
      deleteImportedMedia: req.query.deleteImportedMedia ?? req.body?.deleteImportedMedia,
    });
    res.json(result);
  } catch (err) {
    if (sendImportError(res, err)) return;
    throw err;
  }
});

// POST /api/admin/events/:id/media/imports/:jobId/rollback — hide all media created by this import.
adminMediaBankProdRouter.post('/imports/:jobId/rollback', async (req, res) => {
  const user = (req as any).user as User;
  try {
    const result = await rollbackEventMediaImportAdmin(getEventId(req), String(req.params.jobId), user);
    res.json(result);
  } catch (err) {
    if (sendImportError(res, err)) return;
    throw err;
  }
});

// PATCH /api/admin/events/:id/media/bulk — bulk edit selected media cards.
adminMediaBankProdRouter.patch('/bulk', async (req, res) => {
  const user = (req as any).user as User;
  try {
    const result = await bulkUpdateEventMediaAdmin(getEventId(req), user, req.body ?? {});
    res.json(result);
  } catch (err) {
    if (sendImportError(res, err)) return;
    throw err;
  }
});
