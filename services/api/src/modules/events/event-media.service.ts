import type { EventMediaStatus, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { saveUploadedFile } from '../../common/storage.js';
import { canAccessEvent } from '../access-control/access-control.service.js';

const configuredMaxFileSizeMb = Number(process.env['EVENT_MEDIA_MAX_FILE_SIZE_MB'] ?? 25);
export const EVENT_MEDIA_MAX_FILE_SIZE_MB = Number.isFinite(configuredMaxFileSizeMb)
  ? Math.max(1, Math.min(configuredMaxFileSizeMb, 100))
  : 25;

export const EVENT_MEDIA_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'application/pdf',
]);

const PARTICIPANT_UPLOAD_STATUSES = ['ACTIVE', 'APPROVED', 'RESERVE'] as const;

export class EventMediaUploadError extends Error {
  constructor(message: string, public code = 'EVENT_MEDIA_UPLOAD_INVALID') {
    super(message);
    this.name = 'EventMediaUploadError';
  }
}

export function validateEventMediaFile(file?: Express.Multer.File) {
  if (!file || !file.buffer || file.size <= 0) {
    throw new EventMediaUploadError('File is required', 'EVENT_MEDIA_FILE_REQUIRED');
  }

  if (!EVENT_MEDIA_ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new EventMediaUploadError(
      'File type not allowed. Accepted: images, video, audio, PDF',
      'EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED',
    );
  }

  const maxBytes = EVENT_MEDIA_MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new EventMediaUploadError(
      `File must be ${EVENT_MEDIA_MAX_FILE_SIZE_MB} MB or smaller`,
      'EVENT_MEDIA_FILE_TOO_LARGE',
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function mediaKindFromMime(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function serializeEventMedia(item: any) {
  return {
    id: item.id,
    eventId: item.eventId,
    source: item.source,
    status: item.status,
    title: item.title,
    caption: item.caption,
    altText: item.altText,
    credit: item.credit,
    moderationNotes: item.moderationNotes,
    approvedAt: item.approvedAt,
    rejectedAt: item.rejectedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    kind: mediaKindFromMime(item.asset.mimeType),
    asset: {
      id: item.asset.id,
      originalFilename: item.asset.originalFilename,
      mimeType: item.asset.mimeType,
      sizeBytes: item.asset.sizeBytes,
      publicUrl: item.asset.publicUrl,
      storageKey: item.asset.storageKey,
    },
    uploader: item.uploader
      ? { id: item.uploader.id, name: item.uploader.name, email: item.uploader.email, avatarUrl: item.uploader.avatarUrl }
      : null,
    approvedBy: item.approvedBy
      ? { id: item.approvedBy.id, name: item.approvedBy.name, email: item.approvedBy.email }
      : null,
    rejectedBy: item.rejectedBy
      ? { id: item.rejectedBy.id, name: item.rejectedBy.name, email: item.rejectedBy.email }
      : null,
  };
}

const EVENT_MEDIA_INCLUDE = {
  asset: true,
  uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  rejectedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function listApprovedEventMedia(eventId: string) {
  const items = await prisma.eventMedia.findMany({
    where: {
      eventId,
      status: 'APPROVED',
      deletedAt: null,
      asset: { status: 'ACTIVE' },
    },
    include: EVENT_MEDIA_INCLUDE,
    orderBy: { approvedAt: 'desc' },
  });

  return items.map(serializeEventMedia);
}

export async function listEventMediaForModeration(eventId: string, status?: EventMediaStatus | 'ALL') {
  const items = await prisma.eventMedia.findMany({
    where: {
      eventId,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(status === 'DELETED' ? {} : { deletedAt: null }),
    },
    include: EVENT_MEDIA_INCLUDE,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return items.map(serializeEventMedia);
}

export async function uploadEventMedia(
  eventId: string,
  actor: User,
  file: Express.Multer.File,
  input: {
    title?: unknown;
    caption?: unknown;
    altText?: unknown;
    credit?: unknown;
  } = {},
) {
  validateEventMediaFile(file);

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true } });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const canModerate = await canAccessEvent(actor, eventId, 'event.manageMedia');
  const participant = canModerate
    ? null
    : await prisma.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId: actor.id, role: 'PARTICIPANT' } },
      select: { status: true },
    });

  if (!canModerate && !PARTICIPANT_UPLOAD_STATUSES.includes(participant?.status as any)) {
    throw new Error('EVENT_MEDIA_UPLOAD_FORBIDDEN');
  }

  const saved = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname || 'upload',
    folder: `events/${eventId}/media`,
  });

  const now = new Date();
  const status = canModerate ? 'APPROVED' : 'PENDING';
  const source = canModerate ? 'ADMIN' : 'PARTICIPANT';

  const item = await prisma.$transaction(async (tx: any) => {
    const asset = await tx.mediaAsset.create({
      data: {
        ownerUserId: actor.id,
        purpose: 'EVENT_MEDIA',
        originalFilename: file.originalname || 'upload',
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageDriver: saved.storageDriver,
        storageKey: saved.storageKey,
        publicUrl: saved.publicUrl,
      },
    });

    return tx.eventMedia.create({
      data: {
        eventId,
        assetId: asset.id,
        uploaderUserId: actor.id,
        source,
        status,
        title: cleanText(input.title, 120),
        caption: cleanText(input.caption, 1000),
        altText: cleanText(input.altText, 180),
        credit: cleanText(input.credit, 120),
        approvedByUserId: canModerate ? actor.id : null,
        approvedAt: canModerate ? now : null,
      },
      include: EVENT_MEDIA_INCLUDE,
    });
  });

  return serializeEventMedia(item);
}

export async function moderateEventMedia(
  eventId: string,
  mediaId: string,
  actor: User,
  input: { status: EventMediaStatus; notes?: unknown },
) {
  if (!['APPROVED', 'REJECTED'].includes(input.status)) {
    throw new Error('EVENT_MEDIA_INVALID_STATUS');
  }

  const existing = await prisma.eventMedia.findUnique({ where: { id: mediaId }, select: { id: true, eventId: true } });
  if (!existing || existing.eventId !== eventId) throw new Error('EVENT_MEDIA_NOT_FOUND');

  const now = new Date();
  const item = await prisma.eventMedia.update({
    where: { id: mediaId },
    data: input.status === 'APPROVED'
      ? {
        status: 'APPROVED',
        moderationNotes: cleanText(input.notes, 1000),
        approvedByUserId: actor.id,
        approvedAt: now,
        rejectedByUserId: null,
        rejectedAt: null,
      }
      : {
        status: 'REJECTED',
        moderationNotes: cleanText(input.notes, 1000),
        rejectedByUserId: actor.id,
        rejectedAt: now,
        approvedByUserId: null,
        approvedAt: null,
      },
    include: EVENT_MEDIA_INCLUDE,
  });

  return serializeEventMedia(item);
}

export async function deleteEventMedia(eventId: string, mediaId: string, actor: User) {
  const existing = await prisma.eventMedia.findUnique({
    where: { id: mediaId },
    include: { asset: true },
  });
  if (!existing || existing.eventId !== eventId) throw new Error('EVENT_MEDIA_NOT_FOUND');

  const now = new Date();
  await prisma.$transaction([
    prisma.eventMedia.update({
      where: { id: mediaId },
      data: {
        status: 'DELETED',
        deletedAt: now,
        moderationNotes: existing.moderationNotes ?? `Deleted by ${actor.email}`,
      },
    }),
    prisma.mediaAsset.update({
      where: { id: existing.assetId },
      data: { status: 'DELETED', deletedAt: now },
    }),
  ]);

  return { ok: true };
}
