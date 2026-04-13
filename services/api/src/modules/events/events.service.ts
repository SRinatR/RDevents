import { prisma } from '../../db/prisma.js';
import type { EventQuery } from './events.schemas.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE', 'APPROVED'] as const;

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
  }

  return { ...event, isRegistered, membershipRoles, memberships };
}

export async function registerForEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');

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

    const membership = existing
      ? await tx.eventMember.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            assignedByUserId: userId,
            assignedAt: new Date(),
            approvedAt: new Date(),
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

    return membership;
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
    return prisma.eventMember.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        notes: notes ?? null,
        assignedByUserId: userId,
        assignedAt: new Date(),
        approvedAt: null,
      },
    });
  }

  return prisma.eventMember.create({
    data: {
      eventId,
      userId,
      role: 'VOLUNTEER',
      status: 'PENDING',
      notes: notes ?? null,
      assignedByUserId: userId,
    },
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
