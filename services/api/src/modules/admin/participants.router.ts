import { Router } from 'express';
import type { EventMemberStatus, User } from '@prisma/client';
import { canManageEvent } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';
import { notifyParticipantStatusChanged } from '../events/notifications.service.js';
import { listParticipantsQuerySchema } from './participants.schemas.js';

export const adminParticipantsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const PARTICIPANT_DECISION_STATUSES: EventMemberStatus[] = ['ACTIVE', 'RESERVE', 'REJECTED', 'CANCELLED'];

async function getManagedEventIds(user: User) {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;

  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });

  return memberships.map(m => m.eventId);
}

// GET /admin/participants
adminParticipantsRouter.get('/', async (req, res) => {
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

  const where: Record<string, unknown> = {
    role: role === 'VOLUNTEER' ? 'VOLUNTEER' : 'PARTICIPANT',
  };

  if (managedEventIds) {
    where['eventId'] = eventId ? { in: managedEventIds.filter(id => id === eventId) } : { in: managedEventIds };
  } else if (eventId) {
    where['eventId'] = eventId;
  }

  if (status && status !== 'ALL') {
    where['status'] = status;
  }

  if (search) {
    const normalizedSearch = search.trim();
    const parsedDate = new Date(normalizedSearch);
    const hasValidDate = !Number.isNaN(parsedDate.getTime());

    const searchOr: Record<string, unknown>[] = [
      { user: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { email: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { city: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { firstNameCyrillic: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { lastNameCyrillic: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { middleNameCyrillic: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { firstNameLatin: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { lastNameLatin: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { middleNameLatin: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { fullNameCyrillic: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { fullNameLatin: { contains: normalizedSearch, mode: 'insensitive' } } },
      { event: { title: { contains: normalizedSearch, mode: 'insensitive' } } },
    ];

    if (hasValidDate) {
      const dayStart = new Date(parsedDate);
      dayStart.setHours(0, 0, 0, 0);
      const nextDay = new Date(dayStart);
      nextDay.setDate(nextDay.getDate() + 1);
      searchOr.push({ assignedAt: { gte: dayStart, lt: nextDay } });
    }

    where['OR'] = searchOr;
  }

  const [total, members] = await Promise.all([
    prisma.eventMember.count({ where: where as any }),
    prisma.eventMember.findMany({
      where: where as any,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            city: true,
            firstNameCyrillic: true,
            lastNameCyrillic: true,
            middleNameCyrillic: true,
            firstNameLatin: true,
            lastNameLatin: true,
            middleNameLatin: true,
            fullNameCyrillic: true,
            fullNameLatin: true,
          },
        },
        event: { select: { id: true, title: true, slug: true, startsAt: true } },
      },
      orderBy: { assignedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const submissionPairs = members.map((member) => ({ eventId: member.eventId, userId: member.userId }));
  const submissions = submissionPairs.length > 0
    ? await prisma.eventRegistrationFormSubmission.findMany({
      where: {
        OR: submissionPairs,
      },
      select: {
        eventId: true,
        userId: true,
        answersJson: true,
      },
    })
    : [];

  const answersByPair = new Map<string, unknown>(
    submissions.map((submission) => [`${submission.eventId}:${submission.userId}`, submission.answersJson]),
  );

  const data = members.map(member => ({
    id: member.id,
    userId: member.userId,
    userName: member.user?.name ?? null,
    userEmail: member.user?.email ?? '',
    userCity: member.user?.city ?? null,
    firstNameCyrillic: member.user?.firstNameCyrillic ?? null,
    lastNameCyrillic: member.user?.lastNameCyrillic ?? null,
    middleNameCyrillic: member.user?.middleNameCyrillic ?? null,
    firstNameLatin: member.user?.firstNameLatin ?? null,
    lastNameLatin: member.user?.lastNameLatin ?? null,
    middleNameLatin: member.user?.middleNameLatin ?? null,
    fullNameCyrillic: member.user?.fullNameCyrillic ?? null,
    fullNameLatin: member.user?.fullNameLatin ?? null,
    eventId: member.eventId,
    eventTitle: member.event?.title ?? '',
    eventStartsAt: member.event?.startsAt ? member.event.startsAt.toISOString() : null,
    role: member.role,
    status: member.status,
    answers: answersByPair.get(`${member.eventId}:${member.userId}`) ?? null,
    assignedAt: member.assignedAt.toISOString(),
  }));

  res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// GET /admin/events/:id/participations
adminParticipantsRouter.get('/events/:id/participations', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.query['status'] as EventMemberStatus | undefined;
  const participations = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: 'PARTICIPANT',
      ...(status ? { status } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, city: true } },
      assignedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });

  const [activeCount, pendingCount, reserveCount, rejectedCount] = await Promise.all([
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'PENDING' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: 'RESERVE' } }),
    prisma.eventMember.count({ where: { eventId, role: 'PARTICIPANT', status: { in: ['REJECTED', 'CANCELLED'] } } }),
  ]);

  res.json({
    participations,
    counts: { active: activeCount, pending: pendingCount, reserve: reserveCount, rejected: rejectedCount },
  });
});

// PATCH /admin/events/:id/participations/:memberId
adminParticipantsRouter.patch('/events/:id/participations/:memberId', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.body?.status as EventMemberStatus;
  const notes = req.body?.notes as string | undefined;
  const force = req.body?.force as boolean | undefined;

  if (!PARTICIPANT_DECISION_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid participation status' });
    return;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
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

  const eventAny = event as any;
  const limitMode = eventAny.participantLimitMode;
  const targetLimit = eventAny.participantTarget ?? event.capacity;
  if (status === 'ACTIVE' && limitMode === 'STRICT_LIMIT') {
    const currentActive = await prisma.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    });
    if (currentActive >= targetLimit && !force) {
      res.status(400).json({
        error: 'Capacity reached',
        message: `Cannot approve: strict limit of ${targetLimit} participants reached. Use force=true to override.`,
        currentActive,
        participantTarget: targetLimit,
      });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const data: Record<string, unknown> = {
      status,
      notes: notes ?? undefined,
      approvedAt: status === 'ACTIVE' ? new Date() : null,
      rejectedAt: status === 'REJECTED' ? new Date() : null,
      removedAt: status === 'REMOVED' || status === 'CANCELLED' ? new Date() : null,
    };

    const result = await tx.eventMember.update({
      where: { id: memberId },
      data,
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (membership.status !== 'ACTIVE' && status === 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    } else if (membership.status === 'ACTIVE' && status !== 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { decrement: 1 } } });
    }

    return result;
  });

  await notifyParticipantStatusChanged(eventId, updated.userId, updated.status, updated.notes);
  res.json({ membership: updated });
});

// POST /admin/events/:id/participations/:memberId/approve
adminParticipantsRouter.post('/events/:id/participations/:memberId/approve', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
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

  const eventAny = event as any;
  const limitMode = eventAny.participantLimitMode;
  const targetLimit = eventAny.participantTarget ?? event.capacity;
  if (limitMode === 'STRICT_LIMIT') {
    const currentActive = await prisma.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    });
    if (currentActive >= targetLimit && !req.body?.force) {
      res.status(400).json({ error: 'Capacity reached', currentActive, participantTarget: targetLimit });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const result = await tx.eventMember.update({
      where: { id: memberId },
      data: {
        status: 'ACTIVE',
        notes: req.body?.notes ?? undefined,
        approvedAt: new Date(),
        rejectedAt: null,
        removedAt: null,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (membership.status !== 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    }

    return result;
  });

  await notifyParticipantStatusChanged(eventId, updated.userId, updated.status, updated.notes);
  res.json({ membership: updated });
});

// POST /admin/events/:id/participations/:memberId/reject
adminParticipantsRouter.post('/events/:id/participations/:memberId/reject', async (req, res) => {
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

// POST /admin/events/:id/participations/:memberId/reserve
adminParticipantsRouter.post('/events/:id/participations/:memberId/reserve', async (req, res) => {
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

  const updated = await prisma.$transaction(async (tx: any) => {
    const result = await tx.eventMember.update({
      where: { id: memberId },
      data: {
        status: 'RESERVE',
        notes: req.body?.notes ?? undefined,
        approvedAt: null,
        rejectedAt: null,
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

// POST /admin/events/:id/participations/:memberId/cancel
adminParticipantsRouter.post('/events/:id/participations/:memberId/cancel', async (req, res) => {
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

  const updated = await prisma.$transaction(async (tx: any) => {
    const result = await tx.eventMember.update({
      where: { id: memberId },
      data: {
        status: 'CANCELLED',
        notes: req.body?.notes ?? undefined,
        approvedAt: null,
        rejectedAt: null,
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
  res.json({ membership: updated });
});

// PATCH /admin/events/:id/participants/:memberId (alias for backward compat)
adminParticipantsRouter.patch('/events/:id/participants/:memberId', async (req, res) => {
  const user = (req as any).user as User;
  const eventId = req.params['id']!;
  const memberId = req.params['memberId']!;
  if (!(await canManageEvent(user, eventId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const status = req.body?.status as EventMemberStatus;
  const notes = req.body?.notes as string | undefined;
  const force = req.body?.force as boolean | undefined;

  if (!PARTICIPANT_DECISION_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid participation status' });
    return;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
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

  const eventAny = event as any;
  const limitMode = eventAny.participantLimitMode;
  const targetLimit = eventAny.participantTarget ?? event.capacity;
  if (status === 'ACTIVE' && limitMode === 'STRICT_LIMIT') {
    const currentActive = await prisma.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    });
    if (currentActive >= targetLimit && !force) {
      res.status(400).json({ error: 'Capacity reached', currentActive, participantTarget: targetLimit });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const data: Record<string, unknown> = {
      status,
      notes: notes ?? undefined,
      approvedAt: status === 'ACTIVE' ? new Date() : null,
      rejectedAt: status === 'REJECTED' ? new Date() : null,
      removedAt: status === 'REMOVED' || status === 'CANCELLED' ? new Date() : null,
    };

    const result = await tx.eventMember.update({
      where: { id: memberId },
      data,
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (membership.status !== 'ACTIVE' && status === 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { increment: 1 } } });
    } else if (membership.status === 'ACTIVE' && status !== 'ACTIVE') {
      await tx.event.update({ where: { id: eventId }, data: { registrationsCount: { decrement: 1 } } });
    }

    return result;
  });

  await notifyParticipantStatusChanged(eventId, updated.userId, updated.status, updated.notes);
  res.json({ membership: updated });
});
