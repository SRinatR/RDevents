import { prisma } from '../../db/prisma.js';
import type { Prisma } from '@prisma/client';
import type { EventQuery } from './events.schemas.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE', 'APPROVED'] as const;
const ACTIVE_TEAM_MEMBER_STATUSES = ['ACTIVE', 'PENDING'] as const;
const PLATFORM_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;
const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'Full name',
  phone: 'Phone',
  city: 'City',
  telegram: 'Telegram',
  birthDate: 'Date of birth',
  avatarUrl: 'Avatar',
  bio: 'Bio',
};

const EVENT_FIELD_LABELS: Record<string, string> = {
  motivation: 'Motivation',
  experience: 'Experience',
  teamPreference: 'Team preference',
  tshirtSize: 'T-shirt size',
  emergencyContact: 'Emergency contact',
  preferredSlot: 'Preferred slot',
  specialRequirements: 'Special requirements',
  university: 'University',
  faculty: 'Faculty',
  course: 'Course',
};

export type RegistrationMissingField = {
  key: string;
  label: string;
  scope: 'PROFILE' | 'EVENT_FORM';
  action: 'PROFILE' | 'EVENT_FORM';
};

export class RegistrationRequirementsError extends Error {
  constructor(public missingFields: RegistrationMissingField[]) {
    super('REGISTRATION_REQUIREMENTS_MISSING');
  }
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function normalizeAnswers(answers?: Record<string, unknown> | null) {
  return answers && typeof answers === 'object' ? answers : {};
}

function buildMissingProfileFields(user: Record<string, unknown>, requiredFields: string[]) {
  return requiredFields
    .filter(field => !hasValue(user[field]))
    .map(field => ({
      key: field,
      label: PROFILE_FIELD_LABELS[field] ?? field,
      scope: 'PROFILE' as const,
      action: 'PROFILE' as const,
    }));
}

function buildMissingEventFields(answers: Record<string, unknown>, requiredFields: string[]) {
  return requiredFields
    .filter(field => !hasValue(answers[field]))
    .map(field => ({
      key: field,
      label: EVENT_FIELD_LABELS[field] ?? field,
      scope: 'EVENT_FORM' as const,
      action: 'EVENT_FORM' as const,
    }));
}

export function getEventFieldLabel(field: string) {
  return EVENT_FIELD_LABELS[field] ?? field;
}

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
  let registrationAnswers = null;

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
      where: { team: { eventId: event.id }, userId, status: { notIn: ['REMOVED', 'LEFT'] } },
      include: { team: { select: { id: true, name: true, slug: true, joinCode: true, status: true, captainUserId: true } } }
    });
    registrationAnswers = await prisma.eventRegistrationAnswer.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
      select: { answers: true },
    });
  }

  return {
    ...event,
    isRegistered,
    membershipRoles,
    memberships,
    teamMembership,
    registrationAnswers: registrationAnswers?.answers ?? {},
    registrationFieldLabels: Object.fromEntries(event.requiredEventFields.map(field => [field, getEventFieldLabel(field)])),
  };
}

export async function getRegistrationPrecheck(
  eventId: string,
  userId: string,
  answersInput?: Record<string, unknown>,
  options: { allowExistingParticipant?: boolean } = {}
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (event.registrationOpensAt && event.registrationOpensAt > new Date()) {
    throw new Error('REGISTRATION_NOT_OPEN');
  }
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  const [participantCount, existing, user, storedAnswers] = await Promise.all([
    prisma.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    }),
    prisma.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        city: true,
        telegram: true,
        birthDate: true,
        avatarUrl: true,
        bio: true,
      },
    }),
    prisma.eventRegistrationAnswer.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { answers: true },
    }),
  ]);

  if (!user) throw new Error('USER_NOT_FOUND');
  if (existing && ACTIVE_MEMBER_STATUSES.includes(existing.status as any) && !options.allowExistingParticipant) {
    throw new Error('ALREADY_REGISTERED');
  }
  if (participantCount >= event.capacity && !existing) throw new Error('EVENT_FULL');

  const answers = {
    ...normalizeAnswers(storedAnswers?.answers as Record<string, unknown> | undefined),
    ...normalizeAnswers(answersInput),
  };
  const missingFields = [
    ...buildMissingProfileFields(user, event.requiredProfileFields),
    ...buildMissingEventFields(answers, event.requiredEventFields),
  ];

  return {
    ok: missingFields.length === 0,
    eventId,
    requiredProfileFields: event.requiredProfileFields,
    requiredEventFields: event.requiredEventFields,
    missingFields,
    answers,
    registrationFieldLabels: Object.fromEntries(event.requiredEventFields.map(field => [field, getEventFieldLabel(field)])),
  };
}

async function assertRegistrationRequirements(
  eventId: string,
  userId: string,
  answers?: Record<string, unknown>,
  options?: { allowExistingParticipant?: boolean }
) {
  const precheck = await getRegistrationPrecheck(eventId, userId, answers, options);
  if (!precheck.ok) throw new RegistrationRequirementsError(precheck.missingFields);
  return precheck;
}

export async function registerForEvent(eventId: string, userId: string, answers?: Record<string, unknown>) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.isTeamBased && !event.allowSoloParticipation) {
    throw new Error('EVENT_REQUIRES_TEAM');
  }
  const precheck = await assertRegistrationRequirements(eventId, userId, answers);

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

    if (event.requiredEventFields.length > 0) {
      await tx.eventRegistrationAnswer.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          answers: precheck.answers as Prisma.InputJsonValue,
        },
        update: {
          answers: precheck.answers as Prisma.InputJsonValue,
        },
      });
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
            rejectedAt: null,
            removedAt: null,
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

    await trackAnalyticsEvent(tx, {
      type: 'EVENT_REGISTRATION',
      userId,
      eventId,
      authProvider: 'EMAIL',
      meta: { source: 'event_register' },
    });

    return membership;
  });
}

export async function unregisterFromEvent(eventId: string, userId: string) {
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
  });
  if (!membership || membership.status === 'REMOVED') throw new Error('REGISTRATION_NOT_FOUND');

  const shouldDecrement = ACTIVE_MEMBER_STATUSES.includes(membership.status as any);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.eventMember.update({
      where: { id: membership.id },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
      },
    });

    if (shouldDecrement) {
      await tx.event.update({
        where: { id: eventId },
        data: { registrationsCount: { decrement: 1 } },
      });
    }

    return updated;
  });
}

export async function getEventMembership(eventId: string, userId: string) {
  const [memberships, teamMembership] = await Promise.all([
    prisma.eventMember.findMany({
      where: {
        eventId,
        userId,
        status: { not: 'REMOVED' },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.eventTeamMember.findFirst({
      where: {
        userId,
        team: { eventId },
        status: { notIn: ['REMOVED', 'LEFT'] },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            joinCode: true,
            status: true,
            captainUserId: true,
          },
        },
      },
    }),
  ]);

  return {
    memberships,
    teamMembership,
    isRegistered: memberships.some(
      membership => membership.role === 'PARTICIPANT' && ACTIVE_MEMBER_STATUSES.includes(membership.status as any)
    ),
  };
}

export async function saveRegistrationAnswers(eventId: string, userId: string, answers: Record<string, unknown>) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  return prisma.eventRegistrationAnswer.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId,
      userId,
      answers: normalizeAnswers(answers) as Prisma.InputJsonValue,
    },
    update: {
      answers: normalizeAnswers(answers) as Prisma.InputJsonValue,
    },
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
    return prisma.$transaction(async (tx) => {
      const membership = await tx.eventMember.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          notes: notes ?? null,
          assignedByUserId: userId,
          assignedAt: new Date(),
          approvedAt: null,
          rejectedAt: null,
          removedAt: null,
        },
      });

      await trackAnalyticsEvent(tx, {
        type: 'VOLUNTEER_APPLICATION_SUBMITTED',
        userId,
        eventId,
        meta: { source: 'event_detail', reapply: true },
      });

      return membership;
    });
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.eventMember.create({
      data: {
        eventId,
        userId,
        role: 'VOLUNTEER',
        status: 'PENDING',
        notes: notes ?? null,
        assignedByUserId: userId,
      },
    });

    await trackAnalyticsEvent(tx, {
      type: 'VOLUNTEER_APPLICATION_SUBMITTED',
      userId,
      eventId,
      meta: { source: 'event_detail' },
    });

    return membership;
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

export async function getMyTeams(userId: string) {
  return prisma.eventTeamMember.findMany({
    where: { userId, status: { notIn: ['REMOVED', 'LEFT'] } },
    include: {
      team: {
        include: {
          event: {
            select: {
              id: true,
              slug: true,
              title: true,
              category: true,
              location: true,
              startsAt: true,
              endsAt: true,
              coverImageUrl: true,
            },
          },
          captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { members: { where: { status: 'ACTIVE' } } } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
}

export async function getMyVolunteerApplications(userId: string) {
  return prisma.eventMember.findMany({
    where: { userId, role: 'VOLUNTEER', status: { not: 'REMOVED' } },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          location: true,
          startsAt: true,
          coverImageUrl: true,
        },
      },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
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

  return prisma.$transaction(async (tx) => {
    const participantCount = await tx.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    });

    // Also create or update EVENT PARTICIPANT membership for Captain
    const existingSolo = await tx.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } }
    });
    if (participantCount >= event.capacity && !existingSolo) throw new Error('EVENT_FULL');

    if (event.requiredEventFields.length > 0) {
      await tx.eventRegistrationAnswer.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          answers: precheck.answers as Prisma.InputJsonValue,
        },
        update: {
          answers: precheck.answers as Prisma.InputJsonValue,
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

  return prisma.$transaction(async (tx) => {
    const isPending = event.teamJoinMode === 'BY_REQUEST';

    if (event.requiredEventFields.length > 0) {
      await tx.eventRegistrationAnswer.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          answers: precheck.answers as Prisma.InputJsonValue,
        },
        update: {
          answers: precheck.answers as Prisma.InputJsonValue,
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

  return prisma.$transaction(async (tx) => {
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
