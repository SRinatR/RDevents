import { prisma } from '../../db/prisma.js';
import { getVisibleProfileFieldsForUser } from '../profile-config/profile-config.service.js';

const PROFILE_FIELD_REGISTRY: Array<{
  key: string;
  sectionKey: string;
  type: string;
  defaultVisibleInCabinet: boolean;
  allowEventRequirement: boolean;
  storageScope: string;
}> = [
  { key: 'lastNameCyrillic', sectionKey: 'registration_data', type: 'text', defaultVisibleInCabinet: true, allowEventRequirement: true, storageScope: 'user' },
  { key: 'firstNameCyrillic', sectionKey: 'registration_data', type: 'text', defaultVisibleInCabinet: true, allowEventRequirement: true, storageScope: 'user' },
  { key: 'birthDate', sectionKey: 'registration_data', type: 'date', defaultVisibleInCabinet: true, allowEventRequirement: true, storageScope: 'user' },
  { key: 'phone', sectionKey: 'registration_data', type: 'phone', defaultVisibleInCabinet: true, allowEventRequirement: true, storageScope: 'user' },
  { key: 'telegram', sectionKey: 'registration_data', type: 'text', defaultVisibleInCabinet: true, allowEventRequirement: true, storageScope: 'user' },
];

function getFieldByKey(key: string) {
  return PROFILE_FIELD_REGISTRY.find((f) => f.key === key);
}

const ACTIVE_MEMBER_STATUSES = ['ACTIVE', 'APPROVED'] as const;

export interface DashboardEvent {
  eventId: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  status: string;
  myRoles: Array<{ role: string; status: string }>;
  team: {
    id: string;
    name: string;
    status: string;
    isCaptain: boolean;
    membersCount: number;
    canEdit: boolean;
  } | null;
  missingProfileFields: string[];
  missingEventFields: string[];
  missingEventFieldsCalculated?: boolean;
  deadlines: Array<{ type: string; at: string }>;
  quickActions: string[];
  invitations?: Array<{
    id: string;
    teamName: string;
    teamId: string;
    invitedBy: string;
    expiresAt: string;
  }>;
}

export interface DashboardData {
  activeEventId: string | null;
  events: DashboardEvent[];
}

function getUserProfileFields(userId: string): Set<string> {
  const fields = new Set<string>();
  fields.add('lastNameCyrillic');
  fields.add('firstNameCyrillic');
  fields.add('birthDate');
  fields.add('phone');
  fields.add('consentPersonalData');
  return fields;
}

function getMissingProfileFields(
  userId: string,
  requiredFields: string[],
  user: any
): string[] {
  const missing: string[] = [];

  for (const field of requiredFields) {
    const fieldDef = getFieldByKey(field);
    if (!fieldDef) continue;

    let hasValue = false;
    switch (fieldDef.storageScope) {
      case 'user':
        hasValue = user[field] !== null && user[field] !== undefined && user[field] !== '';
        break;
      case 'extended_profile':
        hasValue = user.extendedProfile?.[field] !== null && user.extendedProfile?.[field] !== undefined;
        break;
      default:
        hasValue = false;
    }

    if (!hasValue) {
      missing.push(field);
    }
  }

  return missing;
}

function getMissingEventFields(
  userId: string,
  eventId: string,
  requiredFields: string[]
): { fields: string[]; calculated: boolean } {
  return {
    fields: requiredFields,
    calculated: false,
  };
}

async function getMissingEventFieldsReal(
  userId: string,
  eventId: string,
  requiredFields: string[]
): Promise<{ fields: string[]; calculated: boolean }> {
  if (!requiredFields || requiredFields.length === 0) {
    return { fields: [], calculated: true };
  }

  const submission = await prisma.eventRegistrationFormSubmission.findUnique({
    where: {
      eventId_userId: { eventId, userId },
    },
    select: {
      answersJson: true,
    },
  });

  const answeredKeys = new Set<string>();
  
  if (submission?.answersJson) {
    const answers = submission.answersJson as Record<string, unknown>;
    for (const key of Object.keys(answers)) {
      const value = answers[key];
      if (value !== null && value !== undefined && value !== '') {
        answeredKeys.add(key);
      }
    }
  }

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (!answeredKeys.has(field)) {
      missing.push(field);
    }
  }

  return { fields: missing, calculated: true };
}

function calculateQuickActions(
  event: DashboardEvent,
  hasPendingInvitations: boolean
): string[] {
  const actions: string[] = [];

  if (event.missingProfileFields.length > 0) {
    actions.push('OPEN_PROFILE_REQUIREMENTS');
  }

  if (event.missingEventFields.length > 0) {
    actions.push('COMPLETE_EVENT_FORM');
  }

  if (!event.team) {
    if (hasPendingInvitations) {
      actions.push('ACCEPT_TEAM_INVITATION');
    }
    actions.push('CREATE_OR_JOIN_TEAM');
  } else if (event.team.canEdit) {
    actions.push('OPEN_TEAM');
    actions.push('EDIT_TEAM');
  } else {
    actions.push('OPEN_TEAM');
  }

  actions.push('OPEN_CALENDAR');
  actions.push('OPEN_SUPPORT');

  return actions;
}

export async function getUserDashboard(userId: string): Promise<DashboardData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      lastNameCyrillic: true,
      firstNameCyrillic: true,
      middleNameCyrillic: true,
      birthDate: true,
      phone: true,
      telegram: true,
      consentPersonalData: true,
      extendedProfile: {
        select: {
          gender: true,
          citizenshipCountryCode: true,
          residenceCountryCode: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const [preferences, memberships, pendingInvitations] = await Promise.all([
    prisma.userPreference.findMany({
      where: { userId, key: 'activeEventId' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    }),
    prisma.eventMember.findMany({
      where: {
        userId,
        status: { in: [...ACTIVE_MEMBER_STATUSES] },
      },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            endsAt: true,
            location: true,
            status: true,
            registrationDeadline: true,
            requiredProfileFields: true,
            requiredEventFields: true,
          },
        },
      },
    }),
    prisma.eventTeamInvitation.count({
      where: {
        inviteeUserId: userId,
        status: 'PENDING_RESPONSE',
      },
    }),
  ]);

  const activeEventId = preferences[0]?.value ?? null;
  const hasPendingInvitations = pendingInvitations > 0;

  const events: DashboardEvent[] = await Promise.all(
    memberships.map(async (membership) => {
      const event = membership.event;

      const invitations = await prisma.eventTeamInvitation.findMany({
        where: {
          inviteeUserId: userId,
          status: 'PENDING_RESPONSE',
          team: { eventId: event.id },
        },
        select: {
          id: true,
          teamId: true,
          invitedByUserId: true,
          team: {
            select: {
              name: true,
            },
          },
          invitedByUser: {
            select: {
              name: true,
            },
          },
          expiresAt: true,
        },
        take: 5,
      });

      const invitationsData = invitations.map((inv) => {
        const invitedByUser = inv.invitedByUser as { name?: string | null } | null;
        return {
          id: inv.id,
          teamName: inv.team.name,
          teamId: inv.teamId,
          invitedBy: invitedByUser?.name || 'Неизвестно',
          expiresAt: inv.expiresAt.toISOString(),
        };
      });

      const isTeamEvent = event.requiredProfileFields.includes('teamRegistration');

      let team = null;
      if (isTeamEvent) {
        const teamMembership = await prisma.eventTeamMember.findFirst({
          where: {
            team: { eventId: event.id },
            userId,
            status: { notIn: ['REMOVED', 'LEFT'] },
          },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                status: true,
                captainUserId: true,
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
              },
            },
          },
        });

        if (teamMembership) {
          const isCaptain = teamMembership.team.captainUserId === userId;
          const canEdit = ['DRAFT', 'ACTIVE'].includes(teamMembership.team.status);

          team = {
            id: teamMembership.team.id,
            name: teamMembership.team.name,
            status: teamMembership.team.status,
            isCaptain,
            membersCount: teamMembership.team._count.members,
            canEdit,
          };
        }
      }

      const missingProfileFields = getMissingProfileFields(
        userId,
        event.requiredProfileFields,
        user
      );
      const missingEventFieldsResult = await getMissingEventFieldsReal(
        userId,
        event.id,
        event.requiredEventFields
      );

      const deadlines: Array<{ type: string; at: string }> = [];
      if (event.registrationDeadline) {
        deadlines.push({
          type: 'REGISTRATION_DEADLINE',
          at: event.registrationDeadline.toISOString(),
        });
      }
      deadlines.push({
        type: 'EVENT_START',
        at: event.startsAt.toISOString(),
      });
      deadlines.push({
        type: 'EVENT_END',
        at: event.endsAt.toISOString(),
      });

      const quickActions = calculateQuickActions(
        {
          eventId: event.id,
          slug: event.slug,
          title: event.title,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          location: event.location,
          status: event.status,
          myRoles: [{ role: membership.role, status: membership.status }],
          team,
          missingProfileFields,
          missingEventFields: missingEventFieldsResult.fields,
          deadlines,
          quickActions: [],
        },
        hasPendingInvitations
      );

      return {
        eventId: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        location: event.location,
        status: event.status,
        myRoles: [{ role: membership.role, status: membership.status }],
        team,
        missingProfileFields,
        missingEventFields: missingEventFieldsResult.fields,
        missingEventFieldsCalculated: missingEventFieldsResult.calculated,
        deadlines,
        quickActions,
        invitations: invitationsData,
      };
    })
  );

  let resolvedActiveEventId = activeEventId;

  if (!resolvedActiveEventId && events.length > 0) {
    const now = new Date();
    const activeEvents = events.filter(
      (e) => new Date(e.startsAt) > now || new Date(e.endsAt) > now
    );

    if (activeEvents.length > 0) {
      resolvedActiveEventId = activeEvents[0].eventId;
    } else {
      resolvedActiveEventId = events[0]?.eventId ?? null;
    }
  }

  return {
    activeEventId: resolvedActiveEventId,
    events,
  };
}

export async function setActiveEvent(
  userId: string,
  eventId: string | null
): Promise<{ success: boolean }> {
  if (eventId) {
    const membership = await prisma.eventMember.findFirst({
      where: {
        userId,
        eventId,
        status: { in: [...ACTIVE_MEMBER_STATUSES] },
      },
    });

    if (!membership) {
      throw new Error('EVENT_NOT_FOUND_OR_NOT_MEMBER');
    }

    await prisma.userPreference.upsert({
      where: {
        userId_key: { userId, key: 'activeEventId' },
      },
      update: {
        value: eventId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        key: 'activeEventId',
        value: eventId,
      },
    });
  } else {
    await prisma.userPreference.deleteMany({
      where: {
        userId,
        key: 'activeEventId',
      },
    });
  }

  return { success: true };
}

export async function getEventWorkspace(
  userId: string,
  eventId: string
): Promise<any | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) return null;

  const membership = await prisma.eventMember.findFirst({
    where: {
      userId,
      eventId,
      status: { in: [...ACTIVE_MEMBER_STATUSES] },
    },
  });

  if (!membership) {
    throw new Error('EVENT_WORKSPACE_FORBIDDEN');
  }

  const [memberships, teamMembership, registrationAnswers, pendingInvitations] = await Promise.all([
    prisma.eventMember.findMany({
      where: {
        userId,
        eventId,
        status: { not: 'REMOVED' },
      },
      select: {
        id: true,
        role: true,
        status: true,
        assignedAt: true,
        approvedAt: true,
        notes: true,
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.eventTeamMember.findFirst({
      where: {
        team: { eventId },
        userId,
        status: { notIn: ['REMOVED', 'LEFT'] },
      },
      include: {
        team: {
          include: {
            captainUser: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            members: {
              where: { status: { notIn: ['REMOVED', 'LEFT'] } },
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
              },
              orderBy: { joinedAt: 'asc' },
            },
            changeRequests: {
              where: { status: 'PENDING' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            invitations: {
              where: { status: { in: ['PENDING_ACCOUNT', 'PENDING_RESPONSE'] } },
              select: { id: true, inviteeEmail: true, status: true },
            },
            _count: {
              select: { members: { where: { status: 'ACTIVE' } } },
            },
          },
        },
      },
    }),
    prisma.eventRegistrationFormSubmission.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { answersJson: true, isComplete: true, updatedAt: true },
    }),
    prisma.eventTeamInvitation.findMany({
      where: {
        inviteeUserId: userId,
        eventId,
        status: 'PENDING_RESPONSE',
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            captainUser: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      lastNameCyrillic: true,
      firstNameCyrillic: true,
      middleNameCyrillic: true,
      birthDate: true,
      phone: true,
      telegram: true,
      consentPersonalData: true,
      extendedProfile: {
        select: {
          gender: true,
          citizenshipCountryCode: true,
          residenceCountryCode: true,
        },
      },
    },
  });

  const missingProfileFields = user
    ? getMissingProfileFields(userId, event.requiredProfileFields, user)
    : [];

  const missingEventFieldsResult = await getMissingEventFieldsReal(
    userId,
    eventId,
    event.requiredEventFields
  );

  const deadlines: Array<{ type: string; at: string; label: string }> = [];
  if (event.registrationDeadline) {
    deadlines.push({
      type: 'REGISTRATION_DEADLINE',
      at: event.registrationDeadline.toISOString(),
      label: 'Дедлайн регистрации',
    });
  }
  deadlines.push({
    type: 'EVENT_START',
    at: event.startsAt.toISOString(),
    label: 'Начало мероприятия',
  });
  deadlines.push({
    type: 'EVENT_END',
    at: event.endsAt.toISOString(),
    label: 'Окончание мероприятия',
  });

  const milestones = await prisma.eventMilestone.findMany({
    where: { eventId },
    orderBy: { occursAt: 'asc' },
  });

  const canEditTeam =
    teamMembership?.team &&
    ['DRAFT', 'ACTIVE'].includes(teamMembership.team.status);

  return {
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      location: event.location,
      status: event.status,
      coverImageUrl: event.coverImageUrl,
      shortDescription: event.shortDescription,
    },
    myRoles: memberships.map((m) => ({
      role: m.role,
      status: m.status,
      assignedAt: m.assignedAt.toISOString(),
      approvedAt: m.approvedAt?.toISOString() ?? null,
      notes: m.notes ?? null,
    })),
    team: teamMembership?.team
      ? {
          id: teamMembership.team.id,
          name: teamMembership.team.name,
          description: teamMembership.team.description,
          status: teamMembership.team.status,
          isCaptain: teamMembership.team.captainUserId === userId,
          membersCount: teamMembership.team._count.members,
          canEdit: canEditTeam,
          captain: teamMembership.team.captainUser,
          members: teamMembership.team.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
            role: m.role,
            status: m.status,
            joinedAt: m.joinedAt.toISOString(),
          })),
          pendingInvitations: teamMembership.team.invitations,
          changeRequest:
            teamMembership.team.changeRequests[0] ?? null,
        }
      : null,
    pendingTeamInvitations: pendingInvitations.map((inv) => ({
      id: inv.id,
      teamId: inv.team.id,
      teamName: inv.team.name,
      captainName: inv.team.captainUser.name,
      message: inv.message ?? null,
      createdAt: inv.createdAt.toISOString(),
    })),
    missingProfileFields,
    missingEventFields: missingEventFieldsResult.fields,
    missingEventFieldsCalculated: missingEventFieldsResult.calculated,
    deadlines,
    milestones: milestones.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      description: m.description,
      occursAt: m.occursAt.toISOString(),
    })),
    registrationAnswers: registrationAnswers?.answersJson ?? {},
    registrationAnswersComplete: registrationAnswers?.isComplete ?? false,
    registrationAnswersUpdatedAt:
      registrationAnswers?.updatedAt?.toISOString() ?? null,
  };
}
