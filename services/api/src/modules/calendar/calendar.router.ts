import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { User } from '@prisma/client';
import {
  getPublicCalendarEvents,
  getAdminCalendarEvents,
  generateICSContent,
} from './calendar.service.js';

export const calendarRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

const calendarQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
});

async function getManagedEventIds(user: User): Promise<string[] | null> {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;

  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });

  return memberships.map(m => m.eventId);
}

// GET /api/events/calendar — public calendar feed
calendarRouter.get('/', async (req, res) => {
  const parsed = calendarQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }

  const events = await getPublicCalendarEvents(parsed.data);
  res.json({ data: events });
});

// GET /api/events/:slug/ics — ICS export for event
calendarRouter.get('/:slug/ics', async (req, res) => {
  const { slug } = req.params;

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      location: true,
      startsAt: true,
      endsAt: true,
      registrationDeadline: true,
    },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const icsContent = generateICSContent(event, {
    includeDeadline: true,
    includeMilestones: false,
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${event.slug}.ics"`);
  res.send(icsContent);
});

// GET /api/admin/calendar — admin calendar feed
calendarRouter.get('/', async (req, res) => {
  const user = (req as any).user as User;

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds !== null && managedEventIds.length === 0) {
    res.json({ data: [] });
    return;
  }

  const parsed = calendarQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }

  const events = await getAdminCalendarEvents(managedEventIds, parsed.data);
  res.json({ data: events });
});

// GET /api/admin/events/:id/ics — ICS export for event (admin)
calendarRouter.get('/events/:id/ics', async (req, res) => {
  const user = (req as any).user as User;
  const { id } = req.params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      location: true,
      startsAt: true,
      endsAt: true,
      registrationDeadline: true,
    },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(id)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const milestones = await prisma.eventMilestone.findMany({
    where: { eventId: id },
    orderBy: { occursAt: 'asc' },
  });

  let icsContent = generateICSContent(event, {
    includeDeadline: true,
    includeMilestones: true,
  });

  if (milestones.length > 0) {
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const now = formatDate(new Date());
    const uid = `${event.slug}@rdevents.uz`;

    const milestoneEvents = milestones.map(m => [
      'BEGIN:VEVENT',
      `UID:${uid}-milestone-${m.id}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatDate(m.occursAt)}`,
      `DTEND:${formatDate(m.occursAt)}`,
      `SUMMARY:${escapeICS(m.title)}`,
      m.description ? `DESCRIPTION:${escapeICS(m.description)}` : '',
      `LOCATION:${escapeICS(event.location)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n')).join('\r\n');

    icsContent = icsContent.replace('END:VCALENDAR', `${milestoneEvents}\r\nEND:VCALENDAR`);
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${event.slug}.ics"`);
  res.send(icsContent);
});

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
