import { Router } from 'express';
import type { User } from '@prisma/client';
import { canAccessEvent } from '../access-control/access-control.service.js';
import {
  assignEventMediaToAlbum,
  createEventMediaAlbum,
  deleteEventMediaAlbum,
  EventMediaAlbumError,
  listEventMediaAlbums,
  updateEventMediaAlbum,
} from '../events/event-media-albums.service.js';

export const adminEventMediaAlbumsRouter = Router({ mergeParams: true });

function getEventId(req: any) {
  return String(req.params.id ?? req.params.eventId ?? '');
}

function sendAlbumError(res: any, err: unknown) {
  if (err instanceof EventMediaAlbumError) {
    const status = err.code === 'EVENT_NOT_FOUND' || err.code === 'EVENT_MEDIA_ALBUM_NOT_FOUND' || err.code === 'EVENT_MEDIA_NOT_FOUND'
      ? 404
      : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return true;
  }
  return false;
}

adminEventMediaAlbumsRouter.use(async (req, res, next) => {
  const user = (req as any).user as User;
  const eventId = getEventId(req);
  if (!(await canAccessEvent(user, eventId, 'event.manageMedia'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  next();
});

// GET /api/admin/events/:id/media/albums
adminEventMediaAlbumsRouter.get('/', async (req, res) => {
  try {
    const albums = await listEventMediaAlbums(getEventId(req));
    res.json({ albums });
  } catch (err) {
    if (sendAlbumError(res, err)) return;
    throw err;
  }
});

// POST /api/admin/events/:id/media/albums
adminEventMediaAlbumsRouter.post('/', async (req, res) => {
  const user = (req as any).user as User;
  try {
    const album = await createEventMediaAlbum(getEventId(req), user, req.body ?? {});
    res.status(201).json({ album });
  } catch (err) {
    if (sendAlbumError(res, err)) return;
    throw err;
  }
});

// POST /api/admin/events/:id/media/albums/unassigned/media
adminEventMediaAlbumsRouter.post('/unassigned/media', async (req, res) => {
  try {
    const result = await assignEventMediaToAlbum(getEventId(req), null, req.body?.mediaIds);
    res.json(result);
  } catch (err) {
    if (sendAlbumError(res, err)) return;
    throw err;
  }
});

// PATCH /api/admin/events/:id/media/albums/:albumId
adminEventMediaAlbumsRouter.patch('/:albumId', async (req, res) => {
  try {
    const album = await updateEventMediaAlbum(getEventId(req), String(req.params.albumId), req.body ?? {});
    res.json({ album });
  } catch (err) {
    if (sendAlbumError(res, err)) return;
    throw err;
  }
});

// DELETE /api/admin/events/:id/media/albums/:albumId
adminEventMediaAlbumsRouter.delete('/:albumId', async (req, res) => {
  try {
    const result = await deleteEventMediaAlbum(getEventId(req), String(req.params.albumId));
    res.json(result);
  } catch (err) {
    if (sendAlbumError(res, err)) return;
    throw err;
  }
});

// POST /api/admin/events/:id/media/albums/:albumId/media
adminEventMediaAlbumsRouter.post('/:albumId/media', async (req, res) => {
  try {
    const result = await assignEventMediaToAlbum(getEventId(req), String(req.params.albumId), req.body?.mediaIds);
    res.json(result);
  } catch (err) {
    if (sendAlbumError(res, err)) return;
    throw err;
  }
});
