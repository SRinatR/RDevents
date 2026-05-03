import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middleware.js';
import {
  EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB,
  EventMediaUploadError,
  listMyEventMedia,
  uploadEventMedia,
} from '../events/event-media.service.js';
import {
  acceptTeamInvitation,
  declineTeamInvitation,
  getMyEventWorkspace,
  getMyEvents,
  getMyParticipantApplications,
  getMyTeams,
  getMyVolunteerApplications,
  listMyTeamInvitations,
  RegistrationRequirementsError,
} from '../events/events.service.js';

export const registrationsRouter = Router();

const eventMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

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

// GET /api/me/events/:eventId/media — current user's submissions for an event
registrationsRouter.get('/events/:eventId/media', authenticate, async (req, res) => {
  const user = (req as any).user;
  const media = await listMyEventMedia(String(req.params['eventId']), user);
  res.json({ media });
});

// POST /api/me/events/:eventId/media — participant photo/video submission
registrationsRouter.post('/events/:eventId/media', authenticate, eventMediaUpload.single('file'), async (req, res) => {
  const user = (req as any).user;
  const file = (req as any).file as Express.Multer.File | undefined;

  try {
    const media = await uploadEventMedia(String(req.params['eventId']), user, file as Express.Multer.File, req.body ?? {}, { mode: 'participant' });
    res.status(media.status === 'APPROVED' ? 201 : 202).json({ media });
  } catch (err: any) {
    if (err instanceof EventMediaUploadError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    const map: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      EVENT_MEDIA_UPLOAD_FORBIDDEN: [403, 'Only approved event participants can upload media'],
      EVENT_MEDIA_UPLOAD_DISABLED: [403, 'Media upload is disabled for this event'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: err.message });
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

// GET /api/me/team-invitations — current user's team invitation inbox and history
registrationsRouter.get('/team-invitations', authenticate, async (req, res) => {
  const user = (req as any).user;
  const invitations = await listMyTeamInvitations(user.id);
  res.json({ invitations });
});

// POST /api/me/team-invitations/:invitationId/accept
registrationsRouter.post('/team-invitations/:invitationId/accept', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await acceptTeamInvitation(String(req.params['invitationId']), user.id);
    res.json(result);
  } catch (err: any) {
    if (err instanceof RegistrationRequirementsError) {
      res.status(422).json({
        error: 'Required registration data is missing',
        code: 'REGISTRATION_REQUIREMENTS_MISSING',
        details: { missingFields: err.missingFields },
      });
      return;
    }

    const map: Record<string, [number, string]> = {
      INVITATION_NOT_FOUND: [404, 'Invitation not found'],
      INVITATION_FORBIDDEN: [403, 'Invitation does not belong to this user'],
      INVITATION_CLOSED: [409, 'Invitation is already closed'],
      INVITATION_EXPIRED: [410, 'Invitation expired'],
      PARTICIPANT_APPROVAL_REQUIRED: [403, 'Approved participant status is required before accepting team invitations'],
      ALREADY_IN_TEAM: [409, 'You are already in a team for this event'],
      TEAM_SLOT_OCCUPIED: [409, 'Team slot is occupied'],
      TEAM_FULL: [400, 'Team is full'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: err.message });
  }
});

// POST /api/me/team-invitations/:invitationId/decline
registrationsRouter.post('/team-invitations/:invitationId/decline', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const invitation = await declineTeamInvitation(String(req.params['invitationId']), user.id);
    res.json({ invitation });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      INVITATION_NOT_FOUND: [404, 'Invitation not found'],
      INVITATION_FORBIDDEN: [403, 'Invitation does not belong to this user'],
      INVITATION_CLOSED: [409, 'Invitation is already closed'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: err.message });
  }
});
