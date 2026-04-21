import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware.js';
import {
  getUserDashboard,
  setActiveEvent,
  getEventWorkspace,
} from './dashboard.service.js';

export const dashboardRouter = Router();

const setActiveEventSchema = z.object({
  eventId: z.string().nullable(),
});

dashboardRouter.get('/', authenticate, async (req, res) => {
  const user = (req as any).user;
  const dashboard = await getUserDashboard(user.id);
  res.json(dashboard);
});

dashboardRouter.patch('/active-event', authenticate, async (req, res) => {
  const user = (req as any).user;
  const parsed = setActiveEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await setActiveEvent(user.id, parsed.data.eventId);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'EVENT_NOT_FOUND_OR_NOT_MEMBER') {
      res.status(404).json({ error: 'Event not found or you are not a member' });
      return;
    }
    res.status(500).json({ error: 'Internal error' });
  }
});

dashboardRouter.get('/events/:id/workspace', authenticate, async (req, res) => {
  const user = (req as any).user;
  const eventId = String(req.params['id']);

  try {
    const workspace = await getEventWorkspace(user.id, eventId);
    if (!workspace) {
      res.status(404).json({ error: 'Event not found', code: 'EVENT_NOT_FOUND' });
      return;
    }
    res.json(workspace);
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
