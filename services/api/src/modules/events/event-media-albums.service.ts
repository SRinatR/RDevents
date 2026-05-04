import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class EventMediaAlbumError extends Error {
  constructor(message: string, public code = 'EVENT_MEDIA_ALBUM_INVALID') {
    super(message);
    this.name = 'EventMediaAlbumError';
  }
}

type AlbumRow = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  sortOrder: number;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  mediaCount?: bigint | number | null;
  coverPublicUrl?: string | null;
  coverStorageKey?: string | null;
  coverMimeType?: string | null;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeMediaIds(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

function serializeAlbum(row: AlbumRow) {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    coverMediaId: row.coverMediaId,
    sortOrder: Number(row.sortOrder ?? 0),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    mediaCount: Number(row.mediaCount ?? 0),
    cover: row.coverMediaId ? {
      mediaId: row.coverMediaId,
      publicUrl: row.coverPublicUrl,
      storageKey: row.coverStorageKey,
      mimeType: row.coverMimeType,
    } : null,
  };
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new EventMediaAlbumError('Event not found', 'EVENT_NOT_FOUND');
}

async function findAlbum(eventId: string, albumId: string) {
  const rows = await prisma.$queryRaw<AlbumRow[]>`
    SELECT
      a.*,
      COUNT(m.id) AS "mediaCount",
      cover_asset."publicUrl" AS "coverPublicUrl",
      cover_asset."storageKey" AS "coverStorageKey",
      cover_asset."mimeType" AS "coverMimeType"
    FROM "event_media_albums" a
    LEFT JOIN "event_media" m
      ON m."albumId" = a.id AND m."deletedAt" IS NULL
    LEFT JOIN "event_media" cover_media
      ON cover_media.id = a."coverMediaId"
    LEFT JOIN "media_assets" cover_asset
      ON cover_asset.id = cover_media."assetId"
    WHERE a.id = ${albumId} AND a."eventId" = ${eventId} AND a."deletedAt" IS NULL
    GROUP BY a.id, cover_asset."publicUrl", cover_asset."storageKey", cover_asset."mimeType"
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listEventMediaAlbums(eventId: string) {
  await assertEventExists(eventId);
  const rows = await prisma.$queryRaw<AlbumRow[]>`
    SELECT
      a.*,
      COUNT(m.id) AS "mediaCount",
      cover_asset."publicUrl" AS "coverPublicUrl",
      cover_asset."storageKey" AS "coverStorageKey",
      cover_asset."mimeType" AS "coverMimeType"
    FROM "event_media_albums" a
    LEFT JOIN "event_media" m
      ON m."albumId" = a.id AND m."deletedAt" IS NULL
    LEFT JOIN "event_media" cover_media
      ON cover_media.id = a."coverMediaId"
    LEFT JOIN "media_assets" cover_asset
      ON cover_asset.id = cover_media."assetId"
    WHERE a."eventId" = ${eventId} AND a."deletedAt" IS NULL
    GROUP BY a.id, cover_asset."publicUrl", cover_asset."storageKey", cover_asset."mimeType"
    ORDER BY a."sortOrder" ASC, a."createdAt" ASC
  `;
  return rows.map(serializeAlbum);
}

export async function createEventMediaAlbum(eventId: string, actor: User, input: Record<string, unknown>) {
  await assertEventExists(eventId);
  const title = cleanText(input['title'], 120);
  if (!title) throw new EventMediaAlbumError('Album title is required', 'EVENT_MEDIA_ALBUM_TITLE_REQUIRED');
  const description = cleanText(input['description'], 1000);
  const sortOrder = Number.isFinite(Number(input['sortOrder'])) ? Math.trunc(Number(input['sortOrder'])) : 0;
  const id = randomUUID();

  const rows = await prisma.$queryRaw<AlbumRow[]>`
    INSERT INTO "event_media_albums" (
      "id", "eventId", "title", "description", "sortOrder", "createdByUserId", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${eventId}, ${title}, ${description}, ${sortOrder}, ${actor.id}, NOW(), NOW()
    )
    RETURNING *
  `;
  return serializeAlbum({ ...rows[0]!, mediaCount: 0 });
}

export async function updateEventMediaAlbum(eventId: string, albumId: string, input: Record<string, unknown>) {
  const existing = await findAlbum(eventId, albumId);
  if (!existing) throw new EventMediaAlbumError('Album not found', 'EVENT_MEDIA_ALBUM_NOT_FOUND');

  const title = input['title'] === undefined ? existing.title : cleanText(input['title'], 120);
  if (!title) throw new EventMediaAlbumError('Album title is required', 'EVENT_MEDIA_ALBUM_TITLE_REQUIRED');
  const description = input['description'] === undefined ? existing.description : cleanText(input['description'], 1000);
  const sortOrder = input['sortOrder'] === undefined
    ? Number(existing.sortOrder ?? 0)
    : Number.isFinite(Number(input['sortOrder'])) ? Math.trunc(Number(input['sortOrder'])) : Number(existing.sortOrder ?? 0);
  const coverMediaId = input['coverMediaId'] === undefined ? existing.coverMediaId : cleanText(input['coverMediaId'], 120);

  if (coverMediaId) {
    const media = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "event_media"
      WHERE id = ${coverMediaId} AND "eventId" = ${eventId} AND "deletedAt" IS NULL
      LIMIT 1
    `;
    if (!media[0]) throw new EventMediaAlbumError('Cover media item not found', 'EVENT_MEDIA_NOT_FOUND');
  }

  await prisma.$executeRaw`
    UPDATE "event_media_albums"
    SET
      "title" = ${title},
      "description" = ${description},
      "sortOrder" = ${sortOrder},
      "coverMediaId" = ${coverMediaId},
      "updatedAt" = NOW()
    WHERE id = ${albumId} AND "eventId" = ${eventId} AND "deletedAt" IS NULL
  `;
  const updated = await findAlbum(eventId, albumId);
  return serializeAlbum(updated!);
}

export async function deleteEventMediaAlbum(eventId: string, albumId: string) {
  const existing = await findAlbum(eventId, albumId);
  if (!existing) throw new EventMediaAlbumError('Album not found', 'EVENT_MEDIA_ALBUM_NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "event_media"
      SET "albumId" = NULL, "updatedAt" = NOW()
      WHERE "eventId" = ${eventId} AND "albumId" = ${albumId}
    `;
    await tx.$executeRaw`
      UPDATE "event_media_albums"
      SET "deletedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${albumId} AND "eventId" = ${eventId}
    `;
  });

  return { ok: true };
}

export async function assignEventMediaToAlbum(eventId: string, albumId: string | null, mediaIdsInput: unknown) {
  const mediaIds = normalizeMediaIds(mediaIdsInput);
  if (mediaIds.length === 0) {
    throw new EventMediaAlbumError('Select at least one media item', 'EVENT_MEDIA_ALBUM_MEDIA_REQUIRED');
  }

  if (albumId) {
    const album = await findAlbum(eventId, albumId);
    if (!album) throw new EventMediaAlbumError('Album not found', 'EVENT_MEDIA_ALBUM_NOT_FOUND');
  }

  const existingRows = await prisma.eventMedia.findMany({
    where: { id: { in: mediaIds }, eventId, deletedAt: null },
    select: { id: true },
  });
  if (existingRows.length !== mediaIds.length) {
    throw new EventMediaAlbumError('Some media items were not found in this event', 'EVENT_MEDIA_ALBUM_MEDIA_NOT_FOUND');
  }

  const result = await prisma.eventMedia.updateMany({
    where: { id: { in: mediaIds }, eventId },
    data: { albumId: albumId ?? null } as any,
  });

  if (albumId) {
    const album = await findAlbum(eventId, albumId);
    return { ok: true, movedCount: result.count, album: serializeAlbum(album!) };
  }
  return { ok: true, movedCount: result.count, album: null };
}
