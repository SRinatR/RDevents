import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import type { User } from '@prisma/client';
import { canAccessEvent } from '../access-control/access-control.service.js';
import {
  EventMediaImportError,
  startEventMediaImport,
} from '../events/event-media-import.service.js';
import {
  bulkUpdateEventMediaAdmin,
  deleteEventMediaImportAdmin,
  rollbackEventMediaImportAdmin,
  updateEventMediaImportAdmin,
} from '../events/event-media-import-admin.service.js';

export const adminMediaBankProdRouter = Router({ mergeParams: true });

const MAX_ARCHIVE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

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

adminMediaBankProdRouter.use(async (req, res, next) => {
  const user = (req as any).user as User;
  const eventId = getEventId(req);
  if (!(await canAccessEvent(user, eventId, 'event.manageMedia'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  next();
});

// POST /api/admin/events/:id/media/imports — 2GB archive upload with import-specific errors.
adminMediaBankProdRouter.post('/imports', handleImportArchiveUpload(mediaImportUpload.single('archive')), async (req, res) => {
  const user = (req as any).user as User;
  try {
    const job = await startEventMediaImport(getEventId(req), user, (req as any).file as Express.Multer.File | undefined, req.body ?? {});
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
