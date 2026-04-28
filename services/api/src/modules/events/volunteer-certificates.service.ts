import type { EventMember } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { deleteStoredFile, saveUploadedFile } from '../../common/storage.js';

const VOLUNTEER_CERTIFICATE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export class VolunteerCertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VolunteerCertificateError';
  }
}

export function validateVolunteerCertificateFile(file: Express.Multer.File) {
  if (!file?.buffer || file.size <= 0) {
    throw new VolunteerCertificateError('VOLUNTEER_CERTIFICATE_FILE_EMPTY');
  }

  if (!VOLUNTEER_CERTIFICATE_MIME_TYPES.has(file.mimetype)) {
    throw new VolunteerCertificateError('VOLUNTEER_CERTIFICATE_FILE_TYPE_NOT_ALLOWED');
  }

  const maxBytes = env.MAX_VOLUNTEER_CERTIFICATE_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new VolunteerCertificateError('VOLUNTEER_CERTIFICATE_FILE_TOO_LARGE');
  }
}

export async function uploadVolunteerCertificate(
  eventId: string,
  memberId: string,
  file: Express.Multer.File,
) {
  validateVolunteerCertificateFile(file);

  const membership = await prisma.eventMember.findFirst({
    where: {
      id: memberId,
      eventId,
      role: 'VOLUNTEER',
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    throw new VolunteerCertificateError('VOLUNTEER_CERTIFICATE_MEMBER_NOT_FOUND');
  }

  const stored = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname,
    folder: `volunteer-certificate-${eventId}-${memberId}`,
  });

  const updated = await prisma.eventMember.update({
    where: { id: membership.id },
    data: {
      volunteerCertificateOriginalFilename: file.originalname || 'certificate',
      volunteerCertificateMimeType: file.mimetype,
      volunteerCertificateSizeBytes: file.size,
      volunteerCertificateStorageDriver: stored.storageDriver,
      volunteerCertificateStorageKey: stored.storageKey,
      volunteerCertificatePublicUrl: stored.publicUrl,
      volunteerCertificateUploadedAt: new Date(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (membership.volunteerCertificateStorageKey && membership.volunteerCertificateStorageKey !== stored.storageKey) {
    await deleteStoredFile(membership.volunteerCertificateStorageKey).catch(() => undefined);
  }

  return updated;
}

export async function removeVolunteerCertificate(eventId: string, memberId: string) {
  const membership = await prisma.eventMember.findFirst({
    where: {
      id: memberId,
      eventId,
      role: 'VOLUNTEER',
    },
  });

  if (!membership) {
    throw new VolunteerCertificateError('VOLUNTEER_CERTIFICATE_MEMBER_NOT_FOUND');
  }

  if (!membership.volunteerCertificateStorageKey) {
    throw new VolunteerCertificateError('VOLUNTEER_CERTIFICATE_NOT_FOUND');
  }

  await prisma.eventMember.update({
    where: { id: membership.id },
    data: {
      volunteerCertificateOriginalFilename: null,
      volunteerCertificateMimeType: null,
      volunteerCertificateSizeBytes: null,
      volunteerCertificateStorageDriver: null,
      volunteerCertificateStorageKey: null,
      volunteerCertificatePublicUrl: null,
      volunteerCertificateUploadedAt: null,
    },
  });

  await deleteStoredFile(membership.volunteerCertificateStorageKey).catch(() => undefined);

  return { ok: true };
}

export function mapVolunteerCertificate(membership: Pick<
  EventMember,
  | 'volunteerCertificateOriginalFilename'
  | 'volunteerCertificateMimeType'
  | 'volunteerCertificateSizeBytes'
  | 'volunteerCertificatePublicUrl'
  | 'volunteerCertificateUploadedAt'
>) {
  if (!membership.volunteerCertificatePublicUrl) return null;

  return {
    filename: membership.volunteerCertificateOriginalFilename,
    mimeType: membership.volunteerCertificateMimeType,
    sizeBytes: membership.volunteerCertificateSizeBytes,
    publicUrl: membership.volunteerCertificatePublicUrl,
    uploadedAt: membership.volunteerCertificateUploadedAt,
  };
}
