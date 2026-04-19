import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';
import {
  getMyEventWorkspace,
  getMyEvents,
  getMyParticipantApplications,
  getMyTeams,
  getMyVolunteerApplications,
} from '../events/events.service.js';

export const registrationsRouter = Router();

// GET /api/me/events — list current user's event registrations
registrationsRouter.get('/events', authenticate, async (req, res) => {
  const user = (req as any).user;
  const events = await getMyEvents(user.id);
  res.json({ events });
});

// GET /api/me/applications — list current user's participant applications and statuses
registrationsRouter.get('/applications', authenticate, async (req, res) => {
  const user = (req as any).user;
  const applications = await getMyParticipantApplications(user.id);
  res.json({ applications });
});

// GET /api/me/events/:slug/workspace — active participant-only event workspace
registrationsRouter.get('/events/:slug/workspace', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const event = await getMyEventWorkspace(user.id, String(req.params['slug']));
    if (!event) {
      res.status(404).json({ error: 'Event not found', code: 'EVENT_NOT_FOUND' });
      return;
    }
    res.json({ event });
  } catch (err: any) {
    if (err.message === 'EVENT_WORKSPACE_FORBIDDEN') {
      res.status(403).json({
        error: 'Event workspace is available only after participant approval',
        code: 'EVENT_WORKSPACE_FORBIDDEN',
      });
      return;
    }
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/me/teams — current user's team memberships across events
registrationsRouter.get('/teams', authenticate, async (req, res) => {
  const user = (req as any).user;
  const teams = await getMyTeams(user.id);
  res.json({ teams });
});

// GET /api/me/volunteer-applications — current user's volunteer applications
registrationsRouter.get('/volunteer-applications', authenticate, async (req, res) => {
  const user = (req as any).user;
  const applications = await getMyVolunteerApplications(user.id);
  res.json({ applications });
});
