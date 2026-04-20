import { Router } from 'express';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

export const adminApplicationsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

const listApplicationsQuerySchema = z.object({
  search: z.string().optional(),
  eventId: z.string().optional(),
  status: z.enum(['ALL', 'PENDING', 'ACTIVE', 'RESERVE', 'REJECTED', 'CANCELLED']).optional(),
  type: z.enum(['ALL', 'PARTICIPANT', 'VOLUNTEER', 'TEAM']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(100),
});

async function getManagedEventIds(user: User) {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;
  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });
  return memberships.map((item) => item.eventId);
}

function normalizeTeamRequestStatus(status: string) {
  if (status === 'APPROVED') return 'ACTIVE';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

// GET /api/admin/applications
adminApplicationsRouter.get('/', async (req, res) => {
  const user = (req as any).user as User;
  const parsed = listApplicationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }

  const { search, eventId, status, type } = parsed.data;
  const managedEventIds = await getManagedEventIds(user);

  if (managedEventIds && managedEventIds.length === 0) {
    res.json({ data: [], meta: { total: 0, page: 1, limit: 100, pages: 0 } });
    return;
  }

  const normalizedSearch = search?.trim();
  const parsedDate = normalizedSearch ? new Date(normalizedSearch) : null;
  const hasValidDate = Boolean(parsedDate && !Number.isNaN(parsedDate.getTime()));
  const dayStart = hasValidDate && parsedDate ? new Date(parsedDate) : null;
  if (dayStart) dayStart.setHours(0, 0, 0, 0);
  const nextDay = dayStart ? new Date(dayStart) : null;
  if (nextDay) nextDay.setDate(nextDay.getDate() + 1);

  const eventFilter = managedEventIds
    ? (eventId ? managedEventIds.filter((id) => id === eventId) : managedEventIds)
    : (eventId ? [eventId] : null);

  const memberWhere: Record<string, unknown> = {};
  if (eventFilter) memberWhere['eventId'] = { in: eventFilter };
  if (status && status !== 'ALL') memberWhere['status'] = status;
  if (type === 'PARTICIPANT') memberWhere['role'] = 'PARTICIPANT';
  else if (type === 'VOLUNTEER') memberWhere['role'] = 'VOLUNTEER';
  else memberWhere['role'] = { in: ['PARTICIPANT', 'VOLUNTEER'] };

  if (normalizedSearch) {
    const searchOr: Record<string, unknown>[] = [
      { user: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
      { user: { email: { contains: normalizedSearch, mode: 'insensitive' } } },
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
    if (dayStart && nextDay) searchOr.push({ assignedAt: { gte: dayStart, lt: nextDay } });
    memberWhere['OR'] = searchOr;
  }

  const teamWhere: Record<string, unknown> = {};
  if (eventFilter) teamWhere['team'] = { eventId: { in: eventFilter } };
  if (status && status !== 'ALL') {
    const teamStatusMap: Record<string, string[]> = {
      PENDING: ['PENDING'],
      ACTIVE: ['APPROVED'],
      REJECTED: ['REJECTED'],
      CANCELLED: ['CANCELLED'],
    };
    const allowed = teamStatusMap[status];
    teamWhere['status'] = allowed ? { in: allowed } : '__none__';
  }
  if (normalizedSearch) {
    const searchOr: Record<string, unknown>[] = [
      { proposedName: { contains: normalizedSearch, mode: 'insensitive' } },
      { team: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
      { team: { event: { title: { contains: normalizedSearch, mode: 'insensitive' } } } },
      { requestedByUser: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
      { requestedByUser: { email: { contains: normalizedSearch, mode: 'insensitive' } } },
      { team: { captainUser: { name: { contains: normalizedSearch, mode: 'insensitive' } } } },
      { team: { captainUser: { email: { contains: normalizedSearch, mode: 'insensitive' } } } },
    ];
    if (dayStart && nextDay) searchOr.push({ createdAt: { gte: dayStart, lt: nextDay } });
    teamWhere['OR'] = searchOr;
  }

  const [memberRows, teamRows] = await Promise.all([
    type === 'TEAM'
      ? Promise.resolve([])
      : prisma.eventMember.findMany({
        where: memberWhere as any,
        include: {
          user: {
            select: {
              id: true, name: true, email: true, city: true,
              firstNameCyrillic: true, lastNameCyrillic: true, middleNameCyrillic: true,
              firstNameLatin: true, lastNameLatin: true, middleNameLatin: true,
              fullNameCyrillic: true, fullNameLatin: true,
            },
          },
          event: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { assignedAt: 'desc' },
        take: 500,
      }),
    type && type !== 'ALL' && type !== 'TEAM'
      ? Promise.resolve([])
      : prisma.eventTeamChangeRequest.findMany({
        where: teamWhere as any,
        include: {
          requestedByUser: {
            select: {
              id: true, name: true, email: true,
              firstNameCyrillic: true, lastNameCyrillic: true, middleNameCyrillic: true,
              firstNameLatin: true, lastNameLatin: true, middleNameLatin: true,
              fullNameCyrillic: true, fullNameLatin: true,
            },
          },
          team: {
            include: {
              event: { select: { id: true, title: true, slug: true } },
              captainUser: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
  ]);

  const submissionPairs = memberRows.map((item) => ({ eventId: item.eventId, userId: item.userId }));
  const submissions = submissionPairs.length
    ? await prisma.eventRegistrationFormSubmission.findMany({
      where: { OR: submissionPairs },
      select: { eventId: true, userId: true, answersJson: true },
    })
    : [];
  const answersByPair = new Map(submissions.map((item) => [`${item.eventId}:${item.userId}`, item.answersJson]));

  const data = [
    ...memberRows.map((item) => ({
      id: item.id,
      applicationType: item.role,
      userId: item.userId,
      userName: item.user?.name ?? null,
      userEmail: item.user?.email ?? '',
      userCity: item.user?.city ?? null,
      firstNameCyrillic: item.user?.firstNameCyrillic ?? null,
      lastNameCyrillic: item.user?.lastNameCyrillic ?? null,
      middleNameCyrillic: item.user?.middleNameCyrillic ?? null,
      firstNameLatin: item.user?.firstNameLatin ?? null,
      lastNameLatin: item.user?.lastNameLatin ?? null,
      middleNameLatin: item.user?.middleNameLatin ?? null,
      fullNameCyrillic: item.user?.fullNameCyrillic ?? null,
      fullNameLatin: item.user?.fullNameLatin ?? null,
      eventId: item.eventId,
      eventTitle: item.event?.title ?? '',
      eventSlug: item.event?.slug ?? null,
      status: item.status,
      assignedAt: item.assignedAt.toISOString(),
      answers: answersByPair.get(`${item.eventId}:${item.userId}`) ?? null,
      teamId: null,
      teamName: null,
      teamCaptainName: null,
    })),
    ...teamRows.map((item) => ({
      id: item.id,
      applicationType: 'TEAM',
      userId: item.requestedByUserId,
      userName: item.requestedByUser?.name ?? item.team?.captainUser?.name ?? null,
      userEmail: item.requestedByUser?.email ?? item.team?.captainUser?.email ?? '',
      userCity: null,
      firstNameCyrillic: item.requestedByUser?.firstNameCyrillic ?? null,
      lastNameCyrillic: item.requestedByUser?.lastNameCyrillic ?? null,
      middleNameCyrillic: item.requestedByUser?.middleNameCyrillic ?? null,
      firstNameLatin: item.requestedByUser?.firstNameLatin ?? null,
      lastNameLatin: item.requestedByUser?.lastNameLatin ?? null,
      middleNameLatin: item.requestedByUser?.middleNameLatin ?? null,
      fullNameCyrillic: item.requestedByUser?.fullNameCyrillic ?? null,
      fullNameLatin: item.requestedByUser?.fullNameLatin ?? null,
      eventId: item.team?.eventId ?? '',
      eventTitle: item.team?.event?.title ?? '',
      eventSlug: item.team?.event?.slug ?? null,
      status: normalizeTeamRequestStatus(item.status),
      assignedAt: item.createdAt.toISOString(),
      answers: null,
      teamId: item.teamId,
      teamName: item.proposedName || item.team?.name || null,
      teamCaptainName: item.team?.captainUser?.name ?? null,
    })),
  ].sort((a, b) => (new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()));

  res.json({ data, meta: { total: data.length, page: 1, limit: data.length, pages: 1 } });
});
