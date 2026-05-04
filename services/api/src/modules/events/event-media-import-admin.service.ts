import type { User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { deleteEventMedia, moderateEventMedia } from './event-media.service.js';
import { EventMediaImportError } from './event-media-import.service.js';

type ImportPatchInput = {
  status?: unknown;
  errorMessage?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? '').toUpperCase();
  if (!status) return null;
  if (['QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(status)) return status;
  throw new EventMediaImportError('Invalid import status', 'EVENT_MEDIA_IMPORT_INVALID_STATUS');
}

export async function updateEventMediaImportAdmin(eventId: string, jobId: string, input: ImportPatchInput = {}) {
  const job = await prisma.eventMediaImportJob.findFirst({ where: { id: jobId, eventId } });
  if (!job) throw new EventMediaImportError('Import job not found', 'EVENT_MEDIA_IMPORT_NOT_FOUND');

  const status = normalizeStatus(input.status);
  const errorMessage = input.errorMessage === undefined ? undefined : cleanText(input.errorMessage, 1000);
  const data: Record<string, unknown> = { updatedAt: new Date() };

  if (status) {
    data.status = status;
    if (status === 'FAILED') data.failedAt = new Date();
    if (status === 'CANCELLED' || status === 'COMPLETED' || status === 'COMPLETED_WITH_ERRORS') data.completedAt = new Date();
  }
  if (errorMessage !== undefined) data.errorMessage = errorMessage;

  const updated = await prisma.eventMediaImportJob.update({ where: { id: job.id }, data: data as any });
  return updated;
}

export async function deleteEventMediaImportAdmin(eventId: string, jobId: string, actor: User, options: { deleteImportedMedia?: unknown } = {}) {
  const job = await prisma.eventMediaImportJob.findFirst({
    where: { id: jobId, eventId },
    include: { items: { where: { mediaId: { not: null } }, select: { mediaId: true } } },
  });
  if (!job) throw new EventMediaImportError('Import job not found', 'EVENT_MEDIA_IMPORT_NOT_FOUND');
  if (job.status === 'PROCESSING' || job.status === 'QUEUED') {
    throw new EventMediaImportError('Import is still running. Cancel it before deleting.', 'EVENT_MEDIA_IMPORT_RUNNING');
  }

  const deleteImportedMedia = options.deleteImportedMedia === true || options.deleteImportedMedia === 'true' || options.deleteImportedMedia === '1';
  const mediaIds = [...new Set(job.items.map((item) => item.mediaId).filter(Boolean) as string[])];

  await prisma.$transaction(async (tx) => {
    if (deleteImportedMedia && mediaIds.length > 0) {
      await tx.eventMedia.updateMany({
        where: { id: { in: mediaIds }, eventId, deletedAt: null },
        data: { status: 'DELETED', deletedAt: new Date(), moderationNotes: 'Deleted together with import job' } as any,
      });
      await tx.mediaAsset.updateMany({
        where: { eventMedia: { id: { in: mediaIds } } },
        data: { status: 'DELETED', deletedAt: new Date() } as any,
      });
    }

    await tx.eventMediaImportItem.deleteMany({ where: { jobId: job.id } });
    await tx.eventMediaImportJob.delete({ where: { id: job.id } });
  });

  return { ok: true, deletedImport: true, deletedMediaCount: deleteImportedMedia ? mediaIds.length : 0 };
}

export async function rollbackEventMediaImportAdmin(eventId: string, jobId: string, actor: User) {
  const job = await prisma.eventMediaImportJob.findFirst({
    where: { id: jobId, eventId },
    include: { items: { where: { mediaId: { not: null } }, select: { mediaId: true } } },
  });
  if (!job) throw new EventMediaImportError('Import job not found', 'EVENT_MEDIA_IMPORT_NOT_FOUND');
  if (job.status === 'PROCESSING' || job.status === 'QUEUED') {
    throw new EventMediaImportError('Import is still running. Cancel it before rollback.', 'EVENT_MEDIA_IMPORT_RUNNING');
  }

  const mediaIds = [...new Set(job.items.map((item) => item.mediaId).filter(Boolean) as string[])];
  let deletedMediaCount = 0;

  for (const mediaId of mediaIds) {
    await deleteEventMedia(eventId, mediaId, actor);
    deletedMediaCount += 1;
  }

  await prisma.eventMediaImportJob.update({
    where: { id: job.id },
    data: { status: 'CANCELLED', completedAt: new Date(), errorMessage: 'Rolled back by admin' } as any,
  });

  return { ok: true, rolledBack: true, deletedMediaCount };
}

export async function bulkUpdateEventMediaAdmin(eventId: string, actor: User, input: Record<string, unknown> = {}) {
  const mediaIds = Array.isArray(input.mediaIds) ? input.mediaIds.map((id) => String(id).trim()).filter(Boolean) : [];
  if (mediaIds.length === 0) {
    throw new EventMediaImportError('Select at least one media item', 'EVENT_MEDIA_BULK_MEDIA_REQUIRED');
  }

  const patch = input.patch && typeof input.patch === 'object' ? input.patch as Record<string, unknown> : input;
  let updatedCount = 0;

  for (const mediaId of [...new Set(mediaIds)]) {
    await moderateEventMedia(eventId, mediaId, actor, {
      status: patch.status as any,
      title: patch.title,
      caption: patch.caption,
      credit: patch.credit,
      altText: patch.altText,
      moderationNotes: patch.moderationNotes ?? patch.notes,
    });
    updatedCount += 1;
  }

  return { ok: true, updatedCount };
}
