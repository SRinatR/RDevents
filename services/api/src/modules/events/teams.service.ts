import { prisma } from '../../db/prisma.js';
import type { Prisma } from '@prisma/client';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import { assertRegistrationRequirements, getRegistrationPrecheck } from './registration.service.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const ACTIVE_TEAM_MEMBER_STATUSES = ['ACTIVE', 'PENDING'] as const;
const PLATFORM_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;

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

export async function getTeamsByEvent(eventId: string) {
  return prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      captainUser: { select: { id: true, name: true, avatarUrl: true } },
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
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'desc' },
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
  const precheck = await assertRegistrationRequirements(eventId, userId, data.answers, { allowExistingParticipant: true });

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

  return prisma.$transaction(async (tx: any) => {
    const participantCount = await tx.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    });

    // Also create or update EVENT PARTICIPANT membership for Captain
    const existingSolo = await tx.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } }
    });
    if (participantCount >= event.capacity && !existingSolo) throw new Error('EVENT_FULL');

    if (event.requiredEventFields.length > 0) {
      await tx.eventRegistrationFormSubmission.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          answersJson: precheck.answers as Prisma.InputJsonValue,
          isComplete: true,
        },
        update: {
          answersJson: precheck.answers as Prisma.InputJsonValue,
        },
      });
    }

    const isPendingAdmin = event.requireAdminApprovalForTeams;
    const teamStatus = isPendingAdmin ? 'PENDING' : 'ACTIVE';
    const memberStatus = isPendingAdmin ? 'PENDING' : 'ACTIVE';

    if (!existingSolo) {
      await tx.eventMember.create({
        data: {
          eventId, userId, role: 'PARTICIPANT', status: memberStatus,
          assignedByUserId: userId, approvedAt: isPendingAdmin ? null : new Date()
        }
      });
      // Increment registrations only if active
      if (!isPendingAdmin) {
        await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
      }
    } else if (existingSolo.status !== 'ACTIVE' && !isPendingAdmin) {
      await tx.eventMember.update({
        where: { id: existingSolo.id },
        data: { status: 'ACTIVE', approvedAt: new Date() }
      });
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    }

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
      include: { members: true }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_CREATED',
      userId,
      eventId,
      meta: { teamId: team.id, teamName: team.name, status: team.status },
    });

    return team;
  });
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
  const precheck = await assertRegistrationRequirements(eventId, userId, answers, { allowExistingParticipant: true });

  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.status !== 'ACTIVE') throw new Error('TEAM_NOT_ACTIVE');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  if (event.teamJoinMode === 'BY_CODE' && team.joinCode !== code) throw new Error('INVALID_JOIN_CODE');

  const existingTeamMember = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: [...ACTIVE_TEAM_MEMBER_STATUSES] } }
  });
  if (existingTeamMember) throw new Error('ALREADY_IN_TEAM');

  return prisma.$transaction(async (tx: any) => {
    const isPending = event.teamJoinMode === 'BY_REQUEST';

    if (event.requiredEventFields.length > 0) {
      await tx.eventRegistrationFormSubmission.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          answersJson: precheck.answers as Prisma.InputJsonValue,
          isComplete: true,
        },
        update: {
          answersJson: precheck.answers as Prisma.InputJsonValue,
        },
      });
    }

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

    if (!isPending) {
       // Also ensure they are registered as PARTICIPANT
       const existingSolo = await tx.eventMember.findUnique({
         where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } }
       });
       if (!existingSolo) {
         await tx.eventMember.create({
           data: { eventId, userId, role: 'PARTICIPANT', status: 'ACTIVE', assignedByUserId: userId, approvedAt: new Date() }
         });
         await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
       } else if (existingSolo.status !== 'ACTIVE') {
         await tx.eventMember.update({
           where: { id: existingSolo.id },
           data: { status: 'ACTIVE', approvedAt: new Date() }
         });
         await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
       }
    }

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_JOIN_REQUESTED',
      userId,
      eventId,
      meta: { teamId, status: member.status, mode: event.teamJoinMode },
    });

    return member;
  });
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
  const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== userId) throw new Error('NOT_TEAM_CAPTAIN');

  return prisma.eventTeam.update({
    where: { id: teamId },
    data: {
      name: data.name ?? undefined,
      description: data.description !== undefined ? data.description : undefined,
    }
  });
}

export async function leaveTeam(eventId: string, teamId: string, userId: string) {
  const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId === userId) throw new Error('CAPTAIN_CANNOT_LEAVE');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  });
  if (!member) throw new Error('NOT_IN_TEAM');

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'LEFT', removedAt: new Date() }
  });
}

export async function approveTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!(await canManageTeamMembers(eventId, team.captainUserId, captainId))) throw new Error('NOT_TEAM_CAPTAIN');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  return prisma.$transaction(async (tx: any) => {
    const updatedMember = await tx.eventTeamMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE', approvedAt: new Date() }
    });

    // Also ensure they are registered as PARTICIPANT for the event
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const existingSolo = await tx.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId: memberUserId, role: 'PARTICIPANT' } }
    });

    if (!existingSolo) {
      await tx.eventMember.create({
        data: { eventId, userId: memberUserId, role: 'PARTICIPANT', status: 'ACTIVE', assignedByUserId: memberUserId, approvedAt: new Date() }
      });
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    } else if (existingSolo.status !== 'ACTIVE') {
      await tx.eventMember.update({
        where: { id: existingSolo.id },
        data: { status: 'ACTIVE', approvedAt: new Date() }
      });
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    }

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_MEMBER_APPROVED',
      userId: memberUserId,
      eventId,
      meta: { teamId },
    });

    return updatedMember;
  });
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
}

export async function removeTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!(await canManageTeamMembers(eventId, team.captainUserId, captainId))) throw new Error('NOT_TEAM_CAPTAIN');
  if (team.captainUserId === memberUserId) throw new Error('CANNOT_REMOVE_CAPTAIN');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'REMOVED', removedAt: new Date() }
  });
}
