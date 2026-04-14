import { Router } from 'express';
import { authenticate, requirePlatformAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

export const volunteersRouter = Router();

volunteersRouter.use(authenticate);

// Legacy admin namespace kept for compatibility. New event-scoped volunteer
// management lives under /api/admin/events/:id/volunteers.
volunteersRouter.get('/', requirePlatformAdmin, async (_req, res) => {
  const volunteers = await prisma.eventMember.findMany({
    where: { role: 'VOLUNTEER', status: { not: 'REMOVED' } },
    include: {
      event: { select: { id: true, title: true, slug: true } },
      user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, registeredAt: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });

  res.json({ volunteers });
});

volunteersRouter.patch('/:id/assign', requirePlatformAdmin, async (req, res) => {
  const eventId = req.body?.eventId;
  if (!eventId) {
    res.status(400).json({ error: 'eventId is required for event-scoped volunteer assignment' });
    return;
  }

  const actor = (req as any).user;
  const userId = String(req.params['id']);
  const membership = await prisma.eventMember.upsert({
    where: { eventId_userId_role: { eventId: String(eventId), userId, role: 'VOLUNTEER' } },
    create: {
      eventId: String(eventId),
      userId,
      role: 'VOLUNTEER',
      status: 'ACTIVE',
      assignedByUserId: actor.id,
      approvedAt: new Date(),
    },
    update: {
      status: 'ACTIVE',
      assignedByUserId: actor.id,
      assignedAt: new Date(),
      approvedAt: new Date(),
      rejectedAt: null,
      removedAt: null,
    },
  });

  res.json({ membership });
});

volunteersRouter.patch('/:id/remove', requirePlatformAdmin, async (req, res) => {
  const eventId = req.body?.eventId;
  if (!eventId) {
    res.status(400).json({ error: 'eventId is required for event-scoped volunteer removal' });
    return;
  }

  const membership = await prisma.eventMember.update({
    where: { eventId_userId_role: { eventId: String(eventId), userId: String(req.params['id']), role: 'VOLUNTEER' } },
    data: { status: 'REMOVED', removedAt: new Date() },
  });

  res.json({ membership });
});
