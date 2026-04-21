import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { buildPublicMediaUrl, deleteStoredFile, saveUploadedFile } from '../../common/storage.js';

type MediaPurpose = 'AVATAR' | 'DOCUMENT';

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export class ProfileMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileMediaError';
  }
}

export function validateAvatarFile(file: Express.Multer.File) {
  validateFileBasics(file);
  if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
    throw new ProfileMediaError('Avatar must be a JPG, PNG, or WebP image');
  }
  assertMaxSize(file, env.MAX_AVATAR_UPLOAD_MB, 'Avatar');
}

export function validateDocumentFile(file: Express.Multer.File) {
  validateFileBasics(file);
  if (!DOCUMENT_MIME_TYPES.has(file.mimetype)) {
    throw new ProfileMediaError('Document must be a PDF, Word document, or image');
  }
  assertMaxSize(file, env.MAX_DOCUMENT_UPLOAD_MB, 'Document');
}

export async function createMediaAsset(
  ownerUserId: string,
  purpose: MediaPurpose,
  file: Express.Multer.File,
) {
  const stored = await saveUploadedFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalFilename: file.originalname,
    folder: purpose === 'AVATAR' ? `users/${ownerUserId}/avatar` : `users/${ownerUserId}/documents`,
  });

  return prisma.mediaAsset.create({
    data: {
      ownerUserId,
      purpose,
      originalFilename: file.originalname || 'upload',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageDriver: stored.storageDriver,
      storageKey: stored.storageKey,
      publicUrl: stored.publicUrl,
    },
  });
}

export async function attachAvatarToUser(userId: string, assetId: string) {
  const [user, asset] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarAssetId: true,
        avatarAsset: { select: { id: true, storageKey: true } },
      },
    }),
    prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerUserId: userId, purpose: 'AVATAR', status: 'ACTIVE' },
    }),
  ]);

  if (!asset) throw new ProfileMediaError('Avatar asset was not found');

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarAssetId: asset.id,
      avatarUrl: buildPublicMediaUrl(asset.storageKey),
    },
  });

  const previousAsset = user?.avatarAsset;
  if (previousAsset && previousAsset.id !== asset.id) {
    await markMediaAssetDeleted(userId, previousAsset.id);
  }

  return asset;
}

export async function detachAvatarFromUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarAssetId: true,
      avatarAsset: { select: { id: true } },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarAssetId: null,
      avatarUrl: null,
    },
  });

  if (user?.avatarAsset?.id) {
    await markMediaAssetDeleted(userId, user.avatarAsset.id);
  }
}

export async function listUserDocuments(userId: string) {
  return prisma.mediaAsset.findMany({
    where: {
      ownerUserId: userId,
      purpose: 'DOCUMENT',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      publicUrl: true,
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markMediaAssetDeleted(userId: string, assetId: string) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      ownerUserId: userId,
      status: 'ACTIVE',
    },
  });

  if (!asset) throw new ProfileMediaError('Media asset was not found');

  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
    },
  });

  await deleteStoredFile(asset.storageKey).catch(() => undefined);
}

function validateFileBasics(file: Express.Multer.File) {
  if (!file.buffer || file.size <= 0) {
    throw new ProfileMediaError('File is empty');
  }
}

function assertMaxSize(file: Express.Multer.File, maxMb: number, label: string) {
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ProfileMediaError(`${label} must be ${maxMb} MB or smaller`);
  }
}
