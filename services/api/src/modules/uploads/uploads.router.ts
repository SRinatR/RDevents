import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middleware.js';
import { saveUploadedFile } from '../../common/storage.js';

export const uploadsRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_COVER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// POST /api/uploads/event-cover — upload event cover and return a public URL.
uploadsRouter.post('/event-cover', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File is required' });
    return;
  }
  if (!ALLOWED_COVER_MIME_TYPES.has(req.file.mimetype)) {
    res.status(400).json({ error: 'Accepted cover formats: JPEG, PNG, WebP' });
    return;
  }

  const stored = await saveUploadedFile({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    originalFilename: req.file.originalname,
    folder: 'event-covers',
  });

  res.status(201).json({ publicUrl: stored.publicUrl, storageKey: stored.storageKey });
});

uploadsRouter.post('/', authenticate, (_req, res) => {
  res.status(400).json({
    error: 'Choose a specific upload endpoint',
  });
});
