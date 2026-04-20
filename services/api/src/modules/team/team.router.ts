import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';
import { leaveTeamByCurrentUser } from '../events/teams.service.js';

export const teamRouter = Router();

// POST /api/team/leave
teamRouter.post('/leave', authenticate, async (req, res) => {
  const user = (req as any).user;
  const teamId = String(req.body?.teamId ?? '').trim();

  if (!teamId) {
    res.status(400).json({ error: 'teamId is required' });
    return;
  }

  try {
    await leaveTeamByCurrentUser(teamId, user.id);
    res.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'CANNOT_LEAVE_AS_CAPTAIN') {
      res.status(400).json({ error: 'Captain cannot leave the team', code: 'CANNOT_LEAVE_AS_CAPTAIN' });
      return;
    }
    throw err;
  }
});
