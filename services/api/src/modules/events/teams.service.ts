import { prisma } from '../../db/prisma.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import {
  notifyTeamCreated,
  notifyTeamMemberChanged,
  notifyTeamUpdated,
} from './notifications.service.js';
import { assertEmailInviteTeamReady, markMemberInvitationRemoved } from './team-invitations.service.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const ACTIVE_TEAM_MEMBER_STATUSES = ['ACTIVE', 'PENDING'] as const;
const PLATFORM_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;
const EDITABLE_TEAM_STATUSES = ['DRAFT', 'REJECTED'] as const;

async function canManageTeamMembers(eventId: string, teamCaptainUserId: string, actorUserId: string) {
  if (teamCaptainUserId === actorUserId) return true;

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (actor && PLATFORM_ADMIN_ROLES.includes(actor.role as any)) return true;

  const eventAdmin = await prisma.eventMember.findFirst({
    where: {
      eventId,
      userId: actorUserId,
      role: 'EVENT_ADMIN',
      status: { in: [...ACTIVE_MEMBER_STATUSES] },
    },
    select: { id: true },
  });

  return Boolean(eventAdmin);
}

async function assertApprovedParticipant(eventId: string, userId: string) {
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
    select: { id: true, status: true },
  });

  if (!membership || !ACTIVE_MEMBER_STATUSES.includes(membership.status as any)) {
    throw new Error('PARTICIPANT_APPROVAL_REQUIRED');
  }

  return membership;
}

async function getProposedMemberUserIds(teamId: string, extraUserIds: string[] = []) {
  const members = await prisma.eventTeamMember.findMany({
    where: { teamId, status: { in: ['ACTIVE', 'PENDING'] } },
    select: { userId: true },
  });
  return [...new Set([...members.map(member => member.userId), ...extraUserIds])];
}

async function upsertPendingTeamChangeRequest(
  tx: any,
  team: { id: string; name: string; description: string | null; status: string; captainUserId: string },
  requestedByUserId: string,
  data: { name?: string; description?: string | null; memberUserIds?: string[] }
) {
  const proposedMemberUserIds = data.memberUserIds ?? await getProposedMemberUserIds(team.id);
  const existing = await tx.eventTeamChangeRequest.findFirst({
    where: { teamId: team.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  const payload = {
    requestedByUserId,
    proposedName: data.name ?? team.name,
    proposedDescription: data.description !== undefined ? data.description : team.description,
    proposedMemberUserIds,
  };

  if (existing) {
    return tx.eventTeamChangeRequest.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return tx.eventTeamChangeRequest.create({
    data: {
      teamId: team.id,
      ...payload,
    },
  });
}

async function syncApprovedTeamMembers(tx: any, teamId: string, memberUserIds: string[]) {
  const proposed = new Set(memberUserIds);
  const existing = await tx.eventTeamMember.findMany({
    where: { teamId, status: { in: ['ACTIVE', 'PENDING'] } },
  });

  for (const member of existing) {
    if (proposed.has(member.userId)) {
      if (member.status !== 'ACTIVE') {
        await tx.eventTeamMember.update({
          where: { id: member.id },
          data: { status: 'ACTIVE', approvedAt: new Date(), removedAt: null },
        });
      }
      proposed.delete(member.userId);
    } else if (member.role !== 'CAPTAIN') {
      await tx.eventTeamMember.update({
        where: { id: member.id },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
    }
  }

  for (const userId of proposed) {
    await tx.eventTeamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: {
        teamId,
        userId,
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      update: {
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
        removedAt: null,
      },
    });
  }
}

export async function getTeamsByEvent(eventId: string) {
  return prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      captainUser: { select: { id: true, name: true, avatarUrl: true } },
      changeRequests: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTeamById(eventId: string, teamId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        where: { status: { notIn: ['REMOVED', 'LEFT'] } },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'desc' },
      },
      changeRequests: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
  });

  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  return team;
}

export async function createTeam(
  eventId: string,
  userId: string,
  data: { name: string; description?: string; answers?: Record<string, unknown> }
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (!event.isTeamBased) throw new Error('EVENT_NOT_TEAM_BASED');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (!event.registrationEnabled) throw new Error('EVENT_NOT_AVAILABLE');
  await assertApprovedParticipant(eventId, userId);

  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  // Check if user is already in a team for this event
  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: [...ACTIVE_TEAM_MEMBER_STATUSES] } }
  });
  if (existingMembership) throw new Error('ALREADY_IN_TEAM');

  // Generate slug and strict join code
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 6);
  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const team = await prisma.$transaction(async (tx: any) => {
    const teamStatus = event.requireAdminApprovalForTeams ? 'DRAFT' : 'ACTIVE';

    // Create Team
    const team = await tx.eventTeam.create({
      data: {
        eventId,
        name: data.name,
        slug,
        joinCode,
        description: data.description,
        captainUserId: userId,
        status: teamStatus,
        maxSize: event.maxTeamSize,
        members: {
          create: {
            userId,
            role: 'CAPTAIN',
            status: 'ACTIVE', // Captain is active within their own team
            approvedAt: new Date(),
          }
        }
      },
      include: { members: true, changeRequests: true }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_CREATED',
      userId,
      eventId,
      meta: { teamId: team.id, teamName: team.name, status: team.status },
    });

    return team;
  });

  await notifyTeamCreated(eventId, team.id);
  return team;
}

export async function joinTeam(
  eventId: string,
  teamId: string,
  userId: string,
  code?: string,
  answers?: Record<string, unknown>
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (!event.isTeamBased) throw new Error('EVENT_NOT_TEAM_BASED');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (!event.registrationEnabled) throw new Error('EVENT_NOT_AVAILABLE');
  await assertApprovedParticipant(eventId, userId);

  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!['ACTIVE', 'DRAFT', 'REJECTED'].includes(team.status)) throw new Error('TEAM_NOT_ACTIVE');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  if (event.teamJoinMode === 'BY_CODE' && team.joinCode !== code) throw new Error('INVALID_JOIN_CODE');

  const existingTeamMember = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: [...ACTIVE_TEAM_MEMBER_STATUSES] } }
  });
  if (existingTeamMember) throw new Error('ALREADY_IN_TEAM');

  if (event.requireAdminApprovalForTeams && team.status === 'ACTIVE') {
    const changeRequest = await prisma.$transaction(async (tx: any) => {
      const proposedMemberUserIds = await getProposedMemberUserIds(teamId, [userId]);
      const changeRequest = await upsertPendingTeamChangeRequest(tx, team, userId, { memberUserIds: proposedMemberUserIds });
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'CHANGES_PENDING' },
      });
      return changeRequest;
    });

    await notifyTeamMemberChanged(eventId, teamId, userId, 'PENDING');
    return {
      id: changeRequest.id,
      teamId,
      userId,
      role: 'MEMBER',
      status: 'PENDING',
      isChangeRequest: true,
    };
  }

  const member = await prisma.$transaction(async (tx: any) => {
    const isPending = event.teamJoinMode === 'BY_REQUEST';

    // Member record
    const member = await tx.eventTeamMember.create({
      data: {
        teamId,
        userId,
        role: 'MEMBER',
        status: isPending ? 'PENDING' : 'ACTIVE',
        approvedAt: isPending ? null : new Date(),
      }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_JOIN_REQUESTED',
      userId,
      eventId,
      meta: { teamId, status: member.status, mode: event.teamJoinMode },
    });

    return member;
  });

  await notifyTeamMemberChanged(eventId, teamId, userId, member.status);
  return member;
}

export async function joinTeamByCode(
  eventId: string,
  userId: string,
  code: string,
  answers?: Record<string, unknown>
) {
  const normalizedCode = code.trim().toUpperCase();
  const team = await prisma.eventTeam.findFirst({
    where: { eventId, joinCode: normalizedCode },
    select: { id: true },
  });

  if (!team) throw new Error('TEAM_NOT_FOUND');
  return joinTeam(eventId, team.id, userId, normalizedCode, answers);
}

export async function updateTeam(eventId: string, teamId: string, userId: string, data: { name?: string; description?: string }) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true, minTeamSize: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== userId) throw new Error('NOT_TEAM_CAPTAIN');

  if (team.event.requireAdminApprovalForTeams && !EDITABLE_TEAM_STATUSES.includes(team.status as any)) {
    if (team.status === 'PENDING' || team.status === 'CHANGES_PENDING') throw new Error('TEAM_APPROVAL_PENDING');
    const changeRequest = await prisma.$transaction(async (tx: any) => {
      const changeRequest = await upsertPendingTeamChangeRequest(tx, team, userId, data);
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'CHANGES_PENDING' },
      });
      return changeRequest;
    });
    await notifyTeamUpdated(eventId, teamId);
    return { ...team, changeRequests: [changeRequest], status: 'CHANGES_PENDING' };
  }

  const updated = await prisma.eventTeam.update({
    where: { id: teamId },
    data: {
      name: data.name ?? undefined,
      description: data.description !== undefined ? data.description : undefined,
    }
  });

  await notifyTeamUpdated(eventId, teamId);
  return updated;
}

export async function submitTeamForApproval(eventId: string, teamId: string, userId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true, minTeamSize: true, teamJoinMode: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== userId) throw new Error('NOT_TEAM_CAPTAIN');
  if (!team.event.requireAdminApprovalForTeams) return team;
  if (team.status === 'PENDING' || team.status === 'CHANGES_PENDING') throw new Error('TEAM_APPROVAL_PENDING');
  if (!EDITABLE_TEAM_STATUSES.includes(team.status as any)) throw new Error('TEAM_APPROVED_LOCKED');

  if (team.event.teamJoinMode === 'EMAIL_INVITE') {
    await assertEmailInviteTeamReady(teamId);
  }

  const changeRequest = await prisma.$transaction(async (tx: any) => {
    const proposedMemberUserIds = await getProposedMemberUserIds(teamId);
    if (proposedMemberUserIds.length === 0) throw new Error('TEAM_EMPTY');
    if (proposedMemberUserIds.length < team.event.minTeamSize) throw new Error('TEAM_MIN_SIZE');
    const changeRequest = await upsertPendingTeamChangeRequest(tx, team, userId, { memberUserIds: proposedMemberUserIds });
    await tx.eventTeam.update({
      where: { id: teamId },
      data: { status: 'PENDING' },
    });
    return changeRequest;
  });

  await notifyTeamUpdated(eventId, teamId);
  return { ...team, status: 'PENDING', changeRequests: [changeRequest] };
}

export async function leaveTeam(eventId: string, teamId: string, userId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  });
  if (!member) return { ok: true as const };
  if (member.role === 'CAPTAIN' || team.captainUserId === userId) {
    throw new Error('CANNOT_LEAVE_AS_CAPTAIN');
  }

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'REMOVED', removedAt: new Date() }
  });
  await markMemberInvitationRemoved(teamId, userId);
  await notifyTeamMemberChanged(eventId, teamId, userId, 'REMOVED');
  return { ok: true as const };
}

export async function leaveTeamByCurrentUser(userId: string) {
  const membership = await prisma.eventTeamMember.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'PENDING'] },
    },
    include: {
      team: {
        select: {
          id: true,
          eventId: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  if (!membership) {
    return { ok: true as const };
  }

  return leaveTeam(membership.team.eventId, membership.team.id, userId);
}

export async function approveTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { requireAdminApprovalForTeams: true } },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.event.requireAdminApprovalForTeams && !EDITABLE_TEAM_STATUSES.includes(team.status as any)) {
    throw new Error('TEAM_APPROVED_LOCKED');
  }
  if (!(await canManageTeamMembers(eventId, team.captainUserId, captainId))) throw new Error('NOT_TEAM_CAPTAIN');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');
  await assertApprovedParticipant(eventId, memberUserId);

  const updatedMember = await prisma.$transaction(async (tx: any) => {
    const updatedMember = await tx.eventTeamMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE', approvedAt: new Date() }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_MEMBER_APPROVED',
      userId: memberUserId,
      eventId,
      meta: { teamId },
    });

    return updatedMember;
  });

  await notifyTeamMemberChanged(eventId, teamId, memberUserId, 'ACTIVE');
  return updatedMember;
}

export async function rejectTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!(await canManageTeamMembers(eventId, team.captainUserId, captainId))) throw new Error('NOT_TEAM_CAPTAIN');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'REJECTED' }
  });
  await notifyTeamMemberChanged(eventId, teamId, memberUserId, 'REJECTED');
}

export async function removeTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== captainId) throw new Error('NOT_TEAM_CAPTAIN');
  if (team.captainUserId === memberUserId) throw new Error('CANNOT_REMOVE_CAPTAIN');
  if (team.event.requireAdminApprovalForTeams && !EDITABLE_TEAM_STATUSES.includes(team.status as any)) {
    throw new Error('TEAM_APPROVED_LOCKED');
  }

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'REMOVED', removedAt: new Date() }
  });
  await markMemberInvitationRemoved(teamId, memberUserId);
  await notifyTeamMemberChanged(eventId, teamId, memberUserId, 'REMOVED');
  return getTeamById(eventId, teamId);
}

export async function transferTeamCaptain(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== captainId) throw new Error('NOT_TEAM_CAPTAIN');
  if (captainId === memberUserId) throw new Error('CANNOT_TRANSFER_TO_SELF');
  if (team.event.requireAdminApprovalForTeams && !EDITABLE_TEAM_STATUSES.includes(team.status as any)) {
    throw new Error('TEAM_APPROVED_LOCKED');
  }

  const [targetMember, currentCaptainMember] = await Promise.all([
    prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberUserId } }
    }),
    prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: captainId } }
    }),
  ]);

  if (!targetMember || targetMember.status !== 'ACTIVE') throw new Error('TARGET_MEMBER_NOT_ACTIVE');
  if (!currentCaptainMember) throw new Error('MEMBER_NOT_FOUND');

  await prisma.$transaction(async (tx: any) => {
    await tx.eventTeam.update({
      where: { id: teamId },
      data: { captainUserId: memberUserId },
    });
    await tx.eventTeamMember.update({
      where: { id: currentCaptainMember.id },
      data: { role: 'MEMBER' },
    });
    await tx.eventTeamMember.update({
      where: { id: targetMember.id },
      data: { role: 'CAPTAIN' },
    });
  });

  await notifyTeamUpdated(eventId, teamId);
  return getTeamById(eventId, teamId);
}

export async function approveTeamChangeRequest(eventId: string, teamId: string, requestId: string, adminUserId: string, notes?: string) {
  const request = await prisma.eventTeamChangeRequest.findUnique({
    where: { id: requestId },
    include: { team: true },
  });
  if (!request || request.teamId !== teamId || request.team.eventId !== eventId) throw new Error('TEAM_CHANGE_REQUEST_NOT_FOUND');
  if (request.status !== 'PENDING') throw new Error('TEAM_CHANGE_REQUEST_CLOSED');

  const updated = await prisma.$transaction(async (tx: any) => {
    await syncApprovedTeamMembers(tx, teamId, request.proposedMemberUserIds);
    await tx.eventTeamChangeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', decidedByUserId: adminUserId, decidedAt: new Date(), notes },
    });
    const team = await tx.eventTeam.update({
      where: { id: teamId },
      data: {
        name: request.proposedName,
        description: request.proposedDescription,
        status: 'ACTIVE',
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'desc' },
        },
        changeRequests: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return team;
  });

  await notifyTeamUpdated(eventId, teamId);
  return updated;
}

export async function rejectTeamChangeRequest(eventId: string, teamId: string, requestId: string, adminUserId: string, notes?: string) {
  const request = await prisma.eventTeamChangeRequest.findUnique({
    where: { id: requestId },
    include: { team: true },
  });
  if (!request || request.teamId !== teamId || request.team.eventId !== eventId) throw new Error('TEAM_CHANGE_REQUEST_NOT_FOUND');
  if (request.status !== 'PENDING') throw new Error('TEAM_CHANGE_REQUEST_CLOSED');

  const nextTeamStatus = request.team.status === 'PENDING' ? 'REJECTED' : 'ACTIVE';
  const updated = await prisma.$transaction(async (tx: any) => {
    await tx.eventTeamChangeRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', decidedByUserId: adminUserId, decidedAt: new Date(), notes },
    });
    return tx.eventTeam.update({
      where: { id: teamId },
      data: { status: nextTeamStatus },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'desc' },
        },
        changeRequests: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  });

  await notifyTeamUpdated(eventId, teamId);
  return updated;
}
