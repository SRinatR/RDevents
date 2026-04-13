import { prisma } from '../../db/prisma.js';
import type { EventQuery } from './events.schemas.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE', 'APPROVED'] as const;

export async function listEvents(query: EventQuery, userId?: string) {
  const where: Record<string, unknown> = {};

  if (query.status) {
    where['status'] = query.status;
  } else {
    where['status'] = 'PUBLISHED';
  }

  if (query.search) {
    where['OR'] = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { shortDescription: { contains: query.search, mode: 'insensitive' } },
      { location: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.category) {
    where['category'] = { equals: query.category, mode: 'insensitive' };
  }

  const total = await prisma.event.count({ where: where as any });
  const events = await prisma.event.findMany({
    where: where as any,
    orderBy: { [query.sort]: query.order },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      coverImageUrl: true,
      category: true,
      location: true,
      capacity: true,
      registrationsCount: true,
      startsAt: true,
      endsAt: true,
      status: true,
      isFeatured: true,
    },
  });

  let registeredEventIds = new Set<string>();
  if (userId) {
    const memberships = await prisma.eventMember.findMany({
      where: {
        userId,
        role: 'PARTICIPANT',
        status: { in: [...ACTIVE_MEMBER_STATUSES] },
        eventId: { in: events.map(event => event.id) },
      },
      select: { eventId: true },
    });
    registeredEventIds = new Set(memberships.map(membership => membership.eventId));
  }

  return {
    data: events.map(event => ({
      ...event,
      isRegistered: registeredEventIds.has(event.id),
    })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
  };
}

export async function getEventBySlug(slug: string, userId?: string) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (!event) return null;

  let isRegistered = false;
  let membershipRoles: string[] = [];
  let memberships: Array<{ role: string; status: string }> = [];
  let teamMembership = null;

  if (userId) {
    memberships = await prisma.eventMember.findMany({
      where: {
        userId,
        eventId: event.id,
        status: { not: 'REMOVED' },
      },
      select: { role: true, status: true },
    });
    isRegistered = memberships.some(
      membership => membership.role === 'PARTICIPANT' && ACTIVE_MEMBER_STATUSES.includes(membership.status as any)
    );
    membershipRoles = memberships.map(membership => membership.role);

    teamMembership = await prisma.eventTeamMember.findFirst({
      where: { team: { eventId: event.id }, userId, status: { not: 'REMOVED' } },
      include: { team: { select: { id: true, name: true, slug: true, status: true } } }
    });
  }

  return { ...event, isRegistered, membershipRoles, memberships, teamMembership };
}

export async function registerForEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (event.isTeamBased && !event.allowSoloParticipation) {
    throw new Error('EVENT_REQUIRES_TEAM');
  }

  return prisma.$transaction(async (tx) => {
    const participantCount = await tx.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    });
    if (participantCount >= event.capacity) throw new Error('EVENT_FULL');

    const existing = await tx.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
    });
    if (existing && ACTIVE_MEMBER_STATUSES.includes(existing.status as any)) {
      throw new Error('ALREADY_REGISTERED');
    }

    // Ensure not in any active team if we are doing solo
    if (event.isTeamBased) {
      const activeTeamMember = await tx.eventTeamMember.findFirst({
        where: { team: { eventId }, userId, status: { in: ['ACTIVE', 'PENDING'] } }
      });
      if (activeTeamMember) {
        throw new Error('ALREADY_IN_TEAM');
      }
    }

    const membership = existing
      ? await tx.eventMember.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            assignedByUserId: userId,
            assignedAt: new Date(),
            approvedAt: new Date(),
          },
        })
      : await tx.eventMember.create({
          data: {
            eventId,
            userId,
            role: 'PARTICIPANT',
            status: 'ACTIVE',
            assignedByUserId: userId,
            approvedAt: new Date(),
          },
        });

    await tx.event.update({
      where: { id: eventId },
      data: { registrationsCount: { increment: 1 } },
    });

    return membership;
  });
}

export async function applyForVolunteer(eventId: string, userId: string, notes?: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'VOLUNTEER' } },
  });

  if (existing && ['PENDING', 'APPROVED', 'ACTIVE'].includes(existing.status)) {
    throw new Error('VOLUNTEER_APPLICATION_EXISTS');
  }

  if (existing) {
    return prisma.eventMember.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        notes: notes ?? null,
        assignedByUserId: userId,
        assignedAt: new Date(),
        approvedAt: null,
      },
    });
  }

  return prisma.eventMember.create({
    data: {
      eventId,
      userId,
      role: 'VOLUNTEER',
      status: 'PENDING',
      notes: notes ?? null,
      assignedByUserId: userId,
    },
  });
}

export async function getMyEvents(userId: string) {
  const memberships = await prisma.eventMember.findMany({
    where: {
      userId,
      status: { not: 'REMOVED' },
    },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          coverImageUrl: true,
          category: true,
          location: true,
          capacity: true,
          registrationsCount: true,
          startsAt: true,
          endsAt: true,
          status: true,
          isFeatured: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  return memberships.map(membership => ({
    memberId: membership.id,
    registrationId: membership.id,
    role: membership.role,
    status: membership.status,
    registrationStatus: membership.status,
    joinedAt: membership.assignedAt,
    registeredAt: membership.assignedAt,
    event: membership.event,
  }));
}

export async function createTeam(eventId: string, userId: string, data: { name: string; description?: string }) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (!event.isTeamBased) throw new Error('EVENT_NOT_TEAM_BASED');

  // Check if user is already in a team for this event
  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: ['ACTIVE', 'PENDING'] } }
  });
  if (existingMembership) throw new Error('ALREADY_IN_TEAM');

  // Generate slug and strict join code
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 6);
  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  return prisma.$transaction(async (tx) => {
    // Also create or update EVENT PARTICIPANT membership for Captain
    const existingSolo = await tx.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } }
    });

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

    return team;
  });
}

export async function joinTeam(eventId: string, teamId: string, userId: string, code?: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.status !== 'ACTIVE') throw new Error('TEAM_NOT_ACTIVE');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  if (event.teamJoinMode === 'BY_CODE' && team.joinCode !== code) throw new Error('INVALID_JOIN_CODE');

  const existingTeamMember = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: ['ACTIVE', 'PENDING'] } }
  });
  if (existingTeamMember) throw new Error('ALREADY_IN_TEAM');

  return prisma.$transaction(async (tx) => {
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

    return member;
  });
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
