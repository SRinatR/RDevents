import { Router } from 'express';
import type { User } from '@prisma/client';
import { requirePlatformAdmin, requireSuperAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

export const adminUsersRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  city: true,
  registeredAt: true,
  lastLoginAt: true,
  phone: true,
  telegram: true,
  birthDate: true,
  createdAt: true,
  updatedAt: true,
  bio: true,
  factualAddress: true,
  nativeLanguage: true,
  communicationLanguage: true,
  phoneVerifiedAt: true,
  telegramVerifiedAt: true,
  emailVerifiedAt: true,
  lastNameCyrillic: true,
  firstNameCyrillic: true,
  middleNameCyrillic: true,
  lastNameLatin: true,
  firstNameLatin: true,
  middleNameLatin: true,
  fullNameCyrillic: true,
  fullNameLatin: true,
  hasNoLastName: true,
  hasNoFirstName: true,
  hasNoMiddleName: true,
  consentPersonalData: true,
  consentClientRules: true,
  accounts: { select: { id: true, provider: true, linkedAt: true, lastUsedAt: true } },
} as const;

async function getManagedEventIds(user: User): Promise<string[] | null> {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });
  return memberships.map(m => m.eventId);
}

function isPlatformScopeUser(user: User) {
  return user.role === 'PLATFORM_ADMIN' || user.role === 'SUPER_ADMIN';
}

async function canAdminAccessUserProfile(actor: User, targetUserId: string, eventId?: string) {
  if (isPlatformScopeUser(actor)) return true;

  if (actor.role !== 'EVENT_ADMIN') return false;
  if (!eventId) return false;

  const actorMembership = await prisma.eventMember.findFirst({
    where: {
      userId: actor.id,
      eventId,
      role: 'EVENT_ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (!actorMembership) return false;

  const [member, teamMember, submission] = await Promise.all([
    prisma.eventMember.findFirst({
      where: { userId: targetUserId, eventId },
      select: { id: true },
    }),
    prisma.eventTeamMember.findFirst({
      where: {
        userId: targetUserId,
        team: { eventId },
      },
      select: { id: true },
    }),
    prisma.eventRegistrationFormSubmission.findFirst({
      where: { userId: targetUserId, eventId },
      select: { id: true },
    }),
  ]);

  return Boolean(member || teamMember || submission);
}

// GET /api/admin/users - список всех пользователей с расширенной информацией
adminUsersRouter.get('/', requirePlatformAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'))));
  const search = String(req.query['search'] ?? '');
  const role = req.query['role'] as string | undefined;
  const hasEventMembership = req.query['hasEventMembership'] as string | undefined;
  const eventId = req.query['eventId'] as string | undefined;
  const includeInactive = req.query['includeInactive'] === 'true';

  const where: Record<string, unknown> = {};
  if (role) where['role'] = role;
  if (!includeInactive) where['isActive'] = true;

  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { firstNameCyrillic: { contains: search, mode: 'insensitive' } },
      { lastNameCyrillic: { contains: search, mode: 'insensitive' } },
      { middleNameCyrillic: { contains: search, mode: 'insensitive' } },
      { firstNameLatin: { contains: search, mode: 'insensitive' } },
      { lastNameLatin: { contains: search, mode: 'insensitive' } },
      { middleNameLatin: { contains: search, mode: 'insensitive' } },
      { fullNameCyrillic: { contains: search, mode: 'insensitive' } },
      { fullNameLatin: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { telegram: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (eventId) {
    where['eventMemberships'] = {
      some: {
        eventId,
      },
    };
  } else if (hasEventMembership === 'YES') {
    where['eventMemberships'] = {
      some: {},
    };
  } else if (hasEventMembership === 'NO') {
    where['NOT'] = {
      eventMemberships: {
        some: {},
      },
    };
  }

  const total = await prisma.user.count({ where: where as any });

  const rawUsers = await prisma.user.findMany({
    where: where as any,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      city: true,
      phone: true,
      telegram: true,
      registeredAt: true,
      createdAt: true,
      lastLoginAt: true,
      accounts: {
        select: {
          id: true,
          provider: true,
          linkedAt: true,
        },
      },
    },
    orderBy: { registeredAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const userIds = rawUsers.map(u => u.id);

  const [membershipCounts, latestMemberships] = await Promise.all([
    prisma.eventMember.groupBy({
      by: ['userId', 'role', 'status'],
      where: { userId: { in: userIds } },
      _count: true,
    }),
    prisma.eventMember.findMany({
      where: { userId: { in: userIds } },
      orderBy: { assignedAt: 'desc' },
      include: {
        event: { select: { id: true, title: true, slug: true } },
      },
    }),
  ]);

  const countsMap: Record<string, {
    eventMembershipsTotal: number;
    participantMembershipsTotal: number;
    volunteerMembershipsTotal: number;
    eventAdminMembershipsTotal: number;
    activeParticipantMembershipsTotal: number;
    teamsTotal: number;
  }> = {};

  for (const uid of userIds) {
    countsMap[uid] = {
      eventMembershipsTotal: 0,
      participantMembershipsTotal: 0,
      volunteerMembershipsTotal: 0,
      eventAdminMembershipsTotal: 0,
      activeParticipantMembershipsTotal: 0,
      teamsTotal: 0,
    };
  }

  for (const item of membershipCounts) {
    const counts = countsMap[item.userId];
    if (!counts) continue;
    counts.eventMembershipsTotal += item._count;
    if (item.role === 'PARTICIPANT') {
      counts.participantMembershipsTotal += item._count;
      if (item.status === 'ACTIVE') {
        counts.activeParticipantMembershipsTotal += item._count;
      }
    } else if (item.role === 'VOLUNTEER') {
      counts.volunteerMembershipsTotal += item._count;
    } else if (item.role === 'EVENT_ADMIN') {
      counts.eventAdminMembershipsTotal += item._count;
    }
  }

  const teamCounts = await prisma.eventTeamMember.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, status: { notIn: ['REMOVED', 'LEFT'] } },
    _count: true,
  });

  for (const tc of teamCounts) {
    if (countsMap[tc.userId]) {
      countsMap[tc.userId].teamsTotal = tc._count;
    }
  }

  const latestMembershipMap: Record<string, {
    eventId: string;
    eventTitle: string;
    eventSlug: string;
    role: string;
    status: string;
    assignedAt: string;
  } | null> = {};

  for (const uid of userIds) {
    latestMembershipMap[uid] = null;
  }

  for (const member of latestMemberships) {
    if (latestMembershipMap[member.userId] === null) {
      latestMembershipMap[member.userId] = {
        eventId: member.eventId,
        eventTitle: member.event?.title ?? '',
        eventSlug: member.event?.slug ?? '',
        role: member.role,
        status: member.status,
        assignedAt: member.assignedAt.toISOString(),
      };
    }
  }

  const users = rawUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name ?? '',
    role: u.role,
    isActive: u.isActive,
    avatarUrl: u.avatarUrl,
    city: u.city ?? '',
    phone: u.phone ?? '',
    telegram: u.telegram ?? '',
    registeredAt: u.registeredAt.toISOString(),
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    accounts: u.accounts.map(a => ({
      id: a.id,
      provider: a.provider,
      providerEmail: null,
      linkedAt: a.linkedAt?.toISOString() ?? null,
    })),
    counts: countsMap[u.id] ?? {
      eventMembershipsTotal: 0,
      participantMembershipsTotal: 0,
      volunteerMembershipsTotal: 0,
      eventAdminMembershipsTotal: 0,
      activeParticipantMembershipsTotal: 0,
      teamsTotal: 0,
    },
    latestMembership: latestMembershipMap[u.id] ?? null,
  }));

  res.json({
    data: users,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// GET /api/admin/users/analytics - аналитика по пользователям
adminUsersRouter.get('/analytics', requirePlatformAdmin, async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersWithEvents,
    usersWithoutEvents,
    participationsActive,
    volunteersActive,
    teamsCount,
    teamsActive,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.eventMember.findMany({
      where: { status: { not: 'REMOVED' } },
      select: { userId: true },
      distinct: ['userId'],
    }).then(memberships => memberships.length),
    prisma.user.count(),
    prisma.eventMember.count({ where: { role: 'PARTICIPANT', status: 'ACTIVE' } }),
    prisma.eventMember.count({ where: { role: 'VOLUNTEER', status: 'ACTIVE' } }),
    prisma.eventTeam.count(),
    prisma.eventTeam.count({ where: { status: 'ACTIVE' } }),
  ]);

  const registrationsTotal = await prisma.user.count();
  const userIdsWithMemberships = await prisma.eventMember.findMany({
    where: { status: { not: 'REMOVED' } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const validIds = new Set(userIdsWithMemberships.map(m => m.userId));
  const usersWithEventsCount = validIds.size;
  const usersWithoutEventsCount = registrationsTotal - usersWithEventsCount;

  res.json({
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersWithEvents: usersWithEventsCount,
    usersWithoutEvents: usersWithoutEventsCount,
    participationsActive,
    volunteersActive,
    teamsCount,
    teamsActive,
  });
});

// GET /api/admin/users/stats - статистика по пользователям
adminUsersRouter.get('/stats', requirePlatformAdmin, async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersWithEventMembership,
    totalParticipantMemberships,
    totalActiveParticipantMemberships,
    totalVolunteerMemberships,
    totalEventAdminMemberships,
    totalTeams,
    totalActiveTeams,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.eventMember.findMany({
      where: { status: { not: 'REMOVED' } },
      select: { userId: true },
      distinct: ['userId'],
    }).then(memberships => memberships.length),
    prisma.eventMember.count({ where: { role: 'PARTICIPANT' } }),
    prisma.eventMember.count({ where: { role: 'PARTICIPANT', status: 'ACTIVE' } }),
    prisma.eventMember.count({ where: { role: 'VOLUNTEER' } }),
    prisma.eventMember.count({ where: { role: 'EVENT_ADMIN' } }),
    prisma.eventTeam.count(),
    prisma.eventTeam.count({ where: { status: { notIn: ['ARCHIVED', 'REJECTED'] } } }),
  ]);

  const totalUsersWithMemberships = await prisma.user.count();
  const usersWithoutMembership = totalUsersWithMemberships - usersWithEventMembership;

  res.json({
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersWithAnyEventMembership: usersWithEventMembership,
    usersWithoutEventMembership: usersWithoutMembership,
    totalParticipantMemberships,
    totalActiveParticipantMemberships,
    totalVolunteerMemberships,
    totalEventAdminMemberships,
    totalTeams,
    totalActiveTeams,
  });
});

// GET /api/admin/users/admins - список админов
adminUsersRouter.get('/admins', requireSuperAdmin, async (_req, res) => {
  const [admins, eventAdmins] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, isActive: true, registeredAt: true },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.eventMember.findMany({
      where: { role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
        event: { select: { id: true, slug: true, title: true, status: true } },
        assignedByUser: { select: { id: true, email: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  res.json({ admins, platformAdmins: admins, eventAdmins });
});

// Deprecated: use GET /:id/profile - оставлен для обратной совместимости
// GET /api/admin/users/:userId - детальный профиль пользователя
adminUsersRouter.get('/:userId', requirePlatformAdmin, async (req, res) => {
  const { userId } = req.params;
  const user = (req as any).user as User;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: userId as string }, { email: userId as string }] },
  });

  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds !== null) {
    const userMemberships = await prisma.eventMember.findMany({
      where: { userId: existing.id },
      select: { eventId: true },
    });
    const userEventIds = new Set(userMemberships.map(m => m.eventId));
    const hasAccess = [...userEventIds].some(id => managedEventIds.includes(id));
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  const [
    profile,
    extendedProfile,
    identityDocument,
    internationalPassport,
    socialLinks,
    activityDirections,
    additionalLanguages,
    emergencyContact,
    eventMemberships,
    teamMemberships,
    submissions,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: existing.id },
      select: { ...USER_PROFILE_SELECT },
    }),
    prisma.userExtendedProfile.findUnique({
      where: { userId: existing.id },
      include: {
        region: { select: { id: true, nameRu: true, nameEn: true } },
        district: { select: { id: true, nameRu: true, nameEn: true } },
        settlement: { select: { id: true, nameRu: true, nameEn: true } },
      },
    }),
    prisma.userIdentityDocument.findUnique({
      where: { userId: existing.id },
      include: { scanAsset: { select: { id: true, publicUrl: true } } },
    }),
    prisma.userInternationalPassport.findUnique({
      where: { userId: existing.id },
      include: { scanAsset: { select: { id: true, publicUrl: true } } },
    }),
    prisma.userSocialLinks.findUnique({ where: { userId: existing.id } }),
    prisma.userActivityDirection.findMany({
      where: { userId: existing.id },
      select: { direction: true, createdAt: true },
    }),
    prisma.userAdditionalLanguage.findMany({
      where: { userId: existing.id },
      select: { languageName: true, createdAt: true },
    }),
    prisma.userEmergencyContact.findUnique({ where: { userId: existing.id } }),
    prisma.eventMember.findMany({
      where: { userId: existing.id, status: { not: 'REMOVED' } },
      include: {
        event: { select: { id: true, title: true, slug: true, startsAt: true, endsAt: true, status: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.eventTeamMember.findMany({
      where: { userId: existing.id, status: { notIn: ['REMOVED', 'LEFT'] } },
      include: {
        team: {
          include: {
            event: { select: { id: true, title: true, slug: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.eventRegistrationFormSubmission.findMany({
      where: { userId: existing.id },
      select: {
        id: true,
        eventId: true,
        answersJson: true,
        isComplete: true,
        createdAt: true,
      },
    }),
  ]);

  const submissionsWithEvents = await Promise.all(
    submissions.map(async (sub) => {
      const event = await prisma.event.findUnique({
        where: { id: sub.eventId },
        select: { id: true, title: true, slug: true },
      });
      return { ...sub, event };
    })
  );

  res.json({
    profile,
    extendedProfile,
    identityDocument,
    internationalPassport,
    socialLinks,
    activityDirections: activityDirections.map(d => d.direction),
    additionalLanguages: additionalLanguages.map(l => l.languageName),
    emergencyContact,
    eventMemberships: eventMemberships.map(m => ({
      id: m.id,
      eventId: m.eventId,
      eventTitle: m.event?.title ?? '',
      eventSlug: m.event?.slug ?? '',
      eventStartsAt: m.event?.startsAt?.toISOString() ?? null,
      eventEndsAt: m.event?.endsAt?.toISOString() ?? null,
      eventStatus: m.event?.status ?? 'DRAFT',
      role: m.role,
      status: m.status,
      assignedAt: m.assignedAt.toISOString(),
      approvedAt: m.approvedAt?.toISOString() ?? null,
      assignedBy: m.assignedByUser ? { id: m.assignedByUser.id, name: m.assignedByUser.name, email: m.assignedByUser.email } : null,
      notes: m.notes,
    })),
    teamMemberships: teamMemberships.map(m => ({
      id: m.id,
      teamId: m.teamId,
      teamName: m.team.name,
      teamStatus: m.team.status,
      eventId: m.team.eventId,
      eventTitle: m.team.event?.title ?? '',
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    })),
    formSubmissions: submissionsWithEvents,
  });
});

// GET /api/admin/users/:id/profile - полный профиль пользователя
adminUsersRouter.get('/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { eventId } = req.query as { eventId?: string };
  const adminUser = (req as any).user as User;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: id as string }, { email: id as string }] },
  });

  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const allowed = await canAdminAccessUserProfile(adminUser, existing.id, eventId);
  if (!allowed) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const [
    profile,
    extendedProfile,
    identityDocument,
    internationalPassport,
    socialLinks,
    activityDirections,
    additionalLanguages,
    additionalDocuments,
    emergencyContact,
    profileSectionStates,
    eventMemberships,
    registrationsSubmissions,
    teamMemberships,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: existing.id },
      select: { ...USER_PROFILE_SELECT },
    }),
    prisma.userExtendedProfile.findUnique({
      where: { userId: existing.id },
      include: {
        region: { select: { id: true, nameRu: true, nameEn: true } },
        district: { select: { id: true, nameRu: true, nameEn: true } },
        settlement: { select: { id: true, nameRu: true, nameEn: true } },
      },
    }),
    prisma.userIdentityDocument.findUnique({
      where: { userId: existing.id },
      include: { scanAsset: { select: { id: true, publicUrl: true } } },
    }),
    prisma.userInternationalPassport.findUnique({
      where: { userId: existing.id },
      include: { scanAsset: { select: { id: true, publicUrl: true } } },
    }),
    prisma.userSocialLinks.findUnique({ where: { userId: existing.id } }),
    prisma.userActivityDirection.findMany({
      where: { userId: existing.id },
      select: { direction: true, createdAt: true },
    }),
    prisma.userAdditionalLanguage.findMany({
      where: { userId: existing.id },
      select: { languageName: true, createdAt: true },
    }),
    prisma.userAdditionalDocument.findMany({
      where: { userId: existing.id },
      include: { asset: { select: { id: true, publicUrl: true } } },
    }),
    prisma.userEmergencyContact.findUnique({ where: { userId: existing.id } }),
    prisma.userProfileSectionState.findMany({
      where: { userId: existing.id },
      select: { sectionKey: true, status: true, updatedAt: true },
    }),
    prisma.eventMember.findMany({
      where: { userId: existing.id },
      include: {
        event: { select: { id: true, title: true, slug: true, status: true, startsAt: true, endsAt: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.eventRegistrationFormSubmission.findMany({
      where: { userId: existing.id },
      select: { id: true, eventId: true, answersJson: true, isComplete: true, createdAt: true },
    }),
    prisma.eventTeamMember.findMany({
      where: { userId: existing.id },
      include: {
        team: {
          include: {
            event: { select: { id: true, title: true, slug: true, status: true, startsAt: true, endsAt: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    }),
  ]);

  const normalizedExtendedProfile = extendedProfile
    ? {
        ...extendedProfile,
        regionText: extendedProfile.region?.nameRu ?? extendedProfile.region?.nameEn ?? null,
        districtText: extendedProfile.district?.nameRu ?? extendedProfile.district?.nameEn ?? null,
        settlementText: extendedProfile.settlement?.nameRu ?? extendedProfile.settlement?.nameEn ?? null,
      }
    : null;

  const result: Record<string, unknown> = {
    profile,
    extendedProfile: normalizedExtendedProfile,
    identityDocument,
    internationalPassport,
    socialLinks,
    activityDirections: activityDirections.map(d => d.direction),
    additionalLanguages: additionalLanguages.map(l => l.languageName),
    additionalDocuments: additionalDocuments.map(doc => ({
      type: doc.type,
      notes: doc.notes,
      asset: doc.asset,
    })),
    emergencyContact,
    accounts: profile?.accounts,
    profileSectionStates: profileSectionStates.map(s => ({
      sectionKey: s.sectionKey,
      status: s.status,
      updatedAt: s.updatedAt.toISOString(),
    })),
    eventMemberships: eventMemberships.map(m => ({
      id: m.id,
      role: m.role,
      status: m.status,
      assignedAt: m.assignedAt.toISOString(),
      approvedAt: m.approvedAt?.toISOString() ?? null,
      rejectedAt: m.rejectedAt?.toISOString() ?? null,
      removedAt: m.removedAt?.toISOString() ?? null,
      notes: m.notes ?? null,
      event: m.event,
    })),
    eventRegistrationFormSubmissions: registrationsSubmissions,
    teamMemberships: teamMemberships.map(m => ({
      id: m.id,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
      approvedAt: m.approvedAt?.toISOString() ?? null,
      removedAt: m.removedAt?.toISOString() ?? null,
      team: {
        id: m.team.id,
        name: m.team.name,
        status: m.team.status,
        captainUserId: m.team.captainUserId,
        eventId: m.team.eventId,
        eventTitle: m.team.event?.title ?? '',
        eventSlug: m.team.event?.slug ?? '',
      },
    })),
  };

  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true, status: true, startsAt: true, endsAt: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const participantMembership = eventMemberships.find(
      m => m.eventId === eventId && m.role === 'PARTICIPANT'
    );
    const volunteerMembership = eventMemberships.find(
      m => m.eventId === eventId && m.role === 'VOLUNTEER'
    );
    const eventAdminMembership = eventMemberships.find(
      m => m.eventId === eventId && m.role === 'EVENT_ADMIN'
    );
    const registrationAnswers = registrationsSubmissions.find(
      s => s.eventId === eventId
    ) ?? null;
    const teamMembership = teamMemberships.find(
      m => m.team.eventId === eventId
    );

    result.selectedEventContext = {
      event,
      participantMembership: participantMembership ? {
        id: participantMembership.id,
        status: participantMembership.status,
        assignedAt: participantMembership.assignedAt.toISOString(),
        approvedAt: participantMembership.approvedAt?.toISOString() ?? null,
      } : null,
      volunteerMembership: volunteerMembership ? {
        id: volunteerMembership.id,
        status: volunteerMembership.status,
        assignedAt: volunteerMembership.assignedAt.toISOString(),
        approvedAt: volunteerMembership.approvedAt?.toISOString() ?? null,
      } : null,
      eventAdminMembership: eventAdminMembership ? {
        id: eventAdminMembership.id,
        status: eventAdminMembership.status,
        assignedAt: eventAdminMembership.assignedAt.toISOString(),
        approvedAt: eventAdminMembership.approvedAt?.toISOString() ?? null,
      } : null,
      registrationAnswers: registrationAnswers ? {
        id: registrationAnswers.id,
        answersJson: registrationAnswers.answersJson,
        isComplete: registrationAnswers.isComplete,
        createdAt: registrationAnswers.createdAt.toISOString(),
      } : null,
      teamMembership: teamMembership ? {
        id: teamMembership.id,
        role: teamMembership.role,
        status: teamMembership.status,
        joinedAt: teamMembership.joinedAt.toISOString(),
        team: {
          id: teamMembership.team.id,
          name: teamMembership.team.name,
          status: teamMembership.team.status,
          captainUserId: teamMembership.team.captainUserId,
        },
      } : null,
    };
  }

  res.json(result);
});

// GET /api/admin/users/export - экспорт всех пользователей с расширенными полями
adminUsersRouter.get('/export', requirePlatformAdmin, async (req, res) => {
  const search = String(req.query['search'] ?? '');
  const role = req.query['role'] as string | undefined;
  const hasEventMembership = req.query['hasEventMembership'] as string | undefined;
  const eventId = req.query['eventId'] as string | undefined;
  const includeInactive = req.query['includeInactive'] === 'true';
  const format = (req.query['format'] as string) || 'csv';

  const where: Record<string, unknown> = {};
  if (role) where['role'] = role;
  if (!includeInactive) where['isActive'] = true;

  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { firstNameCyrillic: { contains: search, mode: 'insensitive' } },
      { lastNameCyrillic: { contains: search, mode: 'insensitive' } },
      { middleNameCyrillic: { contains: search, mode: 'insensitive' } },
      { firstNameLatin: { contains: search, mode: 'insensitive' } },
      { lastNameLatin: { contains: search, mode: 'insensitive' } },
      { middleNameLatin: { contains: search, mode: 'insensitive' } },
      { fullNameCyrillic: { contains: search, mode: 'insensitive' } },
      { fullNameLatin: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { telegram: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (eventId) {
    where['eventMemberships'] = {
      some: {
        eventId,
        status: { not: 'REMOVED' },
      },
    };
  } else if (hasEventMembership === 'YES') {
    where['eventMemberships'] = {
      some: { status: { not: 'REMOVED' } },
    };
  } else if (hasEventMembership === 'NO') {
    where['NOT'] = {
      eventMemberships: {
        some: { status: { not: 'REMOVED' } },
      },
    };
  }

  const [users, membershipCounts, teamCounts, extendedProfiles, emergencyContacts] = await Promise.all([
    prisma.user.findMany({
      where: where as any,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        name: true,
        lastNameCyrillic: true,
        firstNameCyrillic: true,
        middleNameCyrillic: true,
        lastNameLatin: true,
        firstNameLatin: true,
        middleNameLatin: true,
        fullNameCyrillic: true,
        fullNameLatin: true,
        city: true,
        factualAddress: true,
        phone: true,
        telegram: true,
        birthDate: true,
        bio: true,
        nativeLanguage: true,
        communicationLanguage: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        telegramVerifiedAt: true,
        consentPersonalData: true,
        consentPersonalDataAt: true,
        consentClientRules: true,
        consentClientRulesAt: true,
        avatarUrl: true,
        registeredAt: true,
        lastLoginAt: true,
        accounts: { select: { provider: true } },
        gender: true,
      },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.eventMember.groupBy({
      by: ['userId', 'role', 'status'],
      where: {
        userId: { in: users.map(u => u.id) },
      },
      _count: true,
    }),
    prisma.eventTeamMember.groupBy({
      by: ['userId'],
      where: { status: { notIn: ['REMOVED', 'LEFT'] } },
      _count: true,
    }),
    prisma.userExtendedProfile.findMany({
      select: {
        userId: true,
        citizenshipCountryCode: true,
        residenceCountryCode: true,
        region: { select: { nameRu: true } },
        district: { select: { nameRu: true } },
        settlement: { select: { nameRu: true } },
        organizationName: true,
        facultyOrDepartment: true,
        classCourseYear: true,
        positionTitle: true,
        activityStatus: true,
        englishLevel: true,
        russianLevel: true,
      },
    }),
    prisma.userEmergencyContact.findMany({
      select: {
        userId: true,
        fullName: true,
        relationship: true,
        phone: true,
      },
    }),
  ]);

  const extendedProfileMap = new Map(extendedProfiles.map(ep => [ep.userId, ep]));
  const emergencyContactMap = new Map(emergencyContacts.map(ec => [ec.userId, ec]));

  const membershipCountMap: Record<string, { total: number; participants: number; volunteers: number; admins: number; activeParticipants: number }> = {};
  for (const item of membershipCounts) {
    if (!membershipCountMap[item.userId]) {
      membershipCountMap[item.userId] = { total: 0, participants: 0, volunteers: 0, admins: 0, activeParticipants: 0 };
    }
    membershipCountMap[item.userId].total += item._count;
    if (item.role === 'PARTICIPANT') {
      membershipCountMap[item.userId].participants += item._count;
      if (item.status === 'ACTIVE') {
        membershipCountMap[item.userId].activeParticipants += item._count;
      }
    } else if (item.role === 'VOLUNTEER') membershipCountMap[item.userId].volunteers += item._count;
    else if (item.role === 'EVENT_ADMIN') membershipCountMap[item.userId].admins += item._count;
  }

  const teamCountMap: Record<string, number> = {};
  for (const tc of teamCounts) {
    teamCountMap[tc.userId] = tc._count;
  }

  const activityDirectionsMap = new Map<string, string[]>();
  const additionalLanguagesMap = new Map<string, string[]>();

  const [activityDirections, additionalLanguages] = await Promise.all([
    prisma.userActivityDirection.findMany({
      select: { userId: true, direction: true },
    }),
    prisma.userAdditionalLanguage.findMany({
      select: { userId: true, languageName: true },
    }),
  ]);

  for (const ad of activityDirections) {
    if (!activityDirectionsMap.has(ad.userId)) activityDirectionsMap.set(ad.userId, []);
    activityDirectionsMap.get(ad.userId)!.push(ad.direction);
  }

  for (const al of additionalLanguages) {
    if (!additionalLanguagesMap.has(al.userId)) additionalLanguagesMap.set(al.userId, []);
    additionalLanguagesMap.get(al.userId)!.push(al.languageName);
  }

  const exportRows = users.map(u => {
    const ep = extendedProfileMap.get(u.id);
    const ec = emergencyContactMap.get(u.id);
    const mc = membershipCountMap[u.id] ?? { total: 0, participants: 0, volunteers: 0, admins: 0 };
    const tc = teamCountMap[u.id] ?? 0;
    const ads = activityDirectionsMap.get(u.id) ?? [];
    const als = additionalLanguagesMap.get(u.id) ?? [];

    return {
      userId: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      name: u.name ?? '',
      lastNameCyrillic: u.lastNameCyrillic ?? '',
      firstNameCyrillic: u.firstNameCyrillic ?? '',
      middleNameCyrillic: u.middleNameCyrillic ?? '',
      lastNameLatin: u.lastNameLatin ?? '',
      firstNameLatin: u.firstNameLatin ?? '',
      middleNameLatin: u.middleNameLatin ?? '',
      fullNameCyrillic: u.fullNameCyrillic ?? '',
      fullNameLatin: u.fullNameLatin ?? '',
      city: u.city ?? '',
      factualAddress: u.factualAddress ?? '',
      phone: u.phone ?? '',
      telegram: u.telegram ?? '',
      birthDate: u.birthDate ? u.birthDate.toISOString().split('T')[0] : '',
      bio: u.bio ?? '',
      nativeLanguage: u.nativeLanguage ?? '',
      communicationLanguage: u.communicationLanguage ?? '',
      emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : '',
      phoneVerifiedAt: u.phoneVerifiedAt ? u.phoneVerifiedAt.toISOString() : '',
      telegramVerifiedAt: u.telegramVerifiedAt ? u.telegramVerifiedAt.toISOString() : '',
      consentPersonalData: u.consentPersonalData,
      consentPersonalDataAt: u.consentPersonalDataAt ? u.consentPersonalDataAt.toISOString() : '',
      consentClientRules: u.consentClientRules,
      consentClientRulesAt: u.consentClientRulesAt ? u.consentClientRulesAt.toISOString() : '',
      avatarUrl: u.avatarUrl ?? '',
      registeredAt: u.registeredAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : '',
      accountsProviders: u.accounts.map(a => a.provider).join('; '),
      eventMembershipsTotal: mc.total,
      activeParticipantMembershipsTotal: mc.participants,
      volunteerMembershipsTotal: mc.volunteers,
      eventAdminMembershipsTotal: mc.admins,
      teamsTotal: tc,
      gender: u.gender ?? '',
      citizenshipCountryCode: ep?.citizenshipCountryCode ?? '',
      residenceCountryCode: ep?.residenceCountryCode ?? '',
      region: ep?.region?.nameRu ?? '',
      district: ep?.district?.nameRu ?? '',
      settlement: ep?.settlement?.nameRu ?? '',
      organizationName: ep?.organizationName ?? '',
      facultyOrDepartment: ep?.facultyOrDepartment ?? '',
      classCourseYear: ep?.classCourseYear ?? '',
      positionTitle: ep?.positionTitle ?? '',
      activityStatus: ep?.activityStatus ?? '',
      englishLevel: ep?.englishLevel ?? '',
      russianLevel: ep?.russianLevel ?? '',
      activityDirections: ads.join('; '),
      additionalLanguages: als.join('; '),
      emergencyContactFullName: ec?.fullName ?? '',
      emergencyContactRelationship: ec?.relationship ?? '',
      emergencyContactPhone: ec?.phone ?? '',
    };
  });

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.json"');
    res.send(JSON.stringify(exportRows, null, 2));
    return;
  }

  const columns = [
    'userId', 'email', 'role', 'isActive', 'name',
    'lastNameCyrillic', 'firstNameCyrillic', 'middleNameCyrillic',
    'lastNameLatin', 'firstNameLatin', 'middleNameLatin',
    'fullNameCyrillic', 'fullNameLatin',
    'city', 'factualAddress', 'phone', 'telegram',
    'birthDate', 'bio', 'nativeLanguage', 'communicationLanguage',
    'emailVerifiedAt', 'phoneVerifiedAt', 'telegramVerifiedAt',
    'consentPersonalData', 'consentPersonalDataAt', 'consentClientRules', 'consentClientRulesAt',
    'avatarUrl', 'registeredAt', 'lastLoginAt',
    'accountsProviders', 'eventMembershipsTotal', 'activeParticipantMembershipsTotal',
    'volunteerMembershipsTotal', 'eventAdminMembershipsTotal', 'teamsTotal',
    'gender', 'citizenshipCountryCode', 'residenceCountryCode',
    'region', 'district', 'settlement',
    'organizationName', 'facultyOrDepartment', 'classCourseYear', 'positionTitle',
    'activityStatus', 'englishLevel', 'russianLevel',
    'activityDirections', 'additionalLanguages',
    'emergencyContactFullName', 'emergencyContactRelationship', 'emergencyContactPhone',
  ];

  const csvHeader = columns.join(',');
  const csvRows = exportRows.map(row =>
    columns.map(col => {
      const value = (row as any)[col];
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
  res.send(`\ufeff${csvHeader}\n${csvRows.join('\n')}`);
});

// PATCH /api/admin/users/:userId/role - изменение роли пользователя
adminUsersRouter.patch('/:userId/role', requireSuperAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['USER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const { userId } = req.params;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: userId as string }, { email: userId as string }] },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json({ user });
});
