import { createHash } from 'node:crypto';
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
const MEDIA_ALBUM_FILTER_UNASSIGNED = 'UNASSIGNED';

type MediaKind = 'image' | 'video';
type MediaTypeFilter = 'all' | MediaKind;
type PublicMediaReasonCode =
  | 'OK'
  | 'EVENT_NOT_PUBLISHED'
  | 'MEDIA_BANK_DISABLED'
  | 'NO_APPROVED_MEDIA'
  | 'NO_ACTIVE_ASSETS'
  | 'UNKNOWN';

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
  nextMediaDisplayNumber?: number;
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
  nextMediaDisplayNumber: 1,
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function parseOptionalDate(value: unknown) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
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
    nextMediaDisplayNumber: Number(settings.nextMediaDisplayNumber ?? 1),
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
    displayNumber: item.displayNumber,
    kind,
    title: item.title,
    caption: item.caption,
    altText: item.altText,
    credit: publicView && !settings.showCredit ? null : item.credit,
    albumId: item.albumId,
    album: item.album ? {
      id: item.album.id,
      title: item.album.title,
    } : null,
    capturedAt: item.capturedAt,
    capturedAtSource: item.capturedAtSource,
    capturedTimezone: item.capturedTimezone,
    groupKey: item.groupKey,
    groupTitle: item.groupTitle,
    downloadEnabled: item.downloadEnabled,
    durationSeconds: item.durationSeconds,
    metadataJson: publicView ? undefined : item.metadataJson,
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
      checksumSha256: publicView ? undefined : item.asset.checksumSha256,
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
  album: { select: { id: true, title: true } },
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

function serializePublicEvent(event: any) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    coverImageUrl: event.coverImageUrl,
  };
}

function normalizePublicMediaSort(value: unknown): any {
  const sort = String(value ?? 'newest').toLowerCase();
  if (sort === 'oldest') return [{ approvedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];
  if (sort === 'number') return [{ displayNumber: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];
  return [{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
}

function buildPublicMediaWhere(input: { eventId?: string | null; slug?: string | null; type?: unknown; search?: unknown }) {
  const type = normalizeTypeFilter(input.type);
  const search = cleanText(input.search, 120);
  const where: any = {
    ...(input.eventId ? { eventId: input.eventId } : {}),
    status: 'APPROVED',
    deletedAt: null,
    asset: {
      status: 'ACTIVE',
      ...assetKindWhere(type),
    },
    event: {
      status: 'PUBLISHED',
      deletedAt: null,
      mediaSettings: { is: { enabled: true } },
      ...(input.slug ? { slug: input.slug } : {}),
    },
  };

  if (search) {
    const numericSearch = Number(search.replace(/^#/, ''));
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { caption: { contains: search, mode: 'insensitive' } },
      { credit: { contains: search, mode: 'insensitive' } },
      { asset: { originalFilename: { contains: search, mode: 'insensitive' } } },
      { event: { title: { contains: search, mode: 'insensitive' } } },
    ];

    if (Number.isInteger(numericSearch) && numericSearch > 0) {
      where.OR.push({ displayNumber: numericSearch });
    }
  }

  return where;
}

export async function listApprovedEventMedia(
  eventId: string,
  params: { type?: unknown; limit?: unknown; cursor?: unknown } = {},
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const settings = await getEventMediaSettings(eventId);
  if (event.status !== 'PUBLISHED' || event.deletedAt || !settings.enabled) {
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

export async function getEventMediaBankBySlug(
  slug: string,
  params: { type?: unknown; search?: unknown; sort?: unknown; page?: unknown; limit?: unknown } = {},
) {
  const event = await prisma.event.findFirst({
    where: { slug, status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      endsAt: true,
      location: true,
      coverImageUrl: true,
      mediaSettings: true,
    },
  });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const settings = serializeSettings(event.mediaSettings);
  if (!settings.enabled) {
    return {
      event: serializePublicEvent(event),
      media: [],
      meta: { total: 0, images: 0, videos: 0, page: 1, limit: 40, pages: 0, settings },
    };
  }

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const limit = Math.min(80, Math.max(1, Number(params.limit ?? 40) || 40));
  const where = buildPublicMediaWhere({
    eventId: event.id,
    type: params.type,
    search: params.search,
  });

  const orderBy = normalizePublicMediaSort(params.sort);
  const [total, images, videos, rows] = await Promise.all([
    prisma.eventMedia.count({ where }),
    prisma.eventMedia.count({ where: { ...where, asset: { status: 'ACTIVE', mimeType: { startsWith: 'image/' } } } }),
    prisma.eventMedia.count({ where: { ...where, asset: { status: 'ACTIVE', mimeType: { startsWith: 'video/' } } } }),
    prisma.eventMedia.findMany({
      where,
      include: EVENT_MEDIA_INCLUDE,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    event: serializePublicEvent(event),
    media: rows.map((item) => serializeEventMedia(item, { publicView: true, settings })),
    meta: { total, images, videos, page, limit, pages: Math.ceil(total / limit), settings },
  };
}

export async function listSiteEventMedia(
  params: {
    type?: unknown;
    eventId?: unknown;
    slug?: unknown;
    search?: unknown;
    page?: unknown;
    limit?: unknown;
    sort?: unknown;
  } = {},
) {
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const limit = Math.min(80, Math.max(1, Number(params.limit ?? 40) || 40));
  const where = buildPublicMediaWhere({
    eventId: cleanText(params.eventId, 120),
    slug: cleanText(params.slug, 160),
    type: params.type,
    search: params.search,
  });

  const [total, rows, events] = await Promise.all([
    prisma.eventMedia.count({ where }),
    prisma.eventMedia.findMany({
      where,
      include: EVENT_MEDIA_HIGHLIGHT_INCLUDE,
      orderBy: normalizePublicMediaSort(params.sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        mediaSettings: { is: { enabled: true } },
        mediaItems: {
          some: {
            status: 'APPROVED',
            deletedAt: null,
            asset: { status: 'ACTIVE', ...assetKindWhere('all') },
          },
        },
      },
      select: { id: true, slug: true, title: true, startsAt: true },
      orderBy: { startsAt: 'desc' },
      take: 100,
    }),
  ]);

  return {
    media: rows.map((item: any) =>
      serializeEventMedia(item, {
        publicView: true,
        settings: serializeSettings(item.event?.mediaSettings),
      }),
    ),
    events,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
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
    albumId?: unknown;
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
  const albumId = cleanText(params.albumId, 120);

  const where: any = {
    eventId,
    ...(status !== 'ALL' ? { status } : {}),
    ...(status !== 'DELETED' && status !== 'ALL' ? { deletedAt: null } : {}),
    asset: { ...assetKindWhere(type) },
  };

  if (albumId && albumId !== 'ALL') {
    where.albumId = albumId === MEDIA_ALBUM_FILTER_UNASSIGNED ? null : albumId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { caption: { contains: search, mode: 'insensitive' } },
      { credit: { contains: search, mode: 'insensitive' } },
      { groupTitle: { contains: search, mode: 'insensitive' } },
      { album: { title: { contains: search, mode: 'insensitive' } } },
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

export async function getEventMediaPublicVisibility(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const settings = await getEventMediaSettings(eventId);
  const [approvedMedia, activeAssets] = await Promise.all([
    prisma.eventMedia.count({
      where: {
        eventId,
        status: 'APPROVED',
        deletedAt: null,
      },
    }),
    prisma.eventMedia.count({
      where: {
        eventId,
        status: 'APPROVED',
        deletedAt: null,
        asset: { status: 'ACTIVE', ...assetKindWhere('all') },
      },
    }),
  ]);

  const eventPublished = event.status === 'PUBLISHED' && !event.deletedAt;
  const visibleOnPublicPages = eventPublished && settings.enabled && approvedMedia > 0 && activeAssets > 0;
  let reasonCode: PublicMediaReasonCode = 'OK';
  let reason = 'Media is visible on public pages.';

  if (!eventPublished) {
    reasonCode = 'EVENT_NOT_PUBLISHED';
    reason = 'Media will appear publicly after the event is published.';
  } else if (!settings.enabled) {
    reasonCode = 'MEDIA_BANK_DISABLED';
    reason = 'Media bank is disabled in event settings.';
  } else if (approvedMedia === 0) {
    reasonCode = 'NO_APPROVED_MEDIA';
    reason = 'Approve at least one media item to show it publicly.';
  } else if (activeAssets === 0) {
    reasonCode = 'NO_ACTIVE_ASSETS';
    reason = 'Approved media exists, but no active media files are available.';
  }

  return {
    eventPublished,
    mediaBankEnabled: settings.enabled,
    approvedMedia,
    activeAssets,
    visibleOnPublicPages,
    reasonCode,
    reason,
  };
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
    capturedAt?: unknown;
    groupTitle?: unknown;
    downloadEnabled?: unknown;
  } = {},
  options: { mode?: 'participant' | 'admin' | 'auto'; forceStatus?: EventMediaStatus } = {},
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
  const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');

  const saved = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname || 'upload',
    folder: `events/${eventId}/media`,
  });

  const now = new Date();
  const status = options.forceStatus ?? (isAdminUpload || !settings.moderationEnabled ? 'APPROVED' : 'PENDING');
  const source = isAdminUpload ? 'ADMIN' : 'PARTICIPANT';
  const title = isAdminUpload || settings.allowParticipantTitle ? cleanText(input.title, 120) : null;
  const caption = isAdminUpload || settings.allowParticipantCaption ? cleanText(input.caption, 1000) : null;
  const capturedAt = parseOptionalDate(input.capturedAt);
  const groupTitle = cleanText(input.groupTitle, 120);
  const downloadEnabled = parseOptionalBoolean(input.downloadEnabled);

  const item = await prisma.$transaction(async (tx: any) => {
    const counter = await tx.eventMediaSettings.upsert({
      where: { eventId },
      create: { eventId, nextMediaDisplayNumber: 2 },
      update: { nextMediaDisplayNumber: { increment: 1 } },
      select: { nextMediaDisplayNumber: true },
    });
    const incrementedDisplayNumber = Number(counter.nextMediaDisplayNumber);
    const displayNumber = Number.isFinite(incrementedDisplayNumber)
      ? Math.max(1, incrementedDisplayNumber - 1)
      : 1;

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
        checksumSha256,
      },
    });

    const created = await tx.eventMedia.create({
      data: {
        eventId,
        assetId: asset.id,
        uploaderUserId: actor.id,
        source,
        status,
        displayNumber,
        title,
        caption,
        altText: cleanText(input.altText, 180),
        credit: cleanText(input.credit, 120),
        capturedAt: capturedAt === undefined ? null : capturedAt,
        capturedAtSource: capturedAt ? 'ADMIN' : null,
        groupTitle,
        groupKey: groupTitle ? groupTitle.toLowerCase().replace(/\s+/g, '-').slice(0, 180) : null,
        downloadEnabled: downloadEnabled ?? true,
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
    capturedAt?: unknown;
    groupTitle?: unknown;
    downloadEnabled?: unknown;
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

  if (input.groupTitle !== undefined) {
    const nextValue = cleanText(input.groupTitle, 120);
    updateData['groupTitle'] = nextValue;
    updateData['groupKey'] = nextValue ? nextValue.toLowerCase().replace(/\s+/g, '-').slice(0, 180) : null;
    if ((existing as any).groupTitle !== nextValue) changedFields.push('groupTitle');
  }

  const capturedAt = parseOptionalDate(input.capturedAt);
  if (capturedAt !== undefined) {
    updateData['capturedAt'] = capturedAt;
    updateData['capturedAtSource'] = capturedAt ? 'ADMIN' : null;
    if (String((existing as any).capturedAt ?? '') !== String(capturedAt ?? '')) changedFields.push('capturedAt');
  }

  const downloadEnabled = parseOptionalBoolean(input.downloadEnabled);
  if (downloadEnabled !== undefined) {
    updateData['downloadEnabled'] = downloadEnabled;
    if ((existing as any).downloadEnabled !== downloadEnabled) changedFields.push('downloadEnabled');
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

function serializeCaptionSuggestion(item: any) {
  return {
    id: item.id,
    mediaId: item.mediaId,
    eventId: item.eventId,
    authorUserId: item.authorUserId,
    status: item.status,
    suggestedTitle: item.suggestedTitle,
    suggestedCaption: item.suggestedCaption,
    suggestedCredit: item.suggestedCredit,
    suggestedAltText: item.suggestedAltText,
    moderationReason: item.moderationReason,
    decidedAt: item.decidedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    media: item.media ? serializeEventMedia(item.media) : undefined,
    author: item.author ? serializeUser(item.author) : undefined,
    moderator: item.moderator ? serializeUser(item.moderator) : undefined,
  };
}

async function assertCanSuggestCaption(eventId: string, actor: User) {
  const participant = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId: actor.id, role: 'PARTICIPANT' } },
    select: { status: true },
  });

  if (!PARTICIPANT_UPLOAD_STATUSES.includes(participant?.status as any)) {
    throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_FORBIDDEN');
  }
}

export async function listCaptionSuggestionTargets(
  eventId: string,
  actor: User,
  params: { search?: unknown; number?: unknown; type?: unknown; page?: unknown; limit?: unknown } = {},
) {
  await assertCanSuggestCaption(eventId, actor);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const limit = Math.min(60, Math.max(1, Number(params.limit ?? 30) || 30));
  const search = cleanText(params.search, 120);
  const number = Number(params.number);
  const where: any = {
    eventId,
    status: 'APPROVED',
    deletedAt: null,
    asset: { status: 'ACTIVE', ...assetKindWhere(normalizeTypeFilter(params.type)) },
  };

  if (Number.isInteger(number) && number > 0) {
    where.displayNumber = number;
  } else if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { caption: { contains: search, mode: 'insensitive' } },
      { credit: { contains: search, mode: 'insensitive' } },
      { asset: { originalFilename: { contains: search, mode: 'insensitive' } } },
    ];
    const numericSearch = Number(search.replace(/^#/, ''));
    if (Number.isInteger(numericSearch) && numericSearch > 0) where.OR.push({ displayNumber: numericSearch });
  }

  const [total, items] = await Promise.all([
    prisma.eventMedia.count({ where }),
    prisma.eventMedia.findMany({
      where,
      include: EVENT_MEDIA_INCLUDE,
      orderBy: [{ displayNumber: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { media: items.map((item) => serializeEventMedia(item)), meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function createCaptionSuggestion(
  eventId: string,
  mediaId: string,
  actor: User,
  input: { title?: unknown; caption?: unknown; credit?: unknown; altText?: unknown },
) {
  await assertCanSuggestCaption(eventId, actor);
  const media = await prisma.eventMedia.findFirst({
    where: {
      id: mediaId,
      eventId,
      deletedAt: null,
      asset: { status: 'ACTIVE' },
    },
    select: { id: true },
  });
  if (!media) throw new Error('EVENT_MEDIA_NOT_FOUND');

  const suggestedTitle = cleanText(input.title, 120);
  const suggestedCaption = cleanText(input.caption, 1000);
  const suggestedCredit = cleanText(input.credit, 120);
  const suggestedAltText = cleanText(input.altText, 180);

  if (!suggestedTitle && !suggestedCaption && !suggestedCredit && !suggestedAltText) {
    throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_EMPTY');
  }

  const existing = await prisma.eventMediaCaptionSuggestion.findFirst({
    where: { mediaId, authorUserId: actor.id, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_PENDING_EXISTS');

  const suggestion = await prisma.eventMediaCaptionSuggestion.create({
    data: {
      mediaId,
      eventId,
      authorUserId: actor.id,
      suggestedTitle,
      suggestedCaption,
      suggestedCredit,
      suggestedAltText,
    },
    include: { media: { include: EVENT_MEDIA_INCLUDE }, author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  return serializeCaptionSuggestion(suggestion);
}

export async function listMyCaptionSuggestions(eventId: string, actor: User) {
  const suggestions = await prisma.eventMediaCaptionSuggestion.findMany({
    where: { eventId, authorUserId: actor.id },
    include: {
      media: { include: EVENT_MEDIA_INCLUDE },
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      moderator: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return suggestions.map(serializeCaptionSuggestion);
}

export async function listAdminCaptionSuggestions(eventId: string, params: { status?: unknown } = {}) {
  const status = String(params.status ?? 'PENDING').toUpperCase();
  if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'].includes(status)) {
    throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_INVALID_STATUS');
  }

  const suggestions = await prisma.eventMediaCaptionSuggestion.findMany({
    where: {
      eventId,
      ...(status === 'ALL' ? {} : { status: status as any }),
    },
    include: {
      media: { include: EVENT_MEDIA_INCLUDE },
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      moderator: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return suggestions.map(serializeCaptionSuggestion);
}

export async function approveCaptionSuggestion(
  eventId: string,
  suggestionId: string,
  actor: User,
  input: { title?: unknown; caption?: unknown; credit?: unknown; altText?: unknown } = {},
) {
  const suggestion = await prisma.eventMediaCaptionSuggestion.findFirst({
    where: { id: suggestionId, eventId },
    include: { media: true },
  });
  if (!suggestion) throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_NOT_FOUND');
  if (suggestion.status !== 'PENDING') throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_ALREADY_DECIDED');

  const title = input.title !== undefined ? cleanText(input.title, 120) : suggestion.suggestedTitle;
  const caption = input.caption !== undefined ? cleanText(input.caption, 1000) : suggestion.suggestedCaption;
  const credit = input.credit !== undefined ? cleanText(input.credit, 120) : suggestion.suggestedCredit;
  const altText = input.altText !== undefined ? cleanText(input.altText, 180) : suggestion.suggestedAltText;
  const now = new Date();

  const updatedSuggestion = await prisma.$transaction(async (tx: any) => {
    await tx.eventMedia.update({
      where: { id: suggestion.mediaId },
      data: {
        ...(title !== null ? { title } : {}),
        ...(caption !== null ? { caption } : {}),
        ...(credit !== null ? { credit } : {}),
        ...(altText !== null ? { altText } : {}),
      },
    });
    await tx.eventMediaHistory.create({
      data: {
        mediaId: suggestion.mediaId,
        actorUserId: actor.id,
        action: 'UPDATED',
        fromStatus: suggestion.media.status,
        toStatus: suggestion.media.status,
        reason: 'Caption suggestion approved',
        metaJson: { suggestionId },
      },
    });
    return tx.eventMediaCaptionSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'APPROVED',
        moderatorUserId: actor.id,
        decidedAt: now,
      },
      include: {
        media: { include: EVENT_MEDIA_INCLUDE },
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        moderator: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  });

  return serializeCaptionSuggestion(updatedSuggestion);
}

export async function rejectCaptionSuggestion(eventId: string, suggestionId: string, actor: User, reasonInput: unknown) {
  const reason = cleanText(reasonInput, 1000);
  if (!reason) throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_REJECTION_REASON_REQUIRED');

  const suggestion = await prisma.eventMediaCaptionSuggestion.findFirst({
    where: { id: suggestionId, eventId },
    select: { id: true, status: true },
  });
  if (!suggestion) throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_NOT_FOUND');
  if (suggestion.status !== 'PENDING') throw new Error('EVENT_MEDIA_CAPTION_SUGGESTION_ALREADY_DECIDED');

  const updated = await prisma.eventMediaCaptionSuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: 'REJECTED',
      moderatorUserId: actor.id,
      moderationReason: reason,
      decidedAt: new Date(),
    },
    include: {
      media: { include: EVENT_MEDIA_INCLUDE },
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      moderator: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return serializeCaptionSuggestion(updated);
}
