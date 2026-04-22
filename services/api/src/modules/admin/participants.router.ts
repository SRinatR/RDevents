import { Router } from 'express';
import type { EventMemberStatus, User } from '@prisma/client';
import { canManageEvent } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';
import { listParticipantsQuerySchema } from './participants.schemas.js';

export const adminParticipantsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

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
  } else {
    where['status'] = { notIn: ['REJECTED', 'CANCELLED', 'REMOVED'] };
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
