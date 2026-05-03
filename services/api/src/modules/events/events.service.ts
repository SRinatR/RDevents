// Core event query functions
import { prisma } from '../../db/prisma.js';
import type { EventQuery } from './events.schemas.js';
import { notifyParticipantApplicationSubmitted } from './notifications.service.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

export function getEventFieldLabel(field: string) {
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
  return EVENT_FIELD_LABELS[field] ?? field;
}

export async function listEvents(query: EventQuery, userId?: string) {
  const where: Record<string, unknown> = {};

  if (query.status) {
    where['status'] = query.status;
  } else {
    where['status'] = 'PUBLISHED';
  }
  where['deletedAt'] = null;

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
      registrationDeadline: true,
      registrationEnabled: true,
      registrationMode: true,
      volunteerApplicationsEnabled: true,
      status: true,
      isFeatured: true,
      isTeamBased: true,
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
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null },
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
    registrationAnswers = await prisma.eventRegistrationFormSubmission.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
      select: { answersJson: true },
    });
  }

  return {
    ...event,
    isRegistered,
    membershipRoles,
    memberships,
    teamMembership,
    registrationAnswers: registrationAnswers?.answersJson ?? {},
    registrationFieldLabels: Object.fromEntries(event.requiredEventFields.map(field => [field, getEventFieldLabel(field)])),
  };
}

// Re-export from registration.service.ts
export {
  RegistrationRequirementsError,
  getRegistrationPrecheck,
  registerForEvent,
  unregisterFromEvent,
  getEventMembership,
  saveRegistrationAnswers,
  assertRegistrationRequirements,
  type RegistrationMissingField,
  type RegistrationResult,
} from './registration.service.js';

// Re-export from teams.service.ts
export {
  getTeamsByEvent,
  getTeamById,
  createTeam,
  joinTeam,
  joinTeamByCode,
  updateTeam,
  leaveTeam,
  approveTeamMember,
  approveTeamChangeRequest,
  rejectTeamMember,
  rejectTeamChangeRequest,
  removeTeamMember,
  transferTeamCaptain,
  submitTeamForApproval,
} from './teams.service.js';

export {
  acceptTeamInvitation,
  bindPendingInvitationsToUser,
  cancelTeamInvitation,
  declineTeamInvitation,
  getTeamSlots,
  inviteToTeamByEmail,
  listMyTeamInvitations,
} from './team-invitations.service.js';

// Volunteer application function (kept here for backward compatibility)
export async function applyForVolunteer(eventId: string, userId: string, notes?: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (!event.volunteerApplicationsEnabled) throw new Error('EVENT_NOT_AVAILABLE');

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'VOLUNTEER' } },
  });

  if (existing && ['PENDING', 'ACTIVE'].includes(existing.status)) {
    throw new Error('VOLUNTEER_APPLICATION_EXISTS');
  }

  if (existing) {
    const membership = await prisma.$transaction(async (tx: any) => {
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

      await tx.analyticsEvent.create({
        data: {
          type: 'VOLUNTEER_APPLICATION_SUBMITTED',
          userId,
          eventId,
          meta: { source: 'event_detail', reapply: true },
        },
      });

      return membership;
    });
    await notifyParticipantApplicationSubmitted(eventId, userId, 'PENDING');
    return membership;
  }

  const membership = await prisma.$transaction(async (tx: any) => {
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

    await tx.analyticsEvent.create({
      data: {
        type: 'VOLUNTEER_APPLICATION_SUBMITTED',
        userId,
        eventId,
        meta: { source: 'event_detail' },
      },
    });

    return membership;
  });
  await notifyParticipantApplicationSubmitted(eventId, userId, 'PENDING');
  return membership;
}

export async function getMyEvents(userId: string) {
  const memberships = await prisma.eventMember.findMany({
    where: {
      userId,
      role: 'PARTICIPANT',
      status: { in: [...ACTIVE_MEMBER_STATUSES] },
      event: {
        deletedAt: null,
      },
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
          volunteerApplicationsEnabled: true,
          isTeamBased: true,
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

export async function getMyParticipantApplications(userId: string) {
  const memberships = await prisma.eventMember.findMany({
    where: {
      userId,
      role: 'PARTICIPANT',
      status: { not: 'REMOVED' },
      event: {
        deletedAt: null,
      },
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
          startsAt: true,
          endsAt: true,
          status: true,
          requireParticipantApproval: true,
          isTeamBased: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  const submissions = await prisma.eventRegistrationFormSubmission.findMany({
    where: {
      userId,
      eventId: { in: memberships.map(membership => membership.eventId) },
    },
    select: { eventId: true, answersJson: true, isComplete: true, updatedAt: true },
  });
  const submissionsByEventId = new Map(submissions.map(submission => [submission.eventId, submission]));

  return memberships.map(membership => {
    const submission = submissionsByEventId.get(membership.eventId);
    return {
      id: membership.id,
      memberId: membership.id,
      eventId: membership.eventId,
      role: membership.role,
      status: membership.status,
      assignedAt: membership.assignedAt,
      approvedAt: membership.approvedAt,
      rejectedAt: membership.rejectedAt,
      removedAt: membership.removedAt,
      notes: membership.notes,
      event: membership.event,
      answers: submission?.answersJson ?? {},
      answersComplete: submission?.isComplete ?? false,
      answersUpdatedAt: submission?.updatedAt ?? null,
    };
  });
}

export async function getMyEventWorkspace(userId: string, slug: string) {
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (!event) return null;

  const participantMembership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId: event.id, userId, role: 'PARTICIPANT' } },
  });

  if (!participantMembership || !ACTIVE_MEMBER_STATUSES.includes(participantMembership.status as any)) {
    throw new Error('EVENT_WORKSPACE_FORBIDDEN');
  }

  const [memberships, teamMembership, registrationAnswers] = await Promise.all([
    prisma.eventMember.findMany({
      where: {
        userId,
        eventId: event.id,
        status: { not: 'REMOVED' },
      },
      select: {
        id: true,
        role: true,
        status: true,
        assignedAt: true,
        approvedAt: true,
        rejectedAt: true,
        removedAt: true,
        notes: true,
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.eventTeamMember.findFirst({
      where: { team: { eventId: event.id }, userId, status: { notIn: ['REMOVED', 'LEFT'] } },
      include: {
        team: {
          include: {
            captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
            members: {
              where: { status: { notIn: ['REMOVED', 'LEFT'] } },
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
              orderBy: { joinedAt: 'asc' },
            },
            changeRequests: {
              where: { status: 'PENDING' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            _count: { select: { members: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    }),
    prisma.eventRegistrationFormSubmission.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
      select: { answersJson: true, isComplete: true, updatedAt: true },
    }),
  ]);

  return {
    ...event,
    isRegistered: true,
    participantMembership,
    membershipRoles: memberships.map(membership => membership.role),
    memberships,
    teamMembership,
    registrationAnswers: registrationAnswers?.answersJson ?? {},
    registrationAnswersComplete: registrationAnswers?.isComplete ?? false,
    registrationAnswersUpdatedAt: registrationAnswers?.updatedAt ?? null,
    registrationFieldLabels: Object.fromEntries(event.requiredEventFields.map(field => [field, getEventFieldLabel(field)])),
  };
}

export async function getMyTeams(userId: string) {
  return prisma.eventTeamMember.findMany({
    where: {
      userId,
      status: { notIn: ['REMOVED', 'LEFT'] },
      team: {
        deletedAt: null,
        event: {
          deletedAt: null,
        },
      },
    },
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
    where: {
      userId,
      role: 'VOLUNTEER',
      status: { not: 'REMOVED' },
      event: {
        deletedAt: null,
      },
    },
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
          shortDescription: true,
          volunteerApplicationsEnabled: true,
        },
      },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
}
