import type {
  EventGalleryAsset,
  EventGalleryAssetSource,
  EventGalleryAssetStatus,
  EventGalleryAssetType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { deleteStoredFile, saveUploadedFile } from '../../common/storage.js';

const ACTIVE_PARTICIPANT_STATUSES = ['ACTIVE'] as const;

const PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const INLINE_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
]);

export type EventGalleryListQuery = {
  page: number;
  limit: number;
  source: 'ALL' | EventGalleryAssetSource;
  type: 'ALL' | EventGalleryAssetType;
  status: 'ALL' | EventGalleryAssetStatus;
  search?: string;
};

export type EventGalleryUpdateInput = {
  caption?: string | null;
  status?: EventGalleryAssetStatus;
  reviewNote?: string | null;
};

type GalleryView = 'public' | 'member' | 'admin';

export class EventGalleryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventGalleryError';
  }
}

export function validateEventGalleryFile(file: Express.Multer.File) {
  if (!file?.buffer || file.size <= 0) {
    throw new EventGalleryError('EVENT_GALLERY_FILE_EMPTY');
  }

  const type = detectGalleryAssetType(file.mimetype);
  if (!type) {
    throw new EventGalleryError('EVENT_GALLERY_FILE_TYPE_NOT_ALLOWED');
  }

  const maxMb = type === 'PHOTO'
    ? env.MAX_EVENT_GALLERY_PHOTO_MB
    : env.MAX_EVENT_GALLERY_VIDEO_MB;
  const maxBytes = maxMb * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new EventGalleryError('EVENT_GALLERY_FILE_TOO_LARGE');
  }

  return type;
}

export function detectGalleryAssetType(mimeType: string): EventGalleryAssetType | null {
  if (PHOTO_MIME_TYPES.has(mimeType)) return 'PHOTO';
  if (VIDEO_MIME_TYPES.has(mimeType)) return 'VIDEO';
  return null;
}

export async function listPublicEventGalleryBySlug(slug: string, query: EventGalleryListQuery) {
  const event = await findEventBySlug(slug);
  if (!event) throw new EventGalleryError('EVENT_NOT_FOUND');

  return buildGalleryResponse({
    event,
    query,
    view: 'public',
    baseWhere: {
      eventId: event.id,
      status: 'PUBLISHED',
    },
    summaryWhere: {
      eventId: event.id,
      status: 'PUBLISHED',
    },
  });
}

export async function listMyEventGalleryWorkspace(userId: string, slug: string, query: EventGalleryListQuery) {
  const event = await findEventBySlug(slug);
  if (!event) throw new EventGalleryError('EVENT_NOT_FOUND');

  await assertActiveParticipantWorkspace(event.id, userId);

  const [gallery, myUploads, mySummary] = await Promise.all([
    buildGalleryResponse({
      event,
      query,
      view: 'member',
      baseWhere: {
        eventId: event.id,
        status: 'PUBLISHED',
      },
      summaryWhere: {
        eventId: event.id,
        status: 'PUBLISHED',
      },
    }),
    prisma.eventGalleryAsset.findMany({
      where: {
        eventId: event.id,
        uploaderUserId: userId,
        source: 'PARTICIPANT',
      },
      include: galleryAssetInclude,
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    getMyUploadsSummary(event.id, userId),
  ]);

  return {
    ...gallery,
    myUploads: myUploads.map((asset) => mapGalleryAsset(asset, 'member')),
    mySummary,
    permissions: {
      canUpload: true,
      participantUploadsAreModerated: true,
      acceptedPhotoFormats: ['JPG', 'PNG', 'WebP'],
      acceptedVideoFormats: ['MP4', 'WebM', 'MOV'],
      photoLimitMb: env.MAX_EVENT_GALLERY_PHOTO_MB,
      videoLimitMb: env.MAX_EVENT_GALLERY_VIDEO_MB,
    },
  };
}

export async function createParticipantEventGalleryAsset(
  userId: string,
  slug: string,
  file: Express.Multer.File,
  caption?: string | null,
) {
  const event = await findEventBySlug(slug);
  if (!event) throw new EventGalleryError('EVENT_NOT_FOUND');

  await assertActiveParticipantWorkspace(event.id, userId);
  const type = validateEventGalleryFile(file);
  const stored = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname,
    folder: `event-gallery-participant-${event.id}-${userId}`,
  });

  const asset = await prisma.eventGalleryAsset.create({
    data: {
      eventId: event.id,
      uploaderUserId: userId,
      source: 'PARTICIPANT',
      type,
      status: 'PENDING',
      caption: normalizeOptionalText(caption),
      originalFilename: file.originalname || 'upload',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageDriver: stored.storageDriver,
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
    },
    include: galleryAssetInclude,
  });

  return {
    event: summarizeEvent(event),
    asset: mapGalleryAsset(asset, 'member'),
  };
}

export async function deleteParticipantEventGalleryAsset(
  userId: string,
  slug: string,
  assetId: string,
) {
  const event = await findEventBySlug(slug);
  if (!event) throw new EventGalleryError('EVENT_NOT_FOUND');

  await assertActiveParticipantWorkspace(event.id, userId);

  const asset = await prisma.eventGalleryAsset.findFirst({
    where: {
      id: assetId,
      eventId: event.id,
      uploaderUserId: userId,
      source: 'PARTICIPANT',
    },
  });

  if (!asset) throw new EventGalleryError('EVENT_GALLERY_ASSET_NOT_FOUND');

  await prisma.eventGalleryAsset.delete({ where: { id: asset.id } });
  await deleteStoredFile(asset.storageKey).catch(() => undefined);

  return { ok: true };
}

export async function listAdminEventGallery(eventId: string, query: EventGalleryListQuery) {
  const event = await findEventById(eventId);
  if (!event) throw new EventGalleryError('EVENT_NOT_FOUND');

  return buildGalleryResponse({
    event,
    query,
    view: 'admin',
    baseWhere: {
      eventId: event.id,
      ...(query.status !== 'ALL' ? { status: query.status } : {}),
    },
    summaryWhere: {
      eventId: event.id,
    },
  });
}

export async function createOfficialEventGalleryAsset(
  eventId: string,
  uploaderUserId: string,
  file: Express.Multer.File,
  caption?: string | null,
) {
  const event = await findEventById(eventId);
  if (!event) throw new EventGalleryError('EVENT_NOT_FOUND');

  const type = validateEventGalleryFile(file);
  const stored = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname,
    folder: `event-gallery-official-${event.id}`,
  });

  const asset = await prisma.eventGalleryAsset.create({
    data: {
      eventId: event.id,
      uploaderUserId,
      reviewerUserId: uploaderUserId,
      source: 'OFFICIAL',
      type,
      status: 'PUBLISHED',
      caption: normalizeOptionalText(caption),
      originalFilename: file.originalname || 'upload',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageDriver: stored.storageDriver,
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
      publishedAt: new Date(),
      reviewedAt: new Date(),
    },
    include: galleryAssetInclude,
  });

  return {
    event: summarizeEvent(event),
    asset: mapGalleryAsset(asset, 'admin'),
  };
}

export async function updateAdminEventGalleryAsset(
  eventId: string,
  assetId: string,
  reviewerUserId: string,
  input: EventGalleryUpdateInput,
) {
  const asset = await prisma.eventGalleryAsset.findFirst({
    where: {
      id: assetId,
      eventId,
    },
    include: galleryAssetInclude,
  });

  if (!asset) throw new EventGalleryError('EVENT_GALLERY_ASSET_NOT_FOUND');

  const data: Prisma.EventGalleryAssetUpdateInput = {};

  if (input.caption !== undefined) {
    data.caption = normalizeOptionalText(input.caption);
  }

  if (input.reviewNote !== undefined) {
    data.reviewNote = normalizeOptionalText(input.reviewNote);
  }

  if (input.status) {
    data.status = input.status;
    data.reviewer = { connect: { id: reviewerUserId } };

    if (input.status === 'PUBLISHED') {
      data.publishedAt = asset.publishedAt ?? new Date();
      data.reviewedAt = new Date();
      data.archivedAt = null;
    } else if (input.status === 'PENDING') {
      data.publishedAt = null;
      data.reviewedAt = null;
      data.reviewNote = null;
      data.archivedAt = null;
      data.reviewer = { disconnect: true };
    } else if (input.status === 'REJECTED') {
      data.publishedAt = null;
      data.reviewedAt = new Date();
      data.archivedAt = null;
    } else if (input.status === 'ARCHIVED') {
      data.reviewedAt = new Date();
      data.archivedAt = new Date();
    }
  }

  const updated = await prisma.eventGalleryAsset.update({
    where: { id: asset.id },
    data,
    include: galleryAssetInclude,
  });

  return {
    asset: mapGalleryAsset(updated, 'admin'),
  };
}

export async function deleteAdminEventGalleryAsset(eventId: string, assetId: string) {
  const asset = await prisma.eventGalleryAsset.findFirst({
    where: {
      id: assetId,
      eventId,
    },
  });

  if (!asset) throw new EventGalleryError('EVENT_GALLERY_ASSET_NOT_FOUND');

  await prisma.eventGalleryAsset.delete({ where: { id: asset.id } });
  await deleteStoredFile(asset.storageKey).catch(() => undefined);

  return { ok: true };
}

const galleryAssetInclude = {
  uploader: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.EventGalleryAssetInclude;

async function buildGalleryResponse(args: {
  event: Awaited<ReturnType<typeof findEventById>>;
  query: EventGalleryListQuery;
  view: GalleryView;
  baseWhere: Prisma.EventGalleryAssetWhereInput;
  summaryWhere: Prisma.EventGalleryAssetWhereInput;
}) {
  const { event, query, view, baseWhere, summaryWhere } = args;
  const where = buildGalleryWhere(baseWhere, query);

  const [total, items, summary] = await Promise.all([
    prisma.eventGalleryAsset.count({ where }),
    prisma.eventGalleryAsset.findMany({
      where,
      include: galleryAssetInclude,
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    getGallerySummary(summaryWhere),
  ]);

  return {
    event: summarizeEvent(event),
    items: items.map((asset) => mapGalleryAsset(asset, view)),
    summary,
    limits: {
      photoMb: env.MAX_EVENT_GALLERY_PHOTO_MB,
      videoMb: env.MAX_EVENT_GALLERY_VIDEO_MB,
    },
    filters: {
      source: query.source,
      type: query.type,
      status: query.status,
      search: query.search ?? '',
    },
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
      hasMore: query.page * query.limit < total,
    },
  };
}

function buildGalleryWhere(
  baseWhere: Prisma.EventGalleryAssetWhereInput,
  query: EventGalleryListQuery,
): Prisma.EventGalleryAssetWhereInput {
  const where: Prisma.EventGalleryAssetWhereInput = {
    ...baseWhere,
  };

  if (query.source !== 'ALL') {
    where.source = query.source;
  }

  if (query.type !== 'ALL') {
    where.type = query.type;
  }

  if (query.status !== 'ALL' && baseWhere.status === undefined) {
    where.status = query.status;
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { caption: { contains: search, mode: 'insensitive' } },
      { originalFilename: { contains: search, mode: 'insensitive' } },
      {
        uploader: {
          is: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  return where;
}

async function getGallerySummary(where: Prisma.EventGalleryAssetWhereInput) {
  const rows = await prisma.eventGalleryAsset.groupBy({
    by: ['source', 'type', 'status'],
    where,
    _count: { _all: true },
  });

  const summary = {
    total: 0,
    official: 0,
    participant: 0,
    photos: 0,
    videos: 0,
    pending: 0,
    published: 0,
    rejected: 0,
    archived: 0,
  };

  for (const row of rows) {
    const count = row._count._all;
    summary.total += count;
    if (row.source === 'OFFICIAL') summary.official += count;
    if (row.source === 'PARTICIPANT') summary.participant += count;
    if (row.type === 'PHOTO') summary.photos += count;
    if (row.type === 'VIDEO') summary.videos += count;
    if (row.status === 'PENDING') summary.pending += count;
    if (row.status === 'PUBLISHED') summary.published += count;
    if (row.status === 'REJECTED') summary.rejected += count;
    if (row.status === 'ARCHIVED') summary.archived += count;
  }

  return summary;
}

async function getMyUploadsSummary(eventId: string, userId: string) {
  const rows = await prisma.eventGalleryAsset.groupBy({
    by: ['status'],
    where: {
      eventId,
      uploaderUserId: userId,
      source: 'PARTICIPANT',
    },
    _count: { _all: true },
  });

  const summary = {
    total: 0,
    pending: 0,
    published: 0,
    rejected: 0,
    archived: 0,
  };

  for (const row of rows) {
    const count = row._count._all;
    summary.total += count;
    if (row.status === 'PENDING') summary.pending += count;
    if (row.status === 'PUBLISHED') summary.published += count;
    if (row.status === 'REJECTED') summary.rejected += count;
    if (row.status === 'ARCHIVED') summary.archived += count;
  }

  return summary;
}

function mapGalleryAsset(
  asset: EventGalleryAsset & {
    uploader: { id: string; name: string | null; email: string; avatarUrl: string | null };
    reviewer: { id: string; name: string | null; email: string } | null;
  },
  view: GalleryView,
) {
  const uploaderName = asset.uploader.name?.trim() || asset.uploader.email;

  return {
    id: asset.id,
    eventId: asset.eventId,
    source: asset.source,
    type: asset.type,
    status: asset.status,
    caption: asset.caption,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    publicUrl: asset.publicUrl,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    publishedAt: asset.publishedAt,
    reviewedAt: asset.reviewedAt,
    reviewNote: view === 'admin' ? asset.reviewNote : null,
    canPreviewInline: asset.type === 'PHOTO' || INLINE_VIDEO_MIME_TYPES.has(asset.mimeType),
    uploader: {
      id: asset.uploader.id,
      name: uploaderName,
      avatarUrl: asset.uploader.avatarUrl,
      ...(view !== 'public' ? { email: asset.uploader.email } : {}),
    },
    reviewer: view === 'admin' && asset.reviewer
      ? {
          id: asset.reviewer.id,
          name: asset.reviewer.name?.trim() || asset.reviewer.email,
          email: asset.reviewer.email,
        }
      : null,
  };
}

async function assertActiveParticipantWorkspace(eventId: string, userId: string) {
  const membership = await prisma.eventMember.findUnique({
    where: {
      eventId_userId_role: {
        eventId,
        userId,
        role: 'PARTICIPANT',
      },
    },
    select: {
      status: true,
    },
  });

  if (!membership || !ACTIVE_PARTICIPANT_STATUSES.includes(membership.status as (typeof ACTIVE_PARTICIPANT_STATUSES)[number])) {
    throw new EventGalleryError('EVENT_GALLERY_FORBIDDEN');
  }
}

async function findEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      coverImageUrl: true,
    },
  });
}

async function findEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      coverImageUrl: true,
    },
  });
}

function summarizeEvent(event: Awaited<ReturnType<typeof findEventById>>) {
  return {
    id: event?.id ?? '',
    slug: event?.slug ?? '',
    title: event?.title ?? '',
    status: event?.status ?? null,
    startsAt: event?.startsAt ?? null,
    endsAt: event?.endsAt ?? null,
    coverImageUrl: event?.coverImageUrl ?? null,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
