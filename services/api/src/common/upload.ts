import multer from 'multer';

export const SUPPORT_MAX_FILE_SIZE_MB = 10;
export const SUPPORT_MAX_FILES = 5;

export const SUPPORT_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export class SupportUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupportUploadError';
  }
}

export function validateSupportFile(file: Express.Multer.File) {
  if (!file.buffer || file.size <= 0) {
    throw new SupportUploadError('File is empty');
  }
  if (!SUPPORT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new SupportUploadError('File type not allowed. Accepted: JPEG, PNG, WebP, PDF');
  }
  const maxBytes = SUPPORT_MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new SupportUploadError(`File must be ${SUPPORT_MAX_FILE_SIZE_MB} MB or smaller`);
  }
}

export const supportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: SUPPORT_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: SUPPORT_MAX_FILES,
  },
});
