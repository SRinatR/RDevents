import { Router } from 'express';
import type { EventMemberStatus, User } from '@prisma/client';
import { canManageEvent, requireAuth, requirePlatformAdmin, requireSuperAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';
import { createEventSchema, updateEventSchema } from '../events/events.schemas.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import { listParticipantsQuerySchema } from './participants.schemas.js';
import { listTeamsQuerySchema } from './teams.schemas.js';

export const adminRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const PLATFORM_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN'];
const VOLUNTEER_DECISION_STATUSES: EventMemberStatus[] = ['REJECTED', 'ACTIVE', 'REMOVED'];

adminRouter.use(requireAuth);

function isPlatformAdmin(user: User) {
  return PLATFORM_ADMIN_ROLES.includes(user.role);
}

async function getManagedEventIds(user: User) {
  if (isPlatformAdmin(user)) return null;

  const memberships = await prisma.eventMember.findMany({
    where: {
      userId: user.id,
      role: 'EVENT_ADMIN',
      status: { in: [...ACTIVE_MEMBER_STATUSES] },
    },
    select: { eventId: true },
  });

  return memberships.map(membership => membership.eventId);
}

async function assertCanManageEvent(user: User, eventId: string, res: any) {
  if (await canManageEvent(user, eventId)) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeEventBody(body: any) {
  return {
    ...body,
    fullDescription: body.fullDescription ?? body.description,
    coverImageUrl: body.coverImageUrl || '',
    tags: normalizeStringArray(body.tags),
    requiredProfileFields: normalizeStringArray(body.requiredProfileFields),
    requiredEventFields: normalizeStringArray(body.requiredEventFields),
  };
}

function toDate(value: string | undefined) {
  if (value === '') return null;
  if (!value) return undefined;
  return new Date(value);
}

async function participantCounts(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, number>();

  const rows = await prisma.eventMember.groupBy({
    by: ['eventId'],
    where: {
      eventId: { in: eventIds },
      role: 'PARTICIPANT',
      status: { in: [...ACTIVE_MEMBER_STATUSES] },
    },
    _count: true,
  });

  return new Map(rows.map(row => [row.eventId, row._count]));
}

function volunteerDecisionData(status: EventMemberStatus, notes?: string) {
  return {
    status,
    approvedAt: status === 'ACTIVE' ? new Date() : null,
    rejectedAt: status === 'REJECTED' ? new Date() : null,
    removedAt: status === 'REMOVED' ? new Date() : null,
    notes: notes ?? undefined,
  };
}

async function listEventAdmins(eventId: string) {
  return prisma.eventMember.findMany({
    where: { eventId, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
}

async function assignEventAdminToEvent(
  eventId: string,
  actor: User,
  input: { userId?: string; email?: string; notes?: string }
) {
  const { userId, email, notes } = input;
  const targetUser = userId
    ? await prisma.user.findUnique({ where: { id: String(userId) } })
    : await prisma.user.findUnique({ where: { email: String(email) } });

  if (!targetUser) throw new Error('USER_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const membership = await tx.eventMember.upsert({
      where: { eventId_userId_role: { eventId, userId: targetUser.id, role: 'EVENT_ADMIN' } },
      create: {
        eventId,
        userId: targetUser.id,
        role: 'EVENT_ADMIN',
        status: 'ACTIVE',
        assignedByUserId: actor.id,
        approvedAt: new Date(),
        notes: notes ?? null,
      },
      update: {
        status: 'ACTIVE',
        assignedByUserId: actor.id,
        assignedAt: new Date(),
        approvedAt: new Date(),
        rejectedAt: null,
        removedAt: null,
        notes: notes ?? null,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    await trackAnalyticsEvent(tx, {
      type: 'EVENT_ADMIN_ASSIGNED',
      userId: targetUser.id,
      eventId,
      meta: { assignedByUserId: actor.id },
    });

    return membership;
  });
}

adminRouter.get('/events', async (req, res) => {
  const user = (req as any).user as User;
  const page = Math.max(1, parseInt(String(req.query['page'] ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));
  const search = String(req.query['search'] ?? '');
  const status = req.query['status'] as string | undefined;
  const id = req.query['id'] as string | undefined;
  const managedEventIds = await getManagedEventIds(user);

  if (managedEventIds && managedEventIds.length === 0) {
    res.json({ data: [], meta: { total: 0, page, limit, pages: 0 } });
    return;
  }

  const where: Record<string, unknown> = {};
  if (id) where['id'] = id;
  if (status) where['status'] = status;
  if (managedEventIds) where['id'] = { in: id ? managedEventIds.filter(eventId => eventId === id) : managedEventIds };
  if (search) {
    where['OR'] = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, events] = await Promise.all([
    prisma.event.count({ where: where as any }),
    prisma.event.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  const counts = await participantCounts(events.map(event => event.id));
  res.json({
    data: events.map(event => ({ ...event, _count: { registrations: counts.get(event.id) ?? 0 } })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

adminRouter.post('/events', requirePlatformAdmin, async (req, res) => {
  const parsed = createEventSchema.safeParse(normalizeEventBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = (req as any).user as User;
  try {
    const event = await prisma.event.create({
      data: {
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        registrationOpensAt: toDate(parsed.data.registrationOpensAt),
        registrationDeadline: toDate(parsed.data.registrationDeadline),
        coverImageUrl: parsed.data.coverImageUrl || null,
        conditions: parsed.data.conditions || null,
        contactEmail: parsed.data.contactEmail || null,
        createdById: user.id,
        publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    res.status(201).json({ event });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'An event with this slug already exists' });
      return;
    }
    throw err;
  }
});

adminRouter.patch('/events/:id', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const parsed = updateEventSchema.safeParse(normalizeEventBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startsAt) data['startsAt'] = new Date(parsed.data.startsAt);
  if (parsed.data.endsAt) data['endsAt'] = new Date(parsed.data.endsAt);
  if (parsed.data.registrationOpensAt !== undefined) data['registrationOpensAt'] = toDate(parsed.data.registrationOpensAt);
  if (parsed.data.registrationDeadline !== undefined) data['registrationDeadline'] = toDate(parsed.data.registrationDeadline);
  if (parsed.data.coverImageUrl !== undefined) data['coverImageUrl'] = parsed.data.coverImageUrl || null;
  if (parsed.data.conditions !== undefined) data['conditions'] = parsed.data.conditions || null;
  if (parsed.data.contactEmail !== undefined) data['contactEmail'] = parsed.data.contactEmail || null;
  if (parsed.data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') data['publishedAt'] = new Date();

  const event = await prisma.event.update({ where: { id: eventId }, data: data as any });
  res.json({ event });
});

adminRouter.delete('/events/:id', requirePlatformAdmin, async (req, res) => {
  await prisma.event.delete({ where: { id: String(req.params['id']) } });
  res.json({ ok: true });
});

adminRouter.get('/events/:id/participants', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const participants = await prisma.eventMember.findMany({
    where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ participants });
});

adminRouter.get('/events/:id/members', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const members = await prisma.eventMember.findMany({
    where: { eventId, status: { not: 'REMOVED' } },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, city: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: 'asc' }, { assignedAt: 'desc' }],
  });
  res.json({ members });
});

// Backwards-compatible endpoint name used by the current web admin table.
adminRouter.get('/events/:id/registrations', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const registrations = await prisma.eventMember.findMany({
    where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ registrations });
});

adminRouter.get('/events/:id/teams', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const teams = await prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'desc' },
      },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ teams });
});

adminRouter.get('/events/:id/event-admins', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const eventAdmins = await listEventAdmins(eventId);
  res.json({ eventAdmins });
});

// URL from the MVP spec.
adminRouter.get('/events/:id/admins', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const eventAdmins = await listEventAdmins(eventId);
  res.json({ eventAdmins, admins: eventAdmins });
});

adminRouter.post('/events/:id/event-admins', requirePlatformAdmin, async (req, res) => {
  const eventId = String(req.params['id']);
  const actor = (req as any).user as User;
  try {
    const membership = await assignEventAdminToEvent(eventId, actor, req.body);
    res.status(201).json({ membership });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw error;
  }
});

// URL from the MVP spec.
adminRouter.post('/events/:id/admins', requirePlatformAdmin, async (req, res) => {
  const eventId = String(req.params['id']);
  const actor = (req as any).user as User;
  try {
    const membership = await assignEventAdminToEvent(eventId, actor, req.body);
    res.status(201).json({ membership });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw error;
  }
});

adminRouter.delete('/events/:id/event-admins/:userId', requirePlatformAdmin, async (req, res) => {
  const eventId = String(req.params['id']);
  const userId = String(req.params['userId']);

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'EVENT_ADMIN' } }
  });

  if (!membership) {
    res.status(404).json({ error: 'Event admin not found' });
    return;
  }

  await prisma.eventMember.update({
    where: { id: membership.id },
    data: { status: 'REMOVED', removedAt: new Date() }
  });

  res.json({ ok: true });
});

// URL from the MVP spec.
adminRouter.delete('/events/:id/admins/:userId', requirePlatformAdmin, async (req, res) => {
  const eventId = String(req.params['id']);
  const userId = String(req.params['userId']);

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'EVENT_ADMIN' } }
  });

  if (!membership) {
    res.status(404).json({ error: 'Event admin not found' });
    return;
  }

  await prisma.eventMember.update({
    where: { id: membership.id },
    data: { status: 'REMOVED', removedAt: new Date() }
  });

  res.json({ ok: true });
});

adminRouter.get('/events/:id/volunteers', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const status = req.query['status'] as EventMemberStatus | undefined;
  const volunteers = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: 'VOLUNTEER',
      ...(status ? { status } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ volunteers });
});

// URL from the MVP spec.
adminRouter.get('/events/:id/volunteer-applications', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const status = req.query['status'] as EventMemberStatus | undefined;
  const volunteerApplications = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: 'VOLUNTEER',
      ...(status ? { status } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ volunteerApplications, volunteers: volunteerApplications });
});

adminRouter.patch('/events/:id/volunteers/:memberId', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const status = req.body?.status as EventMemberStatus;
  if (!VOLUNTEER_DECISION_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid volunteer status' });
    return;
  }

  const membership = await prisma.$transaction(async (tx) => {
    const updated = await tx.eventMember.update({
      where: { id: memberId },
      data: volunteerDecisionData(status, req.body?.notes),
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (status === 'ACTIVE') {
      await trackAnalyticsEvent(tx, {
        type: 'VOLUNTEER_APPLICATION_APPROVED',
        userId: updated.userId,
        eventId,
        meta: { decidedByUserId: user.id },
      });
    }
    if (status === 'REJECTED') {
      await trackAnalyticsEvent(tx, {
        type: 'VOLUNTEER_APPLICATION_REJECTED',
        userId: updated.userId,
        eventId,
        meta: { decidedByUserId: user.id },
      });
    }

    return updated;
  });

  res.json({ membership });
});

async function decideVolunteerByUserId(req: any, res: any, status: 'ACTIVE' | 'REJECTED') {
  const user = req.user as User;
  const eventId = String(req.params['id']);
  const targetUserId = String(req.params['userId']);
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId: targetUserId, role: 'VOLUNTEER' } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Volunteer application not found' });
    return;
  }

  const membership = await prisma.$transaction(async (tx) => {
    const updated = await tx.eventMember.update({
      where: { id: existing.id },
      data: volunteerDecisionData(status, req.body?.notes),
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    await trackAnalyticsEvent(tx, {
      type: status === 'ACTIVE'
        ? 'VOLUNTEER_APPLICATION_APPROVED'
        : 'VOLUNTEER_APPLICATION_REJECTED',
      userId: targetUserId,
      eventId,
      meta: { decidedByUserId: user.id },
    });

    return updated;
  });

  res.json({ membership });
}

adminRouter.post('/events/:id/volunteer-applications/:userId/approve', async (req, res) => {
  await decideVolunteerByUserId(req as any, res as any, 'ACTIVE');
});

adminRouter.post('/events/:id/volunteer-applications/:userId/reject', async (req, res) => {
  await decideVolunteerByUserId(req as any, res as any, 'REJECTED');
});

adminRouter.get('/events/:id/analytics', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await assertCanManageEvent(user, eventId, res))) return;

  const [event, participants, volunteersPending, volunteersApproved, views] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, slug: true } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } } }),
    prisma.eventMember.count({ where: { eventId, role: 'VOLUNTEER', status: 'PENDING' } }),
    prisma.eventMember.count({ where: { eventId, role: 'VOLUNTEER', status: { in: [...ACTIVE_MEMBER_STATUSES] } } }),
    prisma.analyticsEvent.count({ where: { eventId, type: 'EVENT_DETAIL_VIEW' } }),
  ]);

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  res.json({ event, participants, volunteersPending, volunteersApproved, views });
});

adminRouter.get('/users', requirePlatformAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query['page'] ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));
  const search = String(req.query['search'] ?? '');
  const role = req.query['role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (role) where['role'] = role;
  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where: where as any }),
    prisma.user.findMany({
      where: where as any,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        city: true,
        registeredAt: true,
        createdAt: true,
        lastLoginAt: true,
        accounts: { select: { id: true, provider: true } },
        _count: { select: { eventMemberships: true } },
      },
      orderBy: { registeredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ data: users, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

adminRouter.patch('/users/:id/role', requireSuperAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['USER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const idOrEmail = String(req.params['id']);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: idOrEmail }, { email: idOrEmail }] },
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

adminRouter.get('/admins', requireSuperAdmin, async (_req, res) => {
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

adminRouter.get('/volunteers', requirePlatformAdmin, async (_req, res) => {
  const volunteers = await prisma.eventMember.findMany({
    where: { role: 'VOLUNTEER', status: { not: 'REMOVED' } },
    include: {
      event: { select: { id: true, title: true, slug: true } },
      user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true, registeredAt: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });

  res.json({
    volunteers: volunteers.map(volunteer => ({
      ...volunteer.user,
      membershipId: volunteer.id,
      event: volunteer.event,
      status: volunteer.status,
      notes: volunteer.notes,
    })),
  });
});

adminRouter.get('/analytics', requirePlatformAdmin, async (_req, res) => {
  const [
    totalUsers,
    totalEvents,
    totalRegistrations,
    totalViews,
    registrationsByProvider,
    loginsByProvider,
    topViewedRaw,
    topRegisteredEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.count({ where: { status: 'PUBLISHED' } }),
    prisma.eventMember.count({ where: { role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } } }),
    prisma.analyticsEvent.count({ where: { type: 'EVENT_DETAIL_VIEW' } }),
    prisma.analyticsEvent.groupBy({
      by: ['authProvider'],
      where: { type: 'USER_REGISTER', authProvider: { not: null } },
      _count: true,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['authProvider'],
      where: { type: 'USER_LOGIN', authProvider: { not: null } },
      _count: true,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['eventId'],
      where: { type: 'EVENT_DETAIL_VIEW', eventId: { not: null } },
      _count: true,
      orderBy: { _count: { eventId: 'desc' } },
      take: 5,
    }),
    prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { registrationsCount: 'desc' },
      take: 5,
      select: { id: true, slug: true, title: true, category: true, registrationsCount: true },
    }),
  ]);

  const topViewedEventIds = topViewedRaw.map((row: any) => row.eventId).filter(Boolean);
  const topViewedEventDetails = await prisma.event.findMany({
    where: { id: { in: topViewedEventIds } },
    select: { id: true, slug: true, title: true, category: true, registrationsCount: true },
  });
  const topViewedEventDetailsById = new Map(topViewedEventDetails.map(event => [event.id, event]));
  const topViewedEvents = topViewedRaw
    .map((row: any) => {
      const event = topViewedEventDetailsById.get(row.eventId);
      if (!event) return null;
      return {
        eventId: event.id,
        slug: event.slug,
        title: event.title,
        category: event.category,
        registrationsCount: event.registrationsCount,
        viewCount: row._count,
      };
    })
    .filter(Boolean);

  const providerCounts = (rows: { authProvider: string | null; _count: number }[]) =>
    Object.fromEntries(rows.map(row => [row.authProvider ?? 'UNKNOWN', row._count]));

  res.json({
    totalUsers,
    totalEvents,
    totalRegistrations,
    totalEventViews: totalViews,
    conversionViewToRegistration: totalViews > 0 ? totalRegistrations / totalViews : 0,
    registrationsByProvider: providerCounts(registrationsByProvider),
    loginsByProvider: providerCounts(loginsByProvider),
    topViewedEvents,
    topRegisteredEvents: topRegisteredEvents.map(event => ({
      eventId: event.id,
      slug: event.slug,
      title: event.title,
      category: event.category,
      registrationCount: event.registrationsCount,
    })),
  });
});

// ─── Unified Participants Endpoint (fixes N+1) ─────────────────────────────────

adminRouter.get('/participants', async (req, res) => {
  const user = (req as any).user as User;

  const parsed = listParticipantsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }

  const { search, eventId, role, status, page, limit } = parsed.data;
  const managedEventIds = await getManagedEventIds(user);

  if (managedEventIds && managedEventIds.length === 0) {
    res.json({ data: [], meta: { total: 0, page, limit, pages: 0 } });
    return;
  }

  // Build where clause for event members
  const where: Record<string, unknown> = {
    role: { in: role === 'ALL' || !role ? ['PARTICIPANT', 'VOLUNTEER'] : [role] },
  };

  if (managedEventIds) {
    where['eventId'] = eventId ? { in: managedEventIds.filter(id => id === eventId) } : { in: managedEventIds };
  } else if (eventId) {
    where['eventId'] = eventId;
  }

  if (status && status !== 'ALL') {
    where['status'] = status;
  }

  // Search by user name/email
  if (search) {
    where['user'] = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [total, members, events] = await Promise.all([
    prisma.eventMember.count({ where: where as any }),
    prisma.eventMember.findMany({
      where: where as any,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        event: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { assignedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    // Fetch event titles for any events we might need
    prisma.event.findMany({
      select: { id: true, title: true },
    }),
  ]);

  const eventTitles = new Map(events.map(e => [e.id, e.title]));

  const data = members.map(member => ({
    id: member.id,
    userId: member.userId,
    userName: member.user?.name ?? null,
    userEmail: member.user?.email ?? '',
    eventId: member.eventId,
    eventTitle: eventTitles.get(member.eventId) ?? member.event?.title ?? '',
    role: member.role,
    status: member.status,
    assignedAt: member.assignedAt.toISOString(),
  }));

  res.json({
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// ─── Unified Teams Endpoint (fixes N+1) ──────────────────────────────────────

adminRouter.get('/teams', async (req, res) => {
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

  // Build where clause for teams
  const where: Record<string, unknown> = {};

  if (managedEventIds) {
    where['eventId'] = eventId ? { in: managedEventIds.filter(id => id === eventId) } : { in: managedEventIds };
  } else if (eventId) {
    where['eventId'] = eventId;
  }

  if (status && status !== 'ALL') {
    where['status'] = status;
  }

  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, teams, events] = await Promise.all([
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
    prisma.event.findMany({
      select: { id: true, title: true },
    }),
  ]);

  const eventTitles = new Map(events.map(e => [e.id, e.title]));

  const data = teams.map(team => ({
    id: team.id,
    name: team.name,
    eventId: team.eventId,
    eventTitle: eventTitles.get(team.eventId) ?? team.event?.title ?? '',
    captainUserId: team.captainUserId,
    captainUserName: team.captainUser?.name ?? null,
    membersCount: team._count.members,
    status: team.status,
    createdAt: team.createdAt.toISOString(),
  }));

  res.json({
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});
