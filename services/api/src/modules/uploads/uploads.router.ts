import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';

export const uploadsRouter = Router();

// Placeholder — file upload endpoint.
// In production: integrate S3/Cloudflare R2/local disk + multipart parser.
uploadsRouter.post('/', authenticate, (_req, res) => {
  res.status(501).json({
    error: 'File upload not implemented in MVP. Use external image URLs (coverImageUrl field).',
  });
});
