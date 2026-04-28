import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middleware.js';
import { env } from '../../config/env.js';
import { eventGalleryQuerySchema, eventGalleryUploadSchema } from '../events/events.schemas.js';
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
import {
  createParticipantEventGalleryAsset,
  deleteParticipantEventGalleryAsset,
  EventGalleryError,
  listMyEventGalleryWorkspace,
} from '../events/event-gallery.service.js';

export const registrationsRouter = Router();
const galleryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(env.MAX_EVENT_GALLERY_PHOTO_MB, env.MAX_EVENT_GALLERY_VIDEO_MB) * 1024 * 1024,
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

// GET /api/me/events/:slug/gallery — approved event photobank plus the current user's submissions
registrationsRouter.get('/events/:slug/gallery', authenticate, async (req, res) => {
  const user = (req as any).user;
  const parsed = eventGalleryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  try {
    const gallery = await listMyEventGalleryWorkspace(user.id, String(req.params['slug']), parsed.data);
    res.json(gallery);
  } catch (err: any) {
    if (err instanceof EventGalleryError) {
      if (err.message === 'EVENT_NOT_FOUND') {
        res.status(404).json({ error: 'Event not found', code: err.message });
        return;
      }
      if (err.message === 'EVENT_GALLERY_FORBIDDEN') {
        res.status(403).json({
          error: 'Event gallery is available only for approved participants',
          code: err.message,
        });
        return;
      }
    }

    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/me/events/:slug/gallery — participant upload, stored as pending moderation
registrationsRouter.post('/events/:slug/gallery', authenticate, galleryUpload.single('file'), async (req, res) => {
  const user = (req as any).user;
  const parsed = eventGalleryUploadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'File is required', code: 'EVENT_GALLERY_FILE_REQUIRED' });
    return;
  }

  try {
    const result = await createParticipantEventGalleryAsset(
      user.id,
      String(req.params['slug']),
      req.file,
      parsed.data.caption,
    );
    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof EventGalleryError) {
      if (err.message === 'EVENT_NOT_FOUND') {
        res.status(404).json({ error: 'Event not found', code: err.message });
        return;
      }
      if (err.message === 'EVENT_GALLERY_FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden', code: err.message });
        return;
      }
      if (err.message === 'EVENT_GALLERY_FILE_EMPTY') {
        res.status(400).json({ error: 'File is empty', code: err.message });
        return;
      }
      if (err.message === 'EVENT_GALLERY_FILE_TYPE_NOT_ALLOWED') {
        res.status(400).json({ error: 'Accepted formats: JPG, PNG, WebP, MP4, WebM, MOV', code: err.message });
        return;
      }
      if (err.message === 'EVENT_GALLERY_FILE_TOO_LARGE') {
        res.status(400).json({
          error: `Photo files must be ${env.MAX_EVENT_GALLERY_PHOTO_MB} MB or smaller, videos must be ${env.MAX_EVENT_GALLERY_VIDEO_MB} MB or smaller`,
          code: err.message,
        });
        return;
      }
    }

    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/me/events/:slug/gallery/:assetId — remove the current user's gallery upload
registrationsRouter.delete('/events/:slug/gallery/:assetId', authenticate, async (req, res) => {
  const user = (req as any).user;

  try {
    const result = await deleteParticipantEventGalleryAsset(
      user.id,
      String(req.params['slug']),
      String(req.params['assetId']),
    );
    res.json(result);
  } catch (err: any) {
    if (err instanceof EventGalleryError) {
      if (err.message === 'EVENT_NOT_FOUND' || err.message === 'EVENT_GALLERY_ASSET_NOT_FOUND') {
        res.status(404).json({ error: 'Gallery item not found', code: err.message });
        return;
      }
      if (err.message === 'EVENT_GALLERY_FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden', code: err.message });
        return;
      }
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
