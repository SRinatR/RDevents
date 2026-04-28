import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { canManageEvent } from '../../common/middleware.js';
import { OPEN_CHANGE_REQUEST_STATUSES } from '../events/team-governance.js';

const OPEN_INVITATION_STATUSES = ['PENDING_ACCOUNT', 'PENDING_RESPONSE'];
const LIVE_TEAM_MEMBER_STATUSES = ['ACTIVE', 'PENDING'];

const teamDetailsInclude = {
  event: { select: { id: true, title: true, slug: true, requireAdminApprovalForTeams: true } },
  captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true } },
    },
    orderBy: { joinedAt: 'asc' },
  },
  invitations: {
    where: { status: { in: OPEN_INVITATION_STATUSES as any[] } },
    select: { id: true, inviteeEmail: true, status: true, slotIndex: true, createdAt: true },
  },
  changeRequests: {
    where: { status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] as any[] } },
    include: {
      requestedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  history: {
    orderBy: { createdAt: 'desc' },
    take: 30,
  },
  _count: { select: { members: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.EventTeamInclude;

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

async function findManagedTeam(teamId: string, actor: User, eventId?: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { id: true, requireAdminApprovalForTeams: true } } },
  });

  if (!team) throw new Error('TEAM_NOT_FOUND');
  if (eventId && team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!(await canManageEvent(actor, team.eventId))) throw new Error('ACCESS_DENIED');
  return team;
}

async function getActiveManagedTeamDetails(teamId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      ...teamDetailsInclude,
      history: {
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
  });

  return decorateTeamHistory(team);
}

async function resolveActiveUser(input: { userId?: string; email?: string }) {
  const user = input.userId
    ? await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, name: true, isActive: true },
      })
    : await prisma.user.findUnique({
        where: { email: normalizeEmail(input.email)! },
        select: { id: true, email: true, name: true, isActive: true },
      });

  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.isActive) throw new Error('USER_DISABLED');
  return user;
}

async function ensureActiveEventParticipant(tx: any, eventId: string, userId: string, actorId: string) {
  const now = new Date();
  const existing = await tx.eventMember.findUnique({
    where: {
      eventId_userId_role: {
        eventId,
        userId,
        role: 'PARTICIPANT',
      },
    },
  });

  if (existing?.status === 'ACTIVE') return existing;

  const membership = await tx.eventMember.upsert({
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
      assignedByUserId: actorId,
      assignedAt: now,
    },
  });

  return membership;
}

async function buildTeamSnapshot(tx: any, teamId: string) {
  const team = await tx.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      captainUser: { select: { id: true, name: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!team) throw new Error('TEAM_NOT_FOUND');

  return {
    id: team.id,
    eventId: team.eventId,
    name: team.name,
    description: team.description,
    status: team.status,
    captainUserId: team.captainUserId,
    maxSize: team.maxSize,
    members: team.members.map((member: any) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      approvedAt: member.approvedAt,
      removedAt: member.removedAt,
      user: member.user,
    })),
  };
}

async function writeTeamHistory(
  tx: any,
  input: {
    eventId: string;
    teamId: string;
    requestId?: string | null;
    actorUserId?: string | null;
    targetUserId?: string | null;
    action: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    metaJson?: unknown;
    reason?: string | null;
  }
) {
  await tx.eventTeamHistory.create({
    data: {
      eventId: input.eventId,
      teamId: input.teamId,
      requestId: input.requestId ?? null,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action as any,
      beforeJson: input.beforeJson ?? undefined,
      afterJson: input.afterJson ?? undefined,
      metaJson: input.metaJson ?? undefined,
      reason: input.reason ?? null,
    },
  });
}

async function decorateTeamHistory<T extends { history?: Array<any> } | null>(team: T): Promise<T> {
  if (!team?.history?.length) return team;

  const userIds = [...new Set(team.history.flatMap((entry: any) => [entry.actorUserId, entry.targetUserId].filter(Boolean)))];
  if (userIds.length === 0) return team;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const usersById = new Map(users.map((user: any) => [user.id, user]));

  return {
    ...team,
    history: team.history.map((entry: any) => ({
      ...entry,
      actorUser: entry.actorUserId ? usersById.get(entry.actorUserId) ?? null : null,
      targetUser: entry.targetUserId ? usersById.get(entry.targetUserId) ?? null : null,
    })),
  };
}

async function cancelOpenRequests(tx: any, input: { teamId: string; eventId: string; actorUserId: string; reason: string }) {
  const requests = await tx.eventTeamChangeRequest.findMany({
    where: { teamId: input.teamId, status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
    select: { id: true },
  });

  if (requests.length === 0) return;

  const now = new Date();
  await tx.eventTeamChangeRequest.updateMany({
    where: { id: { in: requests.map((item: any) => item.id) } },
    data: {
      status: 'CANCELLED',
      decidedByUserId: input.actorUserId,
      decidedAt: now,
      cancelledAt: now,
      decisionReason: input.reason,
    },
  });

  for (const request of requests) {
    await writeTeamHistory(tx, {
      eventId: input.eventId,
      teamId: input.teamId,
      requestId: request.id,
      actorUserId: input.actorUserId,
      action: 'ADMIN_OPEN_REQUEST_CANCELLED',
      reason: input.reason,
    });
  }
}

async function ensureUsersCanJoinTeam(tx: any, eventId: string, teamId: string, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const [users, otherTeamMembers] = await Promise.all([
    tx.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, isActive: true },
    }),
    tx.eventTeamMember.findMany({
      where: {
        userId: { in: uniqueUserIds },
        teamId: { not: teamId },
        status: { in: [...LIVE_TEAM_MEMBER_STATUSES] },
        team: { eventId },
      },
      select: { userId: true },
    }),
  ]);

  const activeUserIds = new Set(users.filter((user: any) => user.isActive).map((user: any) => user.id));
  for (const userId of uniqueUserIds) {
    if (!activeUserIds.has(userId)) {
      throw new Error(users.some((user: any) => user.id === userId) ? 'USER_DISABLED' : 'USER_NOT_FOUND');
    }
  }

  if (otherTeamMembers.length > 0) throw new Error('USER_ALREADY_IN_OTHER_TEAM');
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

export async function getTeamDetailsForAdmin(teamId: string, actor: User, eventId?: string) {
  await findManagedTeam(teamId, actor, eventId);
  return getActiveManagedTeamDetails(teamId);
}

export async function adminUpdateTeamDetails(
  input: {
    actor: User;
    teamId: string;
    eventId?: string;
    name?: string;
    description?: string | null;
    maxSize?: number;
    status?: string;
    captainUserId?: string;
    reason?: string | null;
  }
) {
  const team = await findManagedTeam(input.teamId, input.actor, input.eventId);

  if (input.captainUserId) {
    await resolveActiveUser({ userId: input.captainUserId });
  }

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: input.actor.id,
      reason: input.reason?.trim() || 'Cancelled after direct admin override.',
    });

    await tx.eventTeam.update({
      where: { id: team.id },
      data: {
        name: input.name ?? undefined,
        description: input.description !== undefined ? input.description : undefined,
        maxSize: input.maxSize ?? undefined,
        status: input.status as any ?? undefined,
      },
    });

    if (input.captainUserId) {
      await ensureActiveEventParticipant(tx, team.eventId, input.captainUserId, input.actor.id);
      await setTeamCaptain(tx, team.id, input.captainUserId);
    }

    const afterJson = await buildTeamSnapshot(tx, team.id);

    if (input.name !== undefined && input.name !== team.name) {
      await writeTeamHistory(tx, {
        eventId: team.eventId,
        teamId: team.id,
        actorUserId: input.actor.id,
        action: 'ADMIN_TEAM_RENAMED',
        beforeJson,
        afterJson,
        reason: input.reason ?? null,
      });
    }

    if (input.description !== undefined && input.description !== team.description) {
      await writeTeamHistory(tx, {
        eventId: team.eventId,
        teamId: team.id,
        actorUserId: input.actor.id,
        action: 'ADMIN_TEAM_DESCRIPTION_UPDATED',
        beforeJson,
        afterJson,
        reason: input.reason ?? null,
      });
    }

    if (input.status !== undefined && input.status !== team.status) {
      await writeTeamHistory(tx, {
        eventId: team.eventId,
        teamId: team.id,
        actorUserId: input.actor.id,
        action: input.status === 'APPROVED' ? 'ADMIN_TEAM_APPROVED' : input.status === 'REJECTED' ? 'ADMIN_TEAM_REJECTED' : 'TEAM_DETAILS_UPDATED',
        beforeJson,
        afterJson,
        reason: input.reason ?? null,
      });
    }

    if (input.maxSize !== undefined && input.maxSize !== team.maxSize && input.name === undefined && input.description === undefined && input.status === undefined) {
      await writeTeamHistory(tx, {
        eventId: team.eventId,
        teamId: team.id,
        actorUserId: input.actor.id,
        action: 'TEAM_DETAILS_UPDATED',
        beforeJson,
        afterJson,
        reason: input.reason ?? null,
      });
    }

    if (input.captainUserId && input.captainUserId !== team.captainUserId) {
      await writeTeamHistory(tx, {
        eventId: team.eventId,
        teamId: team.id,
        actorUserId: input.actor.id,
        targetUserId: input.captainUserId,
        action: 'ADMIN_CAPTAIN_CHANGED',
        beforeJson,
        afterJson,
        reason: input.reason ?? null,
      });
    }
  });

  return getActiveManagedTeamDetails(team.id);
}

export async function adminAddTeamMember(
  input: {
    actor: User;
    teamId: string;
    eventId?: string;
    userId?: string;
    email?: string;
    role?: 'CAPTAIN' | 'MEMBER';
    status?: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED' | 'LEFT';
    reason?: string | null;
  }
) {
  const team = await findManagedTeam(input.teamId, input.actor, input.eventId);
  const user = await resolveActiveUser({ userId: input.userId, email: input.email });

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await ensureUsersCanJoinTeam(tx, team.eventId, team.id, [user.id]);
    await ensureActiveEventParticipant(tx, team.eventId, user.id, input.actor.id);
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: input.actor.id,
      reason: input.reason?.trim() || 'Cancelled after direct admin team member addition.',
    });

    await tx.eventTeamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      create: {
        teamId: team.id,
        userId: user.id,
        role: input.role ?? 'MEMBER',
        status: input.status ?? 'ACTIVE',
        approvedAt: (input.status ?? 'ACTIVE') === 'ACTIVE' ? new Date() : null,
      },
      update: {
        role: input.role ?? 'MEMBER',
        status: input.status ?? 'ACTIVE',
        approvedAt: (input.status ?? 'ACTIVE') === 'ACTIVE' ? new Date() : undefined,
        removedAt: ['REMOVED', 'LEFT'].includes(input.status ?? 'ACTIVE') ? new Date() : null,
      },
    });

    if ((input.role ?? 'MEMBER') === 'CAPTAIN') {
      await setTeamCaptain(tx, team.id, user.id);
    }

    const afterJson = await buildTeamSnapshot(tx, team.id);
    await writeTeamHistory(tx, {
      eventId: team.eventId,
      teamId: team.id,
      actorUserId: input.actor.id,
      targetUserId: user.id,
      action: (input.role ?? 'MEMBER') === 'CAPTAIN' ? 'ADMIN_CAPTAIN_CHANGED' : 'ADMIN_MEMBER_ADDED',
      beforeJson,
      afterJson,
      reason: input.reason ?? null,
    });
  });

  return getActiveManagedTeamDetails(team.id);
}

export async function adminRemoveTeamMember(
  input: {
    actor: User;
    teamId: string;
    eventId?: string;
    userId: string;
    reason?: string | null;
  }
) {
  const team = await findManagedTeam(input.teamId, input.actor, input.eventId);
  if (team.captainUserId === input.userId) throw new Error('CANNOT_REMOVE_CAPTAIN');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: input.userId } },
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: input.actor.id,
      reason: input.reason?.trim() || 'Cancelled after direct admin team member removal.',
    });
    await tx.eventTeamMember.update({
      where: { id: member.id },
      data: { status: 'REMOVED', removedAt: new Date(), role: 'MEMBER' },
    });
    const afterJson = await buildTeamSnapshot(tx, team.id);
    await writeTeamHistory(tx, {
      eventId: team.eventId,
      teamId: team.id,
      actorUserId: input.actor.id,
      targetUserId: input.userId,
      action: 'ADMIN_MEMBER_REMOVED',
      beforeJson,
      afterJson,
      reason: input.reason ?? null,
    });
  });

  return getActiveManagedTeamDetails(team.id);
}

export async function adminReplaceTeamMember(
  input: {
    actor: User;
    teamId: string;
    eventId?: string;
    oldUserId: string;
    newUserId?: string;
    newUserEmail?: string;
    reason?: string | null;
  }
) {
  const team = await findManagedTeam(input.teamId, input.actor, input.eventId);
  if (team.captainUserId === input.oldUserId) throw new Error('CANNOT_REMOVE_CAPTAIN');
  const replacementUser = await resolveActiveUser({ userId: input.newUserId, email: input.newUserEmail });
  const currentMember = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: input.oldUserId } },
  });
  if (!currentMember) throw new Error('MEMBER_NOT_FOUND');
  if (currentMember.userId === replacementUser.id) throw new Error('USER_ALREADY_IN_TEAM');

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await ensureUsersCanJoinTeam(tx, team.eventId, team.id, [replacementUser.id]);
    await ensureActiveEventParticipant(tx, team.eventId, replacementUser.id, input.actor.id);
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: input.actor.id,
      reason: input.reason?.trim() || 'Cancelled after direct admin team member replacement.',
    });

    await tx.eventTeamMember.update({
      where: { id: currentMember.id },
      data: { status: 'REMOVED', removedAt: new Date(), role: 'MEMBER' },
    });

    await tx.eventTeamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: replacementUser.id } },
      create: {
        teamId: team.id,
        userId: replacementUser.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      update: {
        role: 'MEMBER',
        status: 'ACTIVE',
        removedAt: null,
        approvedAt: new Date(),
      },
    });

    const afterJson = await buildTeamSnapshot(tx, team.id);
    await writeTeamHistory(tx, {
      eventId: team.eventId,
      teamId: team.id,
      actorUserId: input.actor.id,
      targetUserId: replacementUser.id,
      action: 'ADMIN_MEMBER_REPLACED',
      beforeJson,
      afterJson,
      metaJson: { oldUserId: input.oldUserId, newUserId: replacementUser.id },
      reason: input.reason ?? null,
    });
  });

  return getActiveManagedTeamDetails(team.id);
}

export async function adminTransferTeamCaptain(
  input: {
    actor: User;
    teamId: string;
    eventId?: string;
    userId: string;
    reason?: string | null;
  }
) {
  const team = await findManagedTeam(input.teamId, input.actor, input.eventId);
  const user = await resolveActiveUser({ userId: input.userId });

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await ensureUsersCanJoinTeam(tx, team.eventId, team.id, [user.id]);
    await ensureActiveEventParticipant(tx, team.eventId, user.id, input.actor.id);
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: input.actor.id,
      reason: input.reason?.trim() || 'Cancelled after direct admin captain change.',
    });
    await setTeamCaptain(tx, team.id, user.id);
    const afterJson = await buildTeamSnapshot(tx, team.id);
    await writeTeamHistory(tx, {
      eventId: team.eventId,
      teamId: team.id,
      actorUserId: input.actor.id,
      targetUserId: user.id,
      action: 'ADMIN_CAPTAIN_CHANGED',
      beforeJson,
      afterJson,
      reason: input.reason ?? null,
    });
  });

  return getActiveManagedTeamDetails(team.id);
}

export async function adminReplaceTeamRoster(
  input: {
    actor: User;
    teamId: string;
    eventId?: string;
    memberUserIds: string[];
    captainUserId?: string;
    name?: string;
    description?: string | null;
    status?: string;
    reason: string;
  }
) {
  const team = await findManagedTeam(input.teamId, input.actor, input.eventId);
  const memberUserIds = [...new Set(input.memberUserIds.filter(Boolean))];
  const captainUserId = input.captainUserId || memberUserIds[0];

  if (memberUserIds.length === 0) throw new Error('TEAM_EMPTY');
  if (!captainUserId) throw new Error('TARGET_MEMBER_NOT_ACTIVE');
  if (!memberUserIds.includes(captainUserId)) memberUserIds.unshift(captainUserId);

  await resolveActiveUser({ userId: captainUserId });

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await ensureUsersCanJoinTeam(tx, team.eventId, team.id, memberUserIds);
    for (const userId of memberUserIds) {
      await ensureActiveEventParticipant(tx, team.eventId, userId, input.actor.id);
    }
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: input.actor.id,
      reason: input.reason,
    });

    const existingMembers = await tx.eventTeamMember.findMany({
      where: { teamId: team.id },
    });
    const targetUserIds = new Set(memberUserIds);

    for (const member of existingMembers) {
      if (!targetUserIds.has(member.userId) && !['REMOVED', 'LEFT'].includes(member.status)) {
        await tx.eventTeamMember.update({
          where: { id: member.id },
          data: { status: 'REMOVED', removedAt: new Date(), role: 'MEMBER' },
        });
      }
    }

    for (const userId of memberUserIds) {
      await tx.eventTeamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId } },
        create: {
          teamId: team.id,
          userId,
          role: userId === captainUserId ? 'CAPTAIN' : 'MEMBER',
          status: 'ACTIVE',
          approvedAt: new Date(),
        },
        update: {
          role: userId === captainUserId ? 'CAPTAIN' : 'MEMBER',
          status: 'ACTIVE',
          removedAt: null,
          approvedAt: new Date(),
        },
      });
    }

    await tx.eventTeam.update({
      where: { id: team.id },
      data: {
        captainUserId,
        name: input.name ?? undefined,
        description: input.description !== undefined ? input.description : undefined,
        status: input.status as any ?? undefined,
      },
    });

    const afterJson = await buildTeamSnapshot(tx, team.id);
    await writeTeamHistory(tx, {
      eventId: team.eventId,
      teamId: team.id,
      actorUserId: input.actor.id,
      targetUserId: captainUserId,
      action: 'ADMIN_ROSTER_REPLACED',
      beforeJson,
      afterJson,
      metaJson: { memberUserIds, captainUserId },
      reason: input.reason,
    });
  });

  return getActiveManagedTeamDetails(team.id);
}

export async function archiveTeamForAdmin(teamId: string, actor: User) {
  const team = await findManagedTeam(teamId, actor);

  await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, team.id);
    await cancelOpenRequests(tx, {
      teamId: team.id,
      eventId: team.eventId,
      actorUserId: actor.id,
      reason: 'Cancelled after archiving the team.',
    });
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
    const afterJson = await buildTeamSnapshot(tx, team.id);
    await writeTeamHistory(tx, {
      eventId: team.eventId,
      teamId: team.id,
      actorUserId: actor.id,
      action: 'TEAM_DETAILS_UPDATED',
      beforeJson,
      afterJson,
      reason: 'Team archived by admin.',
    });
  });

  return getActiveManagedTeamDetails(teamId);
}
