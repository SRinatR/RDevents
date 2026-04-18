import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export interface StoredFileInput {
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
  folder: string;
}

export interface StoredFileResult {
  storageDriver: 'local';
  storageKey: string;
  publicUrl: string;
}

export function getMediaUploadDir() {
  return path.resolve(process.cwd(), env.MEDIA_UPLOAD_DIR);
}

export function buildPublicMediaUrl(storageKey: string) {
  return `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '')}/${storageKey.replace(/^\/+/, '')}`;
}

export async function saveUploadedFile(input: StoredFileInput): Promise<StoredFileResult> {
  if (env.MEDIA_STORAGE_DRIVER !== 'local') {
    throw new Error('Unsupported media storage driver');
  }

  const rootDir = getMediaUploadDir();
  const safeFolder = sanitizePathSegment(input.folder);
  const extension = getSafeExtension(input.originalFilename, input.mimeType);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const storageKey = `${safeFolder}/${filename}`;
  const targetDir = path.join(rootDir, safeFolder);
  const targetPath = path.join(targetDir, filename);

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, input.buffer);

  return {
    storageDriver: 'local',
    storageKey,
    publicUrl: buildPublicMediaUrl(storageKey),
  };
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const rootDir = getMediaUploadDir();
  const targetPath = path.resolve(rootDir, storageKey);
  const relativePath = path.relative(rootDir, targetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid storage key');
  }

  await rm(targetPath, { force: true });
}

function sanitizePathSegment(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'files';
}

function getSafeExtension(filename: string, mimeType: string) {
  const extension = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (extension.length > 1 && extension.length <= 12) return extension;

  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'application/pdf') return '.pdf';

  return '.bin';
}
