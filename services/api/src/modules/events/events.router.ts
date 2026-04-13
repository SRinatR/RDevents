import { Router } from 'express';
import { authenticate, optionalAuth } from '../../common/middleware.js';
import { eventQuerySchema } from './events.schemas.js';
import { applyForVolunteer, listEvents, getEventBySlug, registerForEvent } from './events.service.js';

export const eventsRouter = Router();

// GET /api/events
eventsRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = eventQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const userId = (req as any).user?.id;
  const result = await listEvents(parsed.data, userId);
  res.json(result);
});

// GET /api/events/:slug
eventsRouter.get('/:slug', optionalAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const event = await getEventBySlug(String(req.params['slug']), userId);
  if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
  res.json({ event });
});

// POST /api/events/:id/register — requires auth
eventsRouter.post('/:id/register', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const registration = await registerForEvent(String(req.params['id']), user.id);
    res.status(201).json({ registration });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      EVENT_NOT_AVAILABLE: [400, 'Event is not available for registration'],
      EVENT_FULL: [400, 'Event is at full capacity'],
      ALREADY_REGISTERED: [409, 'You are already registered for this event'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message });
  }
});

// POST /api/events/:id/volunteer/apply — user applies to volunteer for this event
eventsRouter.post('/:id/volunteer/apply', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const membership = await applyForVolunteer(String(req.params['id']), user.id, req.body?.notes);
    res.status(201).json({ membership });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      EVENT_NOT_AVAILABLE: [400, 'Event is not accepting volunteer applications'],
      VOLUNTEER_APPLICATION_EXISTS: [409, 'Volunteer application already exists for this event'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message });
  }
});

// GET /api/events/:id/teams
eventsRouter.get('/:id/teams', optionalAuth, async (req, res) => {
  const teams = await import('./events.service.js').then(m => m.getTeamsByEvent(String(req.params['id'])));
  res.json({ teams });
});

// POST /api/events/:id/teams
eventsRouter.post('/:id/teams', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const team = await import('./events.service.js').then(m => m.createTeam(String(req.params['id']), user.id, req.body));
    res.status(201).json({ team });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      EVENT_NOT_TEAM_BASED: [400, 'Event is not team-based'],
      ALREADY_IN_TEAM: [409, 'You are already in a team for this event'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message });
  }
});

// POST /api/events/:id/teams/:teamId/join
eventsRouter.post('/:id/teams/:teamId/join', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const member = await import('./events.service.js').then(m => m.joinTeam(String(req.params['id']), String(req.params['teamId']), user.id, req.body?.code));
    res.status(200).json({ member });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      TEAM_NOT_ACTIVE: [400, 'Team is not active'],
      TEAM_FULL: [400, 'Team is full'],
      INVALID_JOIN_CODE: [403, 'Invalid join code'],
      ALREADY_IN_TEAM: [409, 'You are already in a team for this event'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message });
  }
});
