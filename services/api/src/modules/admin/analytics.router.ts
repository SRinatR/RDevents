import { Router } from 'express';
import type { User } from '@prisma/client';
import { requirePlatformAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

export const adminAnalyticsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

// GET /admin/volunteers
adminAnalyticsRouter.get('/volunteers', requirePlatformAdmin, async (_req, res) => {
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

// GET /admin/analytics
adminAnalyticsRouter.get('/', requirePlatformAdmin, async (_req, res) => {
  const [
    totalUsers,
    totalEvents,
    totalRegistrations,
    totalViews,
    volunteersPending,
    registrationsByProvider,
    loginsByProvider,
    topViewedRaw,
    topRegisteredEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.count({ where: { status: 'PUBLISHED' } }),
    prisma.eventMember.count({ where: { role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } } }),
    prisma.analyticsEvent.count({ where: { type: 'EVENT_DETAIL_VIEW' } }),
    prisma.eventMember.count({ where: { role: 'VOLUNTEER', status: 'PENDING' } }),
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
      const event = topViewedEventDetailsById.get(row.eventId as string);
      if (!event) return null;
      const e = event as { id: string; slug: string; title: string; category: string; registrationsCount: number };
      return {
        eventId: e.id,
        slug: e.slug,
        title: e.title,
        category: e.category,
        registrationsCount: e.registrationsCount,
        viewCount: (row as any)._count,
      };
    })
    .filter(Boolean);

  const providerCounts = (rows: { authProvider: string | null; _count: number }[]) =>
    Object.fromEntries(rows.map(row => [row.authProvider ?? 'UNKNOWN', row._count]));

  res.json({
    totalUsers,
    totalEvents,
    totalRegistrations,
    volunteersPending,
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
