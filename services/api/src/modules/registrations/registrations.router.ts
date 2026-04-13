import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';
import { getMyEvents } from '../events/events.service.js';

export const registrationsRouter = Router();

// GET /api/me/events — list current user's event registrations
registrationsRouter.get('/events', authenticate, async (req, res) => {
  const user = (req as any).user;
  const events = await getMyEvents(user.id);
  res.json({ events });
});
