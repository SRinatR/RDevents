import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, requestIdMiddleware, requestLogger } from './common/middleware.js';
import { getMediaUploadDir } from './common/storage.js';
import { buildReleasePayload, releaseSha } from './common/release.js';

import { authRouter } from './modules/auth/auth.router.js';
import { eventsRouter } from './modules/events/events.router.js';
import { registrationsRouter } from './modules/registrations/registrations.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { adminEmailRouter } from './modules/admin-email/admin-email.router.js';
import { analyticsRouter } from './modules/analytics/analytics.router.js';
import { volunteersRouter } from './modules/volunteers/volunteers.router.js';
import { uploadsRouter } from './modules/uploads/uploads.router.js';
import { referenceRouter } from './modules/reference/reference.router.js';
import { supportRouter } from './modules/support/support.router.js';
import { resendWebhookRouter } from './modules/webhooks/resend.router.js';
import { passwordResetRouter } from './modules/password-reset/password-reset.router.js';
import { dashboardRouter } from './modules/dashboard/dashboard.router.js';
import { calendarRouter } from './modules/calendar/calendar.router.js';
import { prisma } from './db/prisma.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  const corsOrigin = env.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // ─── Global middleware ────────────────────────────────────────────────────
  app.use(requestIdMiddleware);
  app.use(cors({
    origin: corsOrigin.length > 1 ? corsOrigin : (corsOrigin[0] ?? env.CORS_ORIGIN),
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(morgan(env.isDev ? 'dev' : 'combined'));
  app.use(requestLogger);
  app.use('/webhooks/resend', resendWebhookRouter);
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(getMediaUploadDir(), { fallthrough: true }));

  // ─── Health check ─────────────────────────────────────────────────────────
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', service: 'event-platform-api', ts: new Date().toISOString() });
  };

  const versionTextHandler = (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(releaseSha);
  };

  const releaseJsonHandler = (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildReleasePayload('event-platform-api'));
  };

  const readyHandler = async (_req: express.Request, res: express.Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready', database: 'ok', ts: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: 'unavailable', database: 'unavailable', ts: new Date().toISOString() });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);
  app.get('/version', versionTextHandler);
  app.get('/api/version', versionTextHandler);
  app.get('/ready', readyHandler);
  app.get('/api/ready', readyHandler);
  app.get('/release.json', releaseJsonHandler);
  app.get('/api/release.json', releaseJsonHandler);

  // ─── API routes ───────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/auth/password', passwordResetRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/events/calendar', calendarRouter);
  app.use('/api/me', registrationsRouter);
  app.use('/api/me/dashboard', dashboardRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/email', adminEmailRouter);
  app.use('/api/admin/calendar', calendarRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/volunteers', volunteersRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/reference', referenceRouter);
  app.use('/api/support', supportRouter);

  // ─── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ─── Error handler (must be last) ────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
