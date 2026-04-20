import { prisma } from '../../db/prisma.js';

export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: string;
  category: string;
  registrationDeadline: string | null;
  milestones: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    occursAt: string;
  }>;
}

export interface CalendarQuery {
  start?: string;
  end?: string;
  category?: string;
  status?: string;
}

export async function getPublicCalendarEvents(query: CalendarQuery) {
  const where: Record<string, unknown> = {
    status: 'PUBLISHED',
  };

  if (query.start) {
    where['startsAt'] = { gte: new Date(query.start) };
  }

  if (query.end) {
    where['endsAt'] = { lte: new Date(query.end) };
  }

  if (query.category) {
    where['category'] = query.category;
  }

  if (query.status) {
    where['status'] = query.status;
  }

  const events = await prisma.event.findMany({
    where: where as any,
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      location: true,
      startsAt: true,
      endsAt: true,
      status: true,
      category: true,
      registrationDeadline: true,
      coverImageUrl: true,
      milestones: {
        orderBy: { occursAt: 'asc' },
      },
    },
    orderBy: { startsAt: 'asc' },
  });

  return events.map(event => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.shortDescription,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: event.status,
    category: event.category,
    registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
    coverImageUrl: event.coverImageUrl,
    milestones: event.milestones.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      description: m.description,
      occursAt: m.occursAt.toISOString(),
    })),
  }));
}

export async function getAdminCalendarEvents(
  managedEventIds: string[] | null,
  query: CalendarQuery
) {
  const where: Record<string, unknown> = {};

  if (managedEventIds) {
    where['id'] = { in: managedEventIds };
  }

  if (query.start) {
    where['startsAt'] = { gte: new Date(query.start) };
  }

  if (query.end) {
    where['endsAt'] = { lte: new Date(query.end) };
  }

  if (query.category) {
    where['category'] = query.category;
  }

  if (query.status) {
    where['status'] = query.status;
  }

  const events = await prisma.event.findMany({
    where: where as any,
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      location: true,
      startsAt: true,
      endsAt: true,
      status: true,
      category: true,
      registrationDeadline: true,
      registrationOpensAt: true,
      capacity: true,
      registrationsCount: true,
      coverImageUrl: true,
      milestones: {
        orderBy: { occursAt: 'asc' },
      },
    },
    orderBy: { startsAt: 'asc' },
  });

  return events.map(event => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.shortDescription,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: event.status,
    category: event.category,
    registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
    registrationOpensAt: event.registrationOpensAt?.toISOString() ?? null,
    capacity: event.capacity,
    registrationsCount: event.registrationsCount,
    coverImageUrl: event.coverImageUrl,
    milestones: event.milestones.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      description: m.description,
      occursAt: m.occursAt.toISOString(),
    })),
  }));
}

export function generateICSContent(
  event: {
    id: string;
    slug: string;
    title: string;
    description?: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    registrationDeadline?: Date | null;
  },
  options: {
    includeDeadline?: boolean;
    includeMilestones?: boolean;
  } = {}
): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const uid = `${event.slug}@rdevents.uz`;
  const dtstart = formatDate(event.startsAt);
  const dtend = formatDate(event.endsAt);
  const now = formatDate(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RDEvents//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
    `URL:https://rdevents.uz/events/${event.slug}`,
    `CATEGORIES:${event.slug}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ];

  if (options.includeDeadline && event.registrationDeadline) {
    const dtstamp = formatDate(event.registrationDeadline);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}-deadline`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstamp}`,
      `DTEND:${dtstamp}`,
      `SUMMARY:Registration Deadline: ${escapeICS(event.title)}`,
      `DESCRIPTION:Last day to register for ${escapeICS(event.title)}`,
      `LOCATION:${escapeICS(event.location)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
