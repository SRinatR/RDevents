import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import type { EventMediaStatus, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { saveUploadedFile } from '../../common/storage.js';
import { canAccessEvent } from '../access-control/access-control.service.js';

export const EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB = 100;
export const EVENT_MEDIA_DEFAULT_MAX_FILE_SIZE_MB = 25;

export const EVENT_MEDIA_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const PARTICIPANT_UPLOAD_STATUSES = ['ACTIVE', 'APPROVED', 'RESERVE'] as const;
const MEDIA_TYPE_FILTERS = new Set(['all', 'image', 'video']);
const MEDIA_STATUS_FILTERS = new Set(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'DELETED']);

type MediaKind = 'image' | 'video';
type MediaTypeFilter = 'all' | MediaKind;

export type EventMediaSettingsDto = {
  enabled: boolean;
  participantUploadEnabled: boolean;
  moderationEnabled: boolean;
  showUploaderName: boolean;
  showCredit: boolean;
  allowParticipantTitle: boolean;
  allowParticipantCaption: boolean;
  maxFileSizeMb: number;
  allowedTypes: MediaKind[];
};

export class EventMediaUploadError extends Error {
  constructor(message: string, public code = 'EVENT_MEDIA_UPLOAD_INVALID') {
    super(message);
    this.name = 'EventMediaUploadError';
  }
}

export const DEFAULT_EVENT_MEDIA_SETTINGS: EventMediaSettingsDto = {
  enabled: true,
  participantUploadEnabled: true,
  moderationEnabled: true,
  showUploaderName: false,
  showCredit: true,
  allowParticipantTitle: true,
  allowParticipantCaption: true,
  maxFileSizeMb: EVENT_MEDIA_DEFAULT_MAX_FILE_SIZE_MB,
  allowedTypes: ['image', 'video'],
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeMediaKind(value: unknown): MediaKind | null {
  if (value === 'image' || value === 'video') return value;
  return null;
}

function normalizeTypeFilter(value: unknown): MediaTypeFilter {
  const type = String(value ?? 'all').toLowerCase();
  return MEDIA_TYPE_FILTERS.has(type) ? type as MediaTypeFilter : 'all';
}

function normalizeAllowedTypesInput(value: unknown): MediaKind[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const normalized = values.map(normalizeMediaKind).filter(Boolean) as MediaKind[];
  return [...new Set(normalized)];
}

function normalizeAllowedTypes(value: unknown): MediaKind[] {
  const normalized = normalizeAllowedTypesInput(value);
  return normalized.length ? normalized : [...DEFAULT_EVENT_MEDIA_SETTINGS.allowedTypes];
}

function clampMaxFileSize(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return EVENT_MEDIA_DEFAULT_MAX_FILE_SIZE_MB;
  return Math.max(1, Math.min(Math.round(numeric), EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB));
}

function mediaKindFromMime(mimeType: string): MediaKind | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return null;
}

function assetKindWhere(type: MediaTypeFilter = 'all') {
  if (type === 'image') return { mimeType: { startsWith: 'image/' } };
  if (type === 'video') return { mimeType: { startsWith: 'video/' } };
  return {
    OR: [
      { mimeType: { startsWith: 'image/' } },
      { mimeType: { startsWith: 'video/' } },
    ],
  };
}

function serializeSettings(settings: any): EventMediaSettingsDto {
  if (!settings) return { ...DEFAULT_EVENT_MEDIA_SETTINGS };
  return {
    enabled: Boolean(settings.enabled),
    participantUploadEnabled: Boolean(settings.participantUploadEnabled),
    moderationEnabled: Boolean(settings.moderationEnabled),
    showUploaderName: Boolean(settings.showUploaderName),
    showCredit: Boolean(settings.showCredit),
    allowParticipantTitle: Boolean(settings.allowParticipantTitle),
    allowParticipantCaption: Boolean(settings.allowParticipantCaption),
    maxFileSizeMb: clampMaxFileSize(settings.maxFileSizeMb),
    allowedTypes: normalizeAllowedTypes(settings.allowedTypes),
  };
}

function serializeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

function serializeHistoryEntry(entry: any) {
  return {
    id: entry.id,
    action: entry.action,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    reason: entry.reason,
    metaJson: entry.metaJson,
    createdAt: entry.createdAt,
    actor: entry.actor ? {
      id: entry.actor.id,
      name: entry.actor.name,
      email: entry.actor.email,
    } : null,
  };
}

function serializeEventMedia(item: any, options: { publicView?: boolean; settings?: EventMediaSettingsDto } = {}) {
  const kind = mediaKindFromMime(item.asset.mimeType) ?? 'image';
  const publicView = Boolean(options.publicView);
  const settings = options.settings ?? DEFAULT_EVENT_MEDIA_SETTINGS;

  return {
    id: item.id,
    eventId: item.eventId,
    source: item.source,
    status: item.status,
    kind,
    title: item.title,
    caption: item.caption,
    altText: item.altText,
    credit: publicView && !settings.showCredit ? null : item.credit,
    moderationNotes: publicView ? null : item.moderationNotes,
    approvedAt: item.approvedAt,
    rejectedAt: item.rejectedAt,
    deletedAt: item.deletedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    asset: {
      id: item.asset.id,
      originalFilename: item.asset.originalFilename,
      mimeType: item.asset.mimeType,
      sizeBytes: item.asset.sizeBytes,
      publicUrl: item.asset.publicUrl,
      storageKey: item.asset.storageKey,
    },
    uploader: publicView && !settings.showUploaderName ? null : serializeUser(item.uploader),
    approvedBy: publicView ? null : serializeUser(item.approvedBy),
    rejectedBy: publicView ? null : serializeUser(item.rejectedBy),
    event: item.event ? {
      id: item.event.id,
      slug: item.event.slug,
      title: item.event.title,
      startsAt: item.event.startsAt,
    } : undefined,
    history: Array.isArray(item.history) ? item.history.map(serializeHistoryEntry) : undefined,
  };
}

const EVENT_MEDIA_INCLUDE = {
  asset: true,
  uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
  approvedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  rejectedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  history: {
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
} as const;

const EVENT_MEDIA_HIGHLIGHT_INCLUDE = {
  asset: true,
  uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
  approvedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  rejectedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      mediaSettings: true,
    },
  },
} as const;

export function handleEventMediaMulterUpload(upload: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }

      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: 'File is too large',
          code: 'EVENT_MEDIA_FILE_TOO_LARGE',
        });
        return;
      }

      next(err);
    });
  };
}

export function validateEventMediaFile(file: Express.Multer.File | undefined, settings: EventMediaSettingsDto = DEFAULT_EVENT_MEDIA_SETTINGS) {
  if (!file || !file.buffer || file.size <= 0) {
    throw new EventMediaUploadError('File is required', 'EVENT_MEDIA_FILE_REQUIRED');
  }

  const kind = mediaKindFromMime(file.mimetype);
  if (!kind || !EVENT_MEDIA_ALLOWED_MIME_TYPES.has(file.mimetype) || !settings.allowedTypes.includes(kind)) {
    throw new EventMediaUploadError(
      'File type not allowed. Accepted: images and video',
      'EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED',
    );
  }

  const maxBytes = clampMaxFileSize(settings.maxFileSizeMb) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new EventMediaUploadError(
      `File must be ${settings.maxFileSizeMb} MB or smaller`,
      'EVENT_MEDIA_FILE_TOO_LARGE',
    );
  }
}

export async function getEventMediaSettings(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const settings = await prisma.eventMediaSettings.findUnique({ where: { eventId } });
  return serializeSettings(settings);
}

export async function updateEventMediaSettings(eventId: string, input: Record<string, unknown>) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const data: Record<string, unknown> = {};
  for (const key of [
    'enabled',
    'participantUploadEnabled',
    'moderationEnabled',
    'showUploaderName',
    'showCredit',
    'allowParticipantTitle',
    'allowParticipantCaption',
  ]) {
    if (input[key] !== undefined) data[key] = Boolean(input[key]);
  }
  if (input['maxFileSizeMb'] !== undefined) data['maxFileSizeMb'] = clampMaxFileSize(input['maxFileSizeMb']);
  if (input['allowedTypes'] !== undefined) {
    const allowedTypes = normalizeAllowedTypesInput(input['allowedTypes']);
    if (allowedTypes.length === 0) throw new Error('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED');
    data['allowedTypes'] = allowedTypes;
  }

  const settings = await prisma.eventMediaSettings.upsert({
    where: { eventId },
    create: { eventId, ...data },
    update: data,
  });

  return serializeSettings(settings);
}

export async function listApprovedEventMedia(
  eventId: string,
  params: { type?: unknown; limit?: unknown; cursor?: unknown } = {},
) {
  const settings = await getEventMediaSettings(eventId);
  if (!settings.enabled) {
    return { media: [], meta: { nextCursor: null, settings } };
  }

  const type = normalizeTypeFilter(params.type);
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? 60) || 60));
  const rows = await prisma.eventMedia.findMany({
    where: {
      eventId,
      status: 'APPROVED',
      deletedAt: null,
      asset: {
        status: 'ACTIVE',
        ...assetKindWhere(type),
      },
    },
    include: EVENT_MEDIA_INCLUDE,
    orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const nextCursor = null;
  const media = rows.map((item) => serializeEventMedia(item, { publicView: true, settings }));
  return { media, meta: { nextCursor, settings } };
}

export async function listEventMediaHighlights(limitInput: unknown = 8) {
  const limit = Math.min(24, Math.max(1, Number(limitInput ?? 8) || 8));
  const rows = await prisma.eventMedia.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      asset: {
        status: 'ACTIVE',
        ...assetKindWhere('all'),
      },
      event: {
        status: 'PUBLISHED',
        deletedAt: null,
        mediaSettings: { is: { enabled: true } },
      },
    },
    include: EVENT_MEDIA_HIGHLIGHT_INCLUDE,
    orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  return rows.map((item) =>
    serializeEventMedia(item, {
      publicView: true,
      settings: serializeSettings(item.event?.mediaSettings),
    }),
  );
}

export async function listMyEventMedia(eventId: string, actor: User) {
  const items = await prisma.eventMedia.findMany({
    where: {
      eventId,
      uploaderUserId: actor.id,
      asset: { ...assetKindWhere('all') },
    },
    include: EVENT_MEDIA_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return items.map((item) => serializeEventMedia(item));
}

export async function listEventMediaForModeration(
  eventId: string,
  params: {
    status?: EventMediaStatus | 'ALL';
    type?: unknown;
    search?: unknown;
    page?: unknown;
    limit?: unknown;
  } = {},
) {
  const status = String(params.status ?? 'PENDING').toUpperCase();
  if (!MEDIA_STATUS_FILTERS.has(status)) throw new Error('EVENT_MEDIA_INVALID_STATUS');

  const type = normalizeTypeFilter(params.type);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20) || 20));
  const search = cleanText(params.search, 120);

  const where: any = {
    eventId,
    ...(status !== 'ALL' ? { status } : {}),
    ...(status !== 'DELETED' && status !== 'ALL' ? { deletedAt: null } : {}),
    asset: { ...assetKindWhere(type) },
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { caption: { contains: search, mode: 'insensitive' } },
      { credit: { contains: search, mode: 'insensitive' } },
      { uploader: { name: { contains: search, mode: 'insensitive' } } },
      { uploader: { email: { contains: search, mode: 'insensitive' } } },
      { asset: { originalFilename: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.eventMedia.count({ where }),
    prisma.eventMedia.findMany({
      where,
      include: EVENT_MEDIA_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    media: items.map((item) => serializeEventMedia(item)),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}


export async function getEventMediaSummary(eventId: string) {
  const [total, pending, approved, rejected, deleted, participant, admin, images, videos] = await Promise.all([
    prisma.eventMedia.count({ where: { eventId } }),
    prisma.eventMedia.count({ where: { eventId, status: 'PENDING', deletedAt: null } }),
    prisma.eventMedia.count({ where: { eventId, status: 'APPROVED', deletedAt: null } }),
    prisma.eventMedia.count({ where: { eventId, status: 'REJECTED', deletedAt: null } }),
    prisma.eventMedia.count({ where: { eventId, status: 'DELETED' } }),
    prisma.eventMedia.count({ where: { eventId, source: 'PARTICIPANT' } }),
    prisma.eventMedia.count({ where: { eventId, source: 'ADMIN' } }),
    prisma.eventMedia.count({ where: { eventId, asset: { mimeType: { startsWith: 'image/' } } } }),
    prisma.eventMedia.count({ where: { eventId, asset: { mimeType: { startsWith: 'video/' } } } }),
  ]);

  return { total, pending, approved, rejected, deleted, participant, admin, images, videos };
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
  options: { mode?: 'participant' | 'admin' | 'auto' } = {},
) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true } });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const mode = options.mode ?? 'auto';
  const canModerate = await canAccessEvent(actor, eventId, 'event.manageMedia');
  const isAdminUpload = mode === 'admin' || (mode === 'auto' && canModerate);

  if (isAdminUpload && !canModerate) throw new Error('FORBIDDEN');

  const settings = await getEventMediaSettings(eventId);
  await prisma.eventMediaSettings.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
  if (!isAdminUpload && !settings.enabled) {
    throw new Error('EVENT_MEDIA_BANK_DISABLED');
  }
  if (!isAdminUpload && !settings.participantUploadEnabled) {
    throw new Error('EVENT_MEDIA_UPLOAD_DISABLED');
  }

  const participant = isAdminUpload
    ? null
    : await prisma.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId: actor.id, role: 'PARTICIPANT' } },
      select: { status: true },
    });

  if (!isAdminUpload && !PARTICIPANT_UPLOAD_STATUSES.includes(participant?.status as any)) {
    throw new Error('EVENT_MEDIA_UPLOAD_FORBIDDEN');
  }

  validateEventMediaFile(file, settings);

  const saved = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname || 'upload',
    folder: `events/${eventId}/media`,
  });

  const now = new Date();
  const status = isAdminUpload || !settings.moderationEnabled ? 'APPROVED' : 'PENDING';
  const source = isAdminUpload ? 'ADMIN' : 'PARTICIPANT';
  const title = isAdminUpload || settings.allowParticipantTitle ? cleanText(input.title, 120) : null;
  const caption = isAdminUpload || settings.allowParticipantCaption ? cleanText(input.caption, 1000) : null;

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

    const created = await tx.eventMedia.create({
      data: {
        eventId,
        assetId: asset.id,
        uploaderUserId: actor.id,
        source,
        status,
        title,
        caption,
        altText: cleanText(input.altText, 180),
        credit: cleanText(input.credit, 120),
        approvedByUserId: status === 'APPROVED' ? actor.id : null,
        approvedAt: status === 'APPROVED' ? now : null,
      },
    });

    await tx.eventMediaHistory.create({
      data: {
        mediaId: created.id,
        actorUserId: actor.id,
        action: 'SUBMITTED',
        fromStatus: null,
        toStatus: status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      },
    });

    if (status === 'APPROVED') {
      await tx.eventMediaHistory.create({
        data: {
          mediaId: created.id,
          actorUserId: actor.id,
          action: 'APPROVED',
          fromStatus: source === 'ADMIN' ? null : 'PENDING',
          toStatus: 'APPROVED',
          reason: source === 'ADMIN' ? 'Organizer upload' : 'Moderation disabled',
        },
      });
    }

    return tx.eventMedia.findUnique({
      where: { id: created.id },
      include: EVENT_MEDIA_INCLUDE,
    });
  });

  return serializeEventMedia(item);
}

export async function moderateEventMedia(
  eventId: string,
  mediaId: string,
  actor: User,
  input: {
    status?: EventMediaStatus;
    title?: unknown;
    caption?: unknown;
    altText?: unknown;
    credit?: unknown;
    moderationNotes?: unknown;
    notes?: unknown;
  },
) {
  const existing = await prisma.eventMedia.findUnique({
    where: { id: mediaId },
    include: { asset: true },
  });
  if (!existing || existing.eventId !== eventId) throw new Error('EVENT_MEDIA_NOT_FOUND');

  const status = input.status ? String(input.status).toUpperCase() as EventMediaStatus : undefined;
  if (status && !['PENDING', 'APPROVED', 'REJECTED', 'DELETED'].includes(status)) {
    throw new Error('EVENT_MEDIA_INVALID_STATUS');
  }

  const reason = cleanText(input.moderationNotes ?? input.notes, 1000);
  if (status === 'REJECTED' && !reason) {
    throw new Error('EVENT_MEDIA_REJECTION_REASON_REQUIRED');
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {};
  const changedFields: string[] = [];

  for (const [key, max] of Object.entries({ title: 120, caption: 1000, altText: 180, credit: 120 })) {
    if ((input as any)[key] !== undefined) {
      const nextValue = cleanText((input as any)[key], max);
      updateData[key] = nextValue;
      if ((existing as any)[key] !== nextValue) changedFields.push(key);
    }
  }

  if (input.moderationNotes !== undefined || input.notes !== undefined) {
    updateData['moderationNotes'] = reason;
    if (existing.moderationNotes !== reason) changedFields.push('moderationNotes');
  }

  if (status === 'APPROVED') {
    Object.assign(updateData, {
      status: 'APPROVED',
      approvedByUserId: actor.id,
      approvedAt: now,
      rejectedByUserId: null,
      rejectedAt: null,
      deletedAt: null,
    });
  } else if (status === 'REJECTED') {
    Object.assign(updateData, {
      status: 'REJECTED',
      moderationNotes: reason,
      rejectedByUserId: actor.id,
      rejectedAt: now,
      approvedByUserId: null,
      approvedAt: null,
      deletedAt: null,
    });
  } else if (status === 'PENDING') {
    Object.assign(updateData, {
      status: 'PENDING',
      approvedByUserId: null,
      approvedAt: null,
      rejectedByUserId: null,
      rejectedAt: null,
      deletedAt: null,
    });
  } else if (status === 'DELETED') {
    Object.assign(updateData, {
      status: 'DELETED',
      deletedAt: now,
    });
  }

  const item = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.eventMedia.update({
      where: { id: mediaId },
      data: updateData,
    });

    if (changedFields.length > 0) {
      await tx.eventMediaHistory.create({
        data: {
          mediaId,
          actorUserId: actor.id,
          action: 'UPDATED',
          fromStatus: existing.status,
          toStatus: status ?? existing.status,
          reason,
          metaJson: { fields: changedFields },
        },
      });
    }

    if (status && status !== existing.status) {
      const action = status === 'APPROVED'
        ? 'APPROVED'
        : status === 'REJECTED'
          ? 'REJECTED'
          : status === 'DELETED'
            ? 'DELETED'
            : 'RESTORED';

      await tx.eventMediaHistory.create({
        data: {
          mediaId,
          actorUserId: actor.id,
          action,
          fromStatus: existing.status,
          toStatus: status,
          reason,
        },
      });
    }

    if (status === 'DELETED') {
      await tx.mediaAsset.update({
        where: { id: existing.assetId },
        data: { status: 'DELETED', deletedAt: now },
      });
    } else if (status && existing.asset.status === 'DELETED') {
      await tx.mediaAsset.update({
        where: { id: existing.assetId },
        data: { status: 'ACTIVE', deletedAt: null },
      });
    }

    return tx.eventMedia.findUnique({
      where: { id: updated.id },
      include: EVENT_MEDIA_INCLUDE,
    });
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
  await prisma.$transaction(async (tx: any) => {
    await tx.eventMedia.update({
      where: { id: mediaId },
      data: {
        status: 'DELETED',
        deletedAt: now,
        moderationNotes: existing.moderationNotes ?? `Deleted by ${actor.email}`,
      },
    });
    await tx.mediaAsset.update({
      where: { id: existing.assetId },
      data: { status: 'DELETED', deletedAt: now },
    });
    await tx.eventMediaHistory.create({
      data: {
        mediaId,
        actorUserId: actor.id,
        action: 'DELETED',
        fromStatus: existing.status,
        toStatus: 'DELETED',
        reason: existing.moderationNotes ?? null,
      },
    });
  });

  return { ok: true };
}
