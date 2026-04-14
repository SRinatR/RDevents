import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';
import { getMyEvents, getMyTeams, getMyVolunteerApplications } from '../events/events.service.js';

export const registrationsRouter = Router();

// GET /api/me/events — list current user's event registrations
registrationsRouter.get('/events', authenticate, async (req, res) => {
  const user = (req as any).user;
  const events = await getMyEvents(user.id);
  res.json({ events });
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
