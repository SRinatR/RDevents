import type { User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const ACTIVE_LEGACY_EVENT_ADMIN_STATUSES = ['ACTIVE'] as const;

export async function canManageEventLegacy(user: User, eventId: string): Promise<boolean> {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;

  const membership = await prisma.eventMember.findFirst({
    where: {
      eventId,
      userId: user.id,
      role: 'EVENT_ADMIN',
      status: { in: [...ACTIVE_LEGACY_EVENT_ADMIN_STATUSES] },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function getLegacyManagedEventIds(user: User): Promise<string[]> {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    const events = await prisma.event.findMany({ select: { id: true } });
    return events.map(event => event.id);
  }

  const memberships = await prisma.eventMember.findMany({
    where: {
      userId: user.id,
      role: 'EVENT_ADMIN',
      status: { in: [...ACTIVE_LEGACY_EVENT_ADMIN_STATUSES] },
    },
    select: { eventId: true },
  });

  return memberships.map(membership => membership.eventId);
}
