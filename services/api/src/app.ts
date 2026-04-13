import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, requestIdMiddleware, requestLogger } from './common/middleware.js';

import { authRouter } from './modules/auth/auth.router.js';
import { eventsRouter } from './modules/events/events.router.js';
import { registrationsRouter } from './modules/registrations/registrations.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { analyticsRouter } from './modules/analytics/analytics.router.js';
import { volunteersRouter } from './modules/volunteers/volunteers.router.js';
import { uploadsRouter } from './modules/uploads/uploads.router.js';

export function createApp() {
  const app = express();

  // ─── Global middleware ────────────────────────────────────────────────────
  app.use(requestIdMiddleware);
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.isDev ? 'dev' : 'combined'));
  app.use(requestLogger);

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      // Check database connectivity
      await import('./db/prisma.js').then(m => m.prisma.$queryRaw`SELECT 1`);
      res.json({ status: 'ready', ts: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: 'unavailable', ts: new Date().toISOString() });
    }
  });

  // ─── API routes ───────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/me', registrationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/volunteers', volunteersRouter);
  app.use('/api/uploads', uploadsRouter);

  // ─── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ─── Error handler (must be last) ────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
