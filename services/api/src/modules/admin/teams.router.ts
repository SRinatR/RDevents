import { Router } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { listTeamsQuerySchema } from './teams.schemas.js';

export const adminTeamsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

async function getManagedEventIds(user: User) {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;

  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });

  return memberships.map(m => m.eventId);
}

// GET /admin/teams
adminTeamsRouter.get('/', async (req, res) => {
  const user = (req as any).user as User;

  const parsed = listTeamsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }

  const { search, eventId, status, page, limit } = parsed.data;
  const managedEventIds = await getManagedEventIds(user);

  if (managedEventIds && managedEventIds.length === 0) {
    res.json({ data: [], meta: { total: 0, page, limit, pages: 0 } });
    return;
  }

  const where: Record<string, unknown> = {};

  if (managedEventIds) {
    where['eventId'] = eventId ? { in: managedEventIds.filter(id => id === eventId) } : { in: managedEventIds };
  } else if (eventId) {
    where['eventId'] = eventId;
  }

  if (status && status !== 'ALL') {
    where['status'] = status;
  }

  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, teams] = await Promise.all([
    prisma.eventTeam.count({ where: where as any }),
    prisma.eventTeam.findMany({
      where: where as any,
      include: {
        event: { select: { id: true, title: true, slug: true } },
        captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const data = teams.map(team => ({
    id: team.id,
    name: team.name,
    eventId: team.eventId,
    eventTitle: team.event?.title ?? '',
    captainUserId: team.captainUserId,
    captainUserName: team.captainUser?.name ?? null,
    membersCount: team._count.members,
    status: team.status,
    createdAt: team.createdAt.toISOString(),
  }));

  res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});
