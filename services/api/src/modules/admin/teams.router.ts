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

async function archiveTeam(teamId: string, actor: User) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    throw new Error('TEAM_NOT_FOUND');
  }

  const managedEventIds = await getManagedEventIds(actor);
  if (managedEventIds && !managedEventIds.includes(team.eventId)) {
    throw new Error('ACCESS_DENIED');
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.eventTeamInvitation.updateMany({
      where: {
        teamId,
        status: { in: ['PENDING_ACCOUNT', 'PENDING_RESPONSE'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    await tx.eventTeam.update({
      where: { id: teamId },
      data: {
        status: 'ARCHIVED',
      },
    });
  });

  return prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { id: true, title: true, slug: true } },
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      invitations: true,
      changeRequests: true,
    },
  });
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
  } else {
    where['status'] = { notIn: ['REJECTED', 'ARCHIVED'] };
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

// GET /admin/teams/:teamId
adminTeamsRouter.get('/:teamId', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId } = req.params;

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { id: true, title: true, slug: true } },
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      invitations: {
        where: { status: { in: ['PENDING_ACCOUNT', 'PENDING_RESPONSE'] } },
        select: { id: true, inviteeEmail: true, status: true },
      },
      changeRequests: {
        where: { status: { in: ['PENDING'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!team) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(team.eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({ data: team });
});

// PATCH /admin/teams/:teamId/status
adminTeamsRouter.patch('/:teamId/status', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId } = req.params;
  const { status, notes } = req.body;

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(team.eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const allowedStatuses = ['DRAFT', 'SUBMITTED', 'REJECTED', 'ARCHIVED', 'CHANGES_PENDING', 'ACTIVE', 'PENDING'];
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const updated = await prisma.eventTeam.update({
    where: { id: teamId },
    data: { status },
  });

  res.json({ data: updated });
});

// POST /admin/teams/:teamId/remove - мягкое удаление команды с мероприятия
adminTeamsRouter.post('/:teamId/remove', async (req, res) => {
  const user = (req as any).user as User;

  try {
    const data = await archiveTeam(req.params.teamId!, user);
    res.json({ data });
  } catch (err: any) {
    if (err.message === 'TEAM_NOT_FOUND') {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    throw err;
  }
});

// POST /admin/teams/:teamId/archive
adminTeamsRouter.post('/:teamId/archive', async (req, res) => {
  const user = (req as any).user as User;

  try {
    const data = await archiveTeam(req.params.teamId!, user);
    res.json({ data });
  } catch (err: any) {
    if (err.message === 'TEAM_NOT_FOUND') {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    throw err;
  }
});
