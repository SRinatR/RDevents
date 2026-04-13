import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import type { AnalyticsEventType, AuthProvider } from '@prisma/client';
import { optionalAuth } from '../../common/middleware.js';

export const analyticsRouter = Router();

// POST /api/analytics/track — fire-and-forget analytics event
analyticsRouter.post('/track', optionalAuth, async (req, res) => {
  const { type, eventId, authProvider, sessionId, locale, path, meta } = req.body;
  const userId = (req as any).user?.id ?? null;

  // Validate type against known enum values
  const validTypes: AnalyticsEventType[] = [
    'HOME_VIEW', 'EVENTS_LIST_VIEW', 'EVENT_DETAIL_VIEW',
    'REGISTER_CLICK', 'EVENT_REGISTRATION', 'USER_REGISTER',
    'USER_LOGIN', 'PROVIDER_USED',
  ];

  if (!validTypes.includes(type)) {
    res.status(400).json({ error: 'Invalid analytics event type' });
    return;
  }

  // Don't block response on DB write — analytics is non-critical
  prisma.analyticsEvent.create({
    data: {
      type,
      userId,
      eventId: eventId ?? null,
      authProvider: authProvider as AuthProvider ?? null,
      sessionId: sessionId ?? null,
      locale: locale ?? null,
      path: path ?? null,
      meta: meta ?? null,
    },
  }).catch(console.error);

  res.status(202).json({ ok: true });
});

// GET /api/analytics/summary — public summary (detailed version in admin)
analyticsRouter.get('/summary', async (_req, res) => {
  const [totalUsers, totalEvents, totalRegistrations, totalViews] = await Promise.all([
    prisma.user.count(),
    prisma.event.count({ where: { status: 'PUBLISHED' } }),
    prisma.eventMember.count({ where: { role: 'PARTICIPANT', status: { in: ['ACTIVE', 'APPROVED'] } } }),
    prisma.analyticsEvent.count({ where: { type: 'EVENT_DETAIL_VIEW' } }),
  ]);

  res.json({ totalUsers, totalEvents, totalRegistrations, totalEventViews: totalViews });
});
