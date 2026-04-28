import { Router } from 'express';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  adminTeamMemberSchema,
  listTeamsQuerySchema,
  transferAdminTeamCaptainSchema,
  updateAdminTeamMemberSchema,
  updateAdminTeamSchema,
} from './teams.schemas.js';

export const adminTeamsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const OPEN_INVITATION_STATUSES = ['PENDING_ACCOUNT', 'PENDING_RESPONSE'];

async function getManagedEventIds(user: User) {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;

  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });

  return memberships.map(m => m.eventId);
}

const teamDetailsInclude = {
  event: { select: { id: true, title: true, slug: true } },
  captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: 'asc' },
  },
  invitations: {
    where: { status: { in: OPEN_INVITATION_STATUSES as any[] } },
    select: { id: true, inviteeEmail: true, status: true },
  },
  changeRequests: {
    where: { status: { in: ['DRAFT', 'WAITING_INVITEE', 'PENDING'] as any[] } },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.EventTeamInclude;

async function findTeamForAdmin(teamId: string, actor: User) {
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

  return team;
}

async function getTeamDetails(teamId: string) {
  return prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: teamDetailsInclude,
  });
}

async function resolveUserRef(input: { userId?: string; email?: string }) {
  if (input.userId) {
    return prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true },
    });
  }

  return prisma.user.findUnique({
    where: { email: input.email!.toLowerCase() },
    select: { id: true, email: true },
  });
}

async function ensureEventParticipant(tx: any, eventId: string, userId: string, actorId: string) {
  const now = new Date();
  return tx.eventMember.upsert({
    where: {
      eventId_userId_role: {
        eventId,
        userId,
        role: 'PARTICIPANT',
      },
    },
    create: {
      eventId,
      userId,
      role: 'PARTICIPANT',
      status: 'ACTIVE',
      assignedByUserId: actorId,
      approvedAt: now,
    },
    update: {
      status: 'ACTIVE',
      removedAt: null,
      rejectedAt: null,
      approvedAt: now,
    },
  });
}

async function setTeamCaptain(tx: any, teamId: string, newCaptainUserId: string) {
  await tx.eventTeamMember.updateMany({
    where: { teamId, role: 'CAPTAIN' },
    data: { role: 'MEMBER' },
  });

  await tx.eventTeamMember.upsert({
    where: { teamId_userId: { teamId, userId: newCaptainUserId } },
    create: {
      teamId,
      userId: newCaptainUserId,
      role: 'CAPTAIN',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
    update: {
      role: 'CAPTAIN',
      status: 'ACTIVE',
      removedAt: null,
      approvedAt: new Date(),
    },
  });

  await tx.eventTeam.update({
    where: { id: teamId },
    data: { captainUserId: newCaptainUserId },
  });
}

async function archiveTeam(teamId: string, actor: User) {
  await findTeamForAdmin(teamId, actor);

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

  return getTeamDetails(teamId);
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

  try {
    await findTeamForAdmin(teamId, user);
    const team = await getTeamDetails(teamId);
    res.json({ data: team });
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

// PATCH /admin/teams/:teamId
adminTeamsRouter.patch('/:teamId', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId } = req.params;

  const parsed = updateAdminTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const team = await findTeamForAdmin(teamId, user);

    if (parsed.data.captainUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: parsed.data.captainUserId },
        select: { id: true },
      });
      if (!targetUser) {
        res.status(404).json({ error: 'Captain user not found' });
        return;
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.eventTeam.update({
        where: { id: teamId },
        data: {
          name: parsed.data.name ?? undefined,
          description: parsed.data.description !== undefined ? parsed.data.description : undefined,
          maxSize: parsed.data.maxSize ?? undefined,
          status: parsed.data.status ?? undefined,
        },
      });

      if (parsed.data.captainUserId) {
        await ensureEventParticipant(tx, team.eventId, parsed.data.captainUserId, user.id);
        await setTeamCaptain(tx, teamId, parsed.data.captainUserId);
      }
    });

    res.json({ data: await getTeamDetails(teamId) });
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

// POST /admin/teams/:teamId/members
adminTeamsRouter.post('/:teamId/members', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId } = req.params;

  const parsed = adminTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const [team, targetUser] = await Promise.all([
      findTeamForAdmin(teamId, user),
      resolveUserRef(parsed.data),
    ]);

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const activeCount = await prisma.eventTeamMember.count({
      where: { teamId, status: 'ACTIVE' },
    });
    const alreadyActive = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUser.id } },
      select: { status: true },
    });

    if (parsed.data.status === 'ACTIVE' && alreadyActive?.status !== 'ACTIVE' && activeCount >= team.maxSize) {
      res.status(400).json({ error: 'Team is full' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      await ensureEventParticipant(tx, team.eventId, targetUser.id, user.id);

      await tx.eventTeamMember.upsert({
        where: { teamId_userId: { teamId, userId: targetUser.id } },
        create: {
          teamId,
          userId: targetUser.id,
          role: parsed.data.role,
          status: parsed.data.status,
          approvedAt: parsed.data.status === 'ACTIVE' ? new Date() : null,
        },
        update: {
          role: parsed.data.role,
          status: parsed.data.status,
          removedAt: null,
          approvedAt: parsed.data.status === 'ACTIVE' ? new Date() : undefined,
        },
      });

      if (parsed.data.role === 'CAPTAIN') {
        await setTeamCaptain(tx, teamId, targetUser.id);
      }
    });

    res.status(201).json({ data: await getTeamDetails(teamId) });
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

// PATCH /admin/teams/:teamId/members/:userId
adminTeamsRouter.patch('/:teamId/members/:userId', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId, userId } = req.params;

  const parsed = updateAdminTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const team = await findTeamForAdmin(teamId, user);
    const member = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    if (team.captainUserId === userId && parsed.data.role === 'MEMBER') {
      res.status(400).json({ error: 'Transfer captain before changing the current captain role.' });
      return;
    }

    if (
      team.captainUserId === userId &&
      parsed.data.status &&
      ['REJECTED', 'REMOVED', 'LEFT'].includes(parsed.data.status)
    ) {
      res.status(400).json({ error: 'Transfer captain before deactivating the current captain.' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.eventTeamMember.update({
        where: { id: member.id },
        data: {
          role: parsed.data.role ?? undefined,
          status: parsed.data.status ?? undefined,
          removedAt: parsed.data.status === 'REMOVED' || parsed.data.status === 'LEFT' ? new Date() : undefined,
          approvedAt: parsed.data.status === 'ACTIVE' ? new Date() : undefined,
        },
      });

      if (parsed.data.role === 'CAPTAIN') {
        await setTeamCaptain(tx, teamId, userId);
      }
    });

    res.json({ data: await getTeamDetails(teamId) });
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

// POST /admin/teams/:teamId/captain
adminTeamsRouter.post('/:teamId/captain', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId } = req.params;

  const parsed = transferAdminTeamCaptainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const team = await findTeamForAdmin(teamId, user);
    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      await ensureEventParticipant(tx, team.eventId, targetUser.id, user.id);
      await setTeamCaptain(tx, teamId, targetUser.id);
    });

    res.json({ data: await getTeamDetails(teamId) });
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

// DELETE /admin/teams/:teamId/members/:userId
adminTeamsRouter.delete('/:teamId/members/:userId', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId, userId } = req.params;

  try {
    const team = await findTeamForAdmin(teamId, user);
    const member = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    if (team.captainUserId === userId) {
      const replacement = await prisma.eventTeamMember.findFirst({
        where: {
          teamId,
          userId: { not: userId },
          status: 'ACTIVE',
        },
        orderBy: { joinedAt: 'asc' },
      });

      if (!replacement) {
        res.status(400).json({ error: 'Cannot remove the only active captain. Transfer captain first or add another active member.' });
        return;
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.eventTeamMember.update({
          where: { id: member.id },
          data: { status: 'REMOVED', role: 'MEMBER', removedAt: new Date() },
        });
        await setTeamCaptain(tx, teamId, replacement.userId);
      });
    } else {
      await prisma.eventTeamMember.update({
        where: { id: member.id },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
    }

    res.json({ data: await getTeamDetails(teamId) });
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

// PATCH /admin/teams/:teamId/status
adminTeamsRouter.patch('/:teamId/status', async (req, res) => {
  const user = (req as any).user as User;
  const { teamId } = req.params;
  const { status } = req.body;

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

  const allowedStatuses = ['DRAFT', 'SUBMITTED', 'REJECTED', 'ARCHIVED', 'CHANGES_PENDING', 'ACTIVE', 'APPROVED', 'PENDING', 'NEEDS_ATTENTION'];
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

// DELETE /admin/teams/:teamId
adminTeamsRouter.delete('/:teamId', async (req, res) => {
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
