import { Router } from 'express';
import type { EventMemberStatus, EventStaffRole, EventTeamStatus, User } from '@prisma/client';
import { canManageEvent, requirePlatformAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';
import { createEventSchema, updateEventSchema } from '../events/events.schemas.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import { notifyParticipantStatusChanged } from '../events/notifications.service.js';
import { approveTeamChangeRequest, rejectTeamChangeRequest } from '../events/events.service.js';
import { getActiveProfileRequirementFields } from '../profile-config/profile-field-values.js';
import {
  applyActiveWorkspacePoliciesToEvent,
  canAccessEvent,
  canManageWorkspace,
  createDirectEventStaffGrant,
  getManagedEventIds,
  recalculateEventStaffAccess,
  revokeEventStaffGrant,
} from '../access-control/access-control.service.js';
import { buildAuditRequestContext, writeAuditLog } from '../access-control/access-control.audit.js';
import { env } from '../../config/env.js';

export const adminEventsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeRequiredProfileFields(value: unknown) {
  return getActiveProfileRequirementFields(normalizeStringArray(value));
}

function normalizeEventBody(body: any) {
  return {
    ...body,
    fullDescription: body.fullDescription ?? body.description,
    coverImageUrl: body.coverImageUrl || '',
    tags: normalizeStringArray(body.tags),
    requiredProfileFields: normalizeRequiredProfileFields(body.requiredProfileFields),
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

const EVENT_STAFF_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_OPERATOR', 'VIEWER']);

async function resolveTargetUser(input: { userId?: unknown; email?: unknown }) {
  if (input.userId) return prisma.user.findUnique({ where: { id: String(input.userId) } });
  if (input.email) return prisma.user.findUnique({ where: { email: String(input.email) } });
  return null;
}

async function dualWriteLegacyEventAdmin(eventId: string, actorId: string, targetUserId: string, notes?: unknown) {
  if (!env.RBAC_V2_DUAL_WRITE) return null;

  return prisma.eventMember.upsert({
    where: { eventId_userId_role: { eventId, userId: targetUserId, role: 'EVENT_ADMIN' } },
    create: {
      eventId,
      userId: targetUserId,
      role: 'EVENT_ADMIN',
      status: 'ACTIVE',
      assignedByUserId: actorId,
      approvedAt: new Date(),
      notes: notes ? String(notes) : null,
    },
    update: {
      status: 'ACTIVE',
      assignedByUserId: actorId,
      assignedAt: new Date(),
      approvedAt: new Date(),
      rejectedAt: null,
      removedAt: null,
      notes: notes ? String(notes) : null,
    },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
}

// GET /admin/events
adminEventsRouter.get('/', async (req, res) => {
  const user = (req as any).user as User;
  const page = Math.max(1, parseInt(String(req.query['page'] ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));
  const search = String(req.query['search'] ?? '');
  const status = req.query['status'] as string | undefined;
  const id = req.query['id'] as string | undefined;
  const organizerWorkspaceId = req.query['organizerWorkspaceId'] as string | undefined;

  const isPlatformAdmin = ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role);

  if (!isPlatformAdmin) {
    const managedEventIds = await getManagedEventIds(user, 'event.read');

    if (managedEventIds.length === 0) {
      res.json({ data: [], meta: { total: 0, page, limit, pages: 0 } });
      return;
    }

    const where: Record<string, unknown> = {};
    if (id) where['id'] = id;
    if (status) where['status'] = status;
    if (organizerWorkspaceId) where['organizerWorkspaceId'] = organizerWorkspaceId;
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
        include: { createdBy: { select: { id: true, name: true } } },
      }),
    ]);

    const counts = await participantCounts(events.map(e => e.id));
    res.json({
      data: events.map(event => ({ ...event, _count: { registrations: counts.get(event.id) ?? 0 } })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
    return;
  }

  const where: Record<string, unknown> = {};
  if (id) where['id'] = id;
  if (status) where['status'] = status;
  if (organizerWorkspaceId) where['organizerWorkspaceId'] = organizerWorkspaceId;
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
      include: { createdBy: { select: { id: true, name: true } } },
    }),
  ]);

  const counts = await participantCounts(events.map(e => e.id));
  res.json({
    data: events.map(event => ({ ...event, _count: { registrations: counts.get(event.id) ?? 0 } })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// POST /admin/events
adminEventsRouter.post('/', async (req, res) => {
  const parsed = createEventSchema.safeParse(normalizeEventBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = (req as any).user as User;
  const organizerWorkspaceId = parsed.data.organizerWorkspaceId ?? null;
  const isPlatformAdmin = ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role);

  if (organizerWorkspaceId) {
    const workspace = await prisma.organizerWorkspace.findUnique({
      where: { id: organizerWorkspaceId },
      select: { id: true, status: true },
    });
    if (!workspace || workspace.status !== 'ACTIVE') {
      res.status(404).json({ error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' });
      return;
    }
    if (!(await canManageWorkspace(user, organizerWorkspaceId, 'workspace.events.create'))) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
  } else if (!isPlatformAdmin) {
    res.status(400).json({ error: 'organizerWorkspaceId is required', code: 'WORKSPACE_REQUIRED' });
    return;
  }

  try {
    const event = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.event.create({
        data: {
          ...parsed.data,
          organizerWorkspaceId,
          startsAt: new Date(parsed.data.startsAt),
          endsAt: new Date(parsed.data.endsAt),
          registrationOpensAt: toDate(parsed.data.registrationOpensAt),
          registrationDeadline: toDate(parsed.data.registrationDeadline),
          coverImageUrl: parsed.data.coverImageUrl || null,
          conditions: parsed.data.conditions || null,
          contactEmail: parsed.data.contactEmail || null,
          contactPhone: parsed.data.contactPhone || null,
          createdById: user.id,
          publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null,
        },
      });

      const ownerGrant = await tx.eventStaffGrant.create({
        data: {
          eventId: createdEvent.id,
          userId: user.id,
          role: 'OWNER',
          source: 'SYSTEM',
          assignedByUserId: user.id,
          reason: 'Event creator',
        },
      });
      await recalculateEventStaffAccess(tx, createdEvent.id, user.id);
      await applyActiveWorkspacePoliciesToEvent(tx, createdEvent.id);
      await writeAuditLog(tx, {
        ...buildAuditRequestContext(req),
        action: 'EVENT_STAFF_GRANT_CREATED',
        eventId: createdEvent.id,
        targetUserId: user.id,
        afterJson: ownerGrant as any,
        meta: { reason: 'event_creator_owner_grant', organizerWorkspaceId },
      });

      return createdEvent;
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

// PATCH /admin/events/:id
adminEventsRouter.patch('/:id', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

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
  if (parsed.data.contactPhone !== undefined) data['contactPhone'] = parsed.data.contactPhone || null;
  if (parsed.data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') data['publishedAt'] = new Date();

  const event = await prisma.event.update({ where: { id: eventId }, data: data as any });
  res.json({ event });
});

// DELETE /admin/events/:id
adminEventsRouter.delete('/:id', requirePlatformAdmin, async (req, res) => {
  await prisma.event.delete({ where: { id: String(req.params['id']) } });
  res.json({ ok: true });
});

// GET /admin/events/:id/participants (backward compatible)
adminEventsRouter.get('/:id/participants', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const participants = await prisma.eventMember.findMany({
    where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ participants });
});

// GET /admin/events/:id/members
adminEventsRouter.get('/:id/members', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const members = await prisma.eventMember.findMany({
    where: { eventId, status: { not: 'REMOVED' } },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, city: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: 'asc' }, { assignedAt: 'desc' }],
  });
  const submissions = await prisma.eventRegistrationFormSubmission.findMany({
    where: {
      eventId,
      userId: { in: [...new Set(members.map(member => member.userId))] },
    },
    select: { userId: true, answersJson: true, isComplete: true, updatedAt: true },
  });
  const submissionsByUserId = new Map(submissions.map(item => [item.userId, item]));

  res.json({
    members: members.map(member => {
      const submission = submissionsByUserId.get(member.userId);
      return {
        ...member,
        answers: submission?.answersJson ?? {},
        answersComplete: submission?.isComplete ?? false,
        answersUpdatedAt: submission?.updatedAt ?? null,
      };
    }),
  });
});

// GET /admin/events/:id/registrations (backward compatible)
adminEventsRouter.get('/:id/registrations', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const registrations = await prisma.eventMember.findMany({
    where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ registrations });
});

// GET /admin/events/:id/teams
adminEventsRouter.get('/:id/teams', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const teams = await prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'desc' },
      },
      changeRequests: {
        where: { status: 'PENDING' },
        include: {
          requestedByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ teams });
});

// POST /admin/events/:id/teams/:teamId/change-requests/:requestId/approve
adminEventsRouter.post('/:id/teams/:teamId/change-requests/:requestId/approve', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const team = await approveTeamChangeRequest(
      eventId,
      req.params['teamId']!,
      req.params['requestId']!,
      user.id,
      req.body?.notes
    );
    res.json({ team });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      TEAM_CHANGE_REQUEST_NOT_FOUND: [404, 'Team change request not found'],
      TEAM_CHANGE_REQUEST_CLOSED: [409, 'Team change request is already closed'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: err.message });
  }
});

// POST /admin/events/:id/teams/:teamId/change-requests/:requestId/reject
adminEventsRouter.post('/:id/teams/:teamId/change-requests/:requestId/reject', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const team = await rejectTeamChangeRequest(
      eventId,
      req.params['teamId']!,
      req.params['requestId']!,
      user.id,
      req.body?.notes
    );
    res.json({ team });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      TEAM_CHANGE_REQUEST_NOT_FOUND: [404, 'Team change request not found'],
      TEAM_CHANGE_REQUEST_CLOSED: [409, 'Team change request is already closed'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: err.message });
  }
});

// GET /admin/events/:id/event-admins
adminEventsRouter.get('/:id/event-admins', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const eventAdmins = await prisma.eventMember.findMany({
    where: { eventId, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  const staffGrants = await prisma.eventStaffGrant.findMany({
    where: { eventId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.setHeader('Deprecation', 'true');
  res.json({ eventAdmins, staffGrants, deprecated: true });
});

// GET /admin/events/:id/admins (MVP spec - alias)
adminEventsRouter.get('/:id/admins', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const eventAdmins = await prisma.eventMember.findMany({
    where: { eventId, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  const staffGrants = await prisma.eventStaffGrant.findMany({
    where: { eventId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  res.setHeader('Deprecation', 'true');
  res.json({ eventAdmins, admins: eventAdmins, staffGrants, deprecated: true });
});

// POST /admin/events/:id/event-admins
adminEventsRouter.post('/:id/event-admins', async (req, res) => {
  const eventId = String(req.params['id']);
  const actor = (req as any).user as User;
  const { notes } = req.body;
  const role = String(req.body?.role ?? 'ADMIN');

  if (!EVENT_STAFF_ROLES.has(role) || role === 'OWNER') {
    res.status(400).json({ error: 'Invalid event staff role', code: 'INVALID_EVENT_STAFF_ROLE' });
    return;
  }

  const targetUser = await resolveTargetUser(req.body);

  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  try {
    const grant = await createDirectEventStaffGrant(actor, {
      eventId,
      userId: targetUser.id,
      role: role as EventStaffRole,
      reason: notes ? String(notes) : null,
      audit: buildAuditRequestContext(req),
    });
    const membership = await dualWriteLegacyEventAdmin(eventId, actor.id, targetUser.id, notes);
    await trackAnalyticsEvent(prisma, {
      type: 'EVENT_ADMIN_ASSIGNED',
      userId: targetUser.id,
      eventId,
      meta: { assignedByUserId: actor.id, grantId: grant.id, deprecatedEndpoint: 'event-admins' },
    });

    res.setHeader('Deprecation', 'true');
    res.status(201).json({ grant, membership, deprecated: true });
  } catch (error: any) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    res.status(code === 'FORBIDDEN' ? 403 : 500).json({ error: code, code });
  }
});

// POST /admin/events/:id/admins (MVP spec - alias)
adminEventsRouter.post('/:id/admins', async (req, res) => {
  const eventId = String(req.params['id']);
  const actor = (req as any).user as User;
  const { notes } = req.body;
  const role = String(req.body?.role ?? 'ADMIN');

  if (!EVENT_STAFF_ROLES.has(role) || role === 'OWNER') {
    res.status(400).json({ error: 'Invalid event staff role', code: 'INVALID_EVENT_STAFF_ROLE' });
    return;
  }

  const targetUser = await resolveTargetUser(req.body);

  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  try {
    const grant = await createDirectEventStaffGrant(actor, {
      eventId,
      userId: targetUser.id,
      role: role as EventStaffRole,
      reason: notes ? String(notes) : null,
      audit: buildAuditRequestContext(req),
    });
    const membership = await dualWriteLegacyEventAdmin(eventId, actor.id, targetUser.id, notes);
    await trackAnalyticsEvent(prisma, {
      type: 'EVENT_ADMIN_ASSIGNED',
      userId: targetUser.id,
      eventId,
      meta: { assignedByUserId: actor.id, grantId: grant.id, deprecatedEndpoint: 'admins' },
    });

    res.setHeader('Deprecation', 'true');
    res.status(201).json({ grant, membership, deprecated: true });
  } catch (error: any) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    res.status(code === 'FORBIDDEN' ? 403 : 500).json({ error: code, code });
  }
});

// DELETE /admin/events/:id/event-admins/:userId
adminEventsRouter.delete('/:id/event-admins/:userId', async (req, res) => {
  const eventId = String(req.params['id']);
  const userId = String(req.params['userId']);

  const actor = (req as any).user as User;
  if (!(await canAccessEvent(actor, eventId, 'event.manageStaff'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'EVENT_ADMIN' } }
  });

  const grants = await prisma.eventStaffGrant.findMany({
    where: { eventId, userId, role: 'ADMIN', status: 'ACTIVE', source: 'DIRECT' },
    select: { id: true },
  });

  if (!membership && grants.length === 0) {
    res.status(404).json({ error: 'Event admin not found' });
    return;
  }

  for (const grant of grants) {
    await revokeEventStaffGrant(actor, grant.id, buildAuditRequestContext(req));
  }

  if (membership) {
    await prisma.eventMember.update({
      where: { id: membership.id },
      data: { status: 'REMOVED', removedAt: new Date() }
    });
  }

  res.setHeader('Deprecation', 'true');
  res.json({ ok: true, deprecated: true });
});

// DELETE /admin/events/:id/admins/:userId (MVP spec - alias)
adminEventsRouter.delete('/:id/admins/:userId', async (req, res) => {
  const eventId = String(req.params['id']);
  const userId = String(req.params['userId']);

  const actor = (req as any).user as User;
  if (!(await canAccessEvent(actor, eventId, 'event.manageStaff'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'EVENT_ADMIN' } }
  });

  const grants = await prisma.eventStaffGrant.findMany({
    where: { eventId, userId, role: 'ADMIN', status: 'ACTIVE', source: 'DIRECT' },
    select: { id: true },
  });

  if (!membership && grants.length === 0) {
    res.status(404).json({ error: 'Event admin not found' });
    return;
  }

  for (const grant of grants) {
    await revokeEventStaffGrant(actor, grant.id, buildAuditRequestContext(req));
  }

  if (membership) {
    await prisma.eventMember.update({
      where: { id: membership.id },
      data: { status: 'REMOVED', removedAt: new Date() }
    });
  }

  res.setHeader('Deprecation', 'true');
  res.json({ ok: true, deprecated: true });
});

// GET /admin/events/:id/volunteers
adminEventsRouter.get('/:id/volunteers', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.query['status'] as EventMemberStatus | undefined;
  const volunteers = await prisma.eventMember.findMany({
    where: { eventId, role: 'VOLUNTEER', ...(status ? { status } : {}) },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ volunteers });
});

// GET /admin/events/:id/volunteer-applications (MVP spec - alias)
adminEventsRouter.get('/:id/volunteer-applications', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.query['status'] as EventMemberStatus | undefined;
  const volunteerApplications = await prisma.eventMember.findMany({
    where: { eventId, role: 'VOLUNTEER', ...(status ? { status } : {}) },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
  res.json({ volunteerApplications, volunteers: volunteerApplications });
});

// PATCH /admin/events/:id/volunteers/:memberId
adminEventsRouter.patch('/:id/volunteers/:memberId', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.body?.status as EventMemberStatus;
  const VOLUNTEER_DECISION_STATUSES: EventMemberStatus[] = ['REJECTED', 'ACTIVE', 'REMOVED'];
  if (!VOLUNTEER_DECISION_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid volunteer status' });
    return;
  }

  const membership = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.eventMember.update({
      where: { id: memberId },
      data: {
        status,
        approvedAt: status === 'ACTIVE' ? new Date() : null,
        rejectedAt: status === 'REJECTED' ? new Date() : null,
        removedAt: status === 'REMOVED' ? new Date() : null,
        notes: req.body?.notes ?? undefined,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (status === 'ACTIVE') {
      await trackAnalyticsEvent(tx, { type: 'VOLUNTEER_APPLICATION_APPROVED', userId: updated.userId, eventId, meta: { decidedByUserId: user.id } });
    }
    if (status === 'REJECTED') {
      await trackAnalyticsEvent(tx, { type: 'VOLUNTEER_APPLICATION_REJECTED', userId: updated.userId, eventId, meta: { decidedByUserId: user.id } });
    }

    return updated;
  });

  await notifyParticipantStatusChanged(eventId, membership.userId, membership.status, membership.notes);
  res.json({ membership });
});

// POST /admin/events/:id/volunteer-applications/:userId/approve
adminEventsRouter.post('/:id/volunteer-applications/:userId/approve', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = String(req.params['id']);
  const targetUserId = String(req.params['userId']);
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId: targetUserId, role: 'VOLUNTEER' } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Volunteer application not found' });
    return;
  }

  const membership = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.eventMember.update({
      where: { id: existing.id },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
        rejectedAt: null,
        removedAt: null,
        notes: req.body?.notes ?? undefined,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    await trackAnalyticsEvent(tx, {
      type: 'VOLUNTEER_APPLICATION_APPROVED',
      userId: targetUserId,
      eventId,
      meta: { decidedByUserId: user.id },
    });

    return updated;
  });

  await notifyParticipantStatusChanged(eventId, membership.userId, membership.status, membership.notes);
  res.json({ membership });
});

// POST /admin/events/:id/volunteer-applications/:userId/reject
adminEventsRouter.post('/:id/volunteer-applications/:userId/reject', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = String(req.params['id']);
  const targetUserId = String(req.params['userId']);
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId: targetUserId, role: 'VOLUNTEER' } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Volunteer application not found' });
    return;
  }

  const membership = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.eventMember.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        approvedAt: null,
        removedAt: null,
        notes: req.body?.notes ?? undefined,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    await trackAnalyticsEvent(tx, {
      type: 'VOLUNTEER_APPLICATION_REJECTED',
      userId: targetUserId,
      eventId,
      meta: { decidedByUserId: user.id },
    });

    return updated;
  });

  await notifyParticipantStatusChanged(eventId, membership.userId, membership.status, membership.notes);
  res.json({ membership });
});

// GET /admin/events/:id/analytics
adminEventsRouter.get('/:id/analytics', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

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

// GET /admin/events/:id/overview
adminEventsRouter.get('/:id/overview', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true, status: true, startsAt: true, endsAt: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const [
    participantsTotal,
    participantsActive,
    participantsPending,
    participantsReserve,
    participantsRejected,
    participantsCancelled,
    participantsRemoved,
    volunteersTotal,
    volunteersPending,
    volunteersActive,
    teamsTotal,
    teamsActive,
    teamsPending,
    teamsChangesPending,
    teamsRejected,
    teamsArchived,
    teamMembersActive,
  ] = await Promise.all([
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'ACTIVE' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'PENDING' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'RESERVE' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'REJECTED' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'CANCELLED' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'REMOVED' } }),
    prisma.eventMember.count({ where: { eventId, role: 'VOLUNTEER' } }),
    prisma.eventMember.count({ where: { eventId, role: 'VOLUNTEER', status: 'PENDING' } }),
    prisma.eventMember.count({ where: { eventId, role: 'VOLUNTEER', status: 'ACTIVE' } }),
    prisma.eventTeam.count({ where: { eventId } }),
    prisma.eventTeam.count({ where: { eventId, status: 'ACTIVE' } }),
    prisma.eventTeam.count({ where: { eventId, status: 'PENDING' } }),
    prisma.eventTeamChangeRequest.count({ where: { team: { eventId }, status: 'PENDING' } }),
    prisma.eventTeam.count({ where: { eventId, status: 'REJECTED' } }),
    prisma.eventTeam.count({ where: { eventId, status: 'ARCHIVED' } }),
    prisma.eventTeamMember.count({ where: { team: { eventId }, status: 'ACTIVE' } }),
  ]);

  res.json({
    event,
    counts: {
      participantsTotal,
      participantsActive,
      participantsPending,
      participantsReserve,
      participantsRejected,
      participantsCancelled,
      participantsRemoved,
      volunteersTotal,
      volunteersPending,
      volunteersActive,
      teamsTotal,
      teamsActive,
      teamsPending,
      teamsChangesPending,
      teamsRejected,
      teamsArchived,
      teamMembersActive,
    },
  });
});

const PARTICIPANT_DECISION_STATUSES: EventMemberStatus[] = ['ACTIVE', 'RESERVE', 'REJECTED', 'CANCELLED'];

// POST /admin/events/:id/participants/:memberId/remove
adminEventsRouter.post('/:id/participants/:memberId/remove', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const membership = await prisma.eventMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!membership || membership.eventId !== eventId) {
    res.status(404).json({ error: 'Membership not found' });
    return;
  }

  const activeTeamStatuses: EventTeamStatus[] = ['ACTIVE', 'PENDING', 'SUBMITTED', 'CHANGES_PENDING'];
  const isTeamCaptain = await prisma.eventTeam.findFirst({
    where: {
      eventId,
      captainUserId: membership.userId,
      status: { in: activeTeamStatuses },
    },
  });
  if (isTeamCaptain) {
    res.status(409).json({
      error: 'PARTICIPANT_IS_TEAM_CAPTAIN',
      message: 'Сначала передайте капитанство или архивируйте команду',
    });
    return;
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const result = await tx.eventMember.update({
      where: { id: memberId },
      data: {
        status: 'REMOVED',
        notes: req.body?.notes ?? `Removed by admin: ${user.email}`,
        removedAt: new Date(),
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (membership.status === 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { decrement: 1 } } });
    }

    return result;
  });

  await notifyParticipantStatusChanged(eventId, updated.userId, updated.status, updated.notes);
  res.json({ membership: updated, message: 'Participant removed successfully' });
});

// POST /admin/events/:id/participants/:memberId/reject
adminEventsRouter.post('/:id/participants/:memberId/reject', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const membership = await prisma.eventMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!membership || membership.eventId !== eventId || membership.role !== 'PARTICIPANT') {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }

  const activeTeamStatuses: EventTeamStatus[] = ['ACTIVE', 'PENDING', 'SUBMITTED', 'CHANGES_PENDING'];
  const isTeamCaptain = await prisma.eventTeam.findFirst({
    where: {
      eventId,
      captainUserId: membership.userId,
      status: { in: activeTeamStatuses },
    },
  });
  if (isTeamCaptain) {
    res.status(409).json({
      error: 'PARTICIPANT_IS_TEAM_CAPTAIN',
      message: 'Сначала передайте капитанство или архивируйте команду',
    });
    return;
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const result = await tx.eventMember.update({
      where: { id: memberId },
      data: {
        status: 'REJECTED',
        notes: req.body?.notes ?? undefined,
        approvedAt: null,
        rejectedAt: new Date(),
        removedAt: null,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (membership.status === 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { decrement: 1 } } });
    }

    return result;
  });

  await notifyParticipantStatusChanged(eventId, updated.userId, updated.status, updated.notes);
  res.json({ membership: updated });
});

// PATCH /admin/events/:id/participations/:memberId — unified participant status update
adminEventsRouter.patch('/:id/participations/:memberId', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.body?.status as EventMemberStatus;
  const VALID_PARTICIPANT_STATUSES: EventMemberStatus[] = ['ACTIVE', 'RESERVE', 'REJECTED', 'REMOVED'];
  if (!status || !VALID_PARTICIPANT_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid participant status. Must be one of: ACTIVE, RESERVE, REJECTED, REMOVED' });
    return;
  }

  const membership = await prisma.eventMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!membership || membership.eventId !== eventId || membership.role !== 'PARTICIPANT') {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }

  const activeTeamStatuses: EventTeamStatus[] = ['ACTIVE', 'PENDING', 'SUBMITTED', 'CHANGES_PENDING'];
  const isTeamCaptain = await prisma.eventTeam.findFirst({
    where: {
      eventId,
      captainUserId: membership.userId,
      status: { in: activeTeamStatuses },
    },
  });
  if (isTeamCaptain) {
    res.status(409).json({
      error: 'PARTICIPANT_IS_TEAM_CAPTAIN',
      message: 'Сначала передайте капитанство или архивируйте команду',
    });
    return;
  }

  const updateData: Record<string, unknown> = {
    status,
    notes: req.body?.notes ?? undefined,
    approvedAt: status === 'ACTIVE' ? new Date() : null,
    rejectedAt: status === 'REJECTED' ? new Date() : null,
    removedAt: status === 'REMOVED' ? new Date() : null,
  };

  const updated = await prisma.$transaction(async (tx: any) => {
    const result = await tx.eventMember.update({
      where: { id: memberId },
      data: updateData,
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    const wasActive = membership.status === 'ACTIVE';
    const nowActive = status === 'ACTIVE';
    if (wasActive && !nowActive) {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { decrement: 1 } } });
    } else if (!wasActive && nowActive) {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    }

    return result;
  });

  await notifyParticipantStatusChanged(eventId, updated.userId, updated.status, updated.notes);
  res.json({ membership: updated });
});
