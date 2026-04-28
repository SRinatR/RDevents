import { Router } from 'express';
import { authenticate, optionalAuth } from '../../common/middleware.js';
import { eventQuerySchema, registrationAnswersSchema } from './events.schemas.js';
import {
  applyForVolunteer,
  cancelTeamInvitation,
  approveTeamMember,
  createTeam,
  getTeamSlots,
  getEventBySlug,
  getEventMembership,
  getRegistrationPrecheck,
  getTeamById,
  getTeamsByEvent,
  inviteToTeamByEmail,
  joinTeam,
  joinTeamByCode,
  leaveTeam,
  listEvents,
  RegistrationRequirementsError,
  registerForEvent,
  rejectTeamMember,
  removeTeamMember,
  saveRegistrationAnswers,
  submitTeamForApproval,
  transferTeamCaptain,
  unregisterFromEvent,
  updateTeam,
} from './events.service.js';

export const eventsRouter = Router();

const registrationFlowErrors: Record<string, [number, string]> = {
  EVENT_NOT_FOUND: [404, 'Event not found'],
  EVENT_NOT_AVAILABLE: [400, 'Event is not available for registration'],
  REGISTRATION_NOT_OPEN: [400, 'Registration is not open yet'],
  EVENT_REQUIRES_TEAM: [400, 'This event requires team participation'],
  EVENT_NOT_TEAM_BASED: [400, 'Event is not team-based'],
  TEAM_NOT_FOUND: [404, 'Team not found'],
  TEAM_NOT_ACTIVE: [400, 'Team is not active'],
  TEAM_FULL: [400, 'Team is full'],
  INVALID_JOIN_CODE: [403, 'Invalid join code'],
  EVENT_FULL: [400, 'Event is at full capacity'],
  ALREADY_REGISTERED: [409, 'You are already registered for this event'],
  ALREADY_HAS_PENDING_APPLICATION: [409, 'You already have a pending application for this event'],
  ALREADY_IN_TEAM: [409, 'You are already in a team for this event'],
  PARTICIPANT_APPROVAL_REQUIRED: [403, 'Approved participant status is required before team actions'],
  TEAM_APPROVAL_PENDING: [409, 'Team is waiting for admin approval'],
  TEAM_CHANGE_REQUEST_ALREADY_OPEN: [409, 'Team already has an open change request'],
  TEAM_APPROVED_LOCKED: [409, 'Approved team is locked. Submit a change request to edit it'],
  TEAM_LOCKED_CONTACT_ORGANIZER: [409, 'Team is locked. Contact the organizer or submit a controlled change request'],
  TEAM_SUBMITTED_LOCKED: [409, 'Team is submitted and locked for editing'],
  TEAM_EMPTY: [400, 'Team has no members'],
  TEAM_MIN_SIZE: [400, 'Team does not meet minimum size'],
  TEAM_NOT_FULL: [400, 'Team must be full before submission'],
  TEAM_INVITATIONS_PENDING: [400, 'Team still has pending invitations'],
  TEAM_INVITATIONS_DISABLED: [400, 'Email invitations are not enabled for this event'],
  INVALID_INVITATION_EMAIL: [400, 'Invalid invitation email'],
  INVALID_TEAM_SLOT: [400, 'Invalid team slot'],
  TEAM_SLOT_OCCUPIED: [409, 'Team slot is occupied'],
  CANNOT_INVITE_SELF: [400, 'You cannot invite yourself'],
  INVITATION_ALREADY_EXISTS: [409, 'Invitation already exists'],
  INVITATION_NOT_FOUND: [404, 'Invitation not found'],
  INVITATION_CLOSED: [409, 'Invitation is already closed'],
  INVITATION_EXPIRED: [410, 'Invitation expired'],
  INVITATION_FORBIDDEN: [403, 'Invitation does not belong to this user'],
  DECISION_REASON_REQUIRED: [400, 'Decision reason is required'],
  STALE_CHANGE_REQUEST: [409, 'Team change request is stale and can no longer be approved'],
  USER_NOT_FOUND: [404, 'User not found'],
};

function sendMappedError(res: any, err: any, map: Record<string, [number, string]> = {}) {
  if (err instanceof RegistrationRequirementsError) {
    res.status(422).json({
      error: 'Required registration data is missing',
      code: 'REGISTRATION_REQUIREMENTS_MISSING',
      details: { missingFields: err.missingFields },
    });
    return;
  }

  const [status, message] = map[err.message] ?? registrationFlowErrors[err.message] ?? [500, 'Internal error'];
  res.status(status).json({ error: message, code: err.message });
}

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
  const parsed = registrationAnswersSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await registerForEvent(String(req.params['id']), user.id, parsed.data.answers);
    const statusCode = result.status === 'PENDING' ? 202 : 201;
    res.status(statusCode).json(result);
  } catch (err: any) {
    if (err.code === 'CAPACITY_REACHED') {
      res.status(409).json({
        error: 'Event is at full capacity',
        code: 'CAPACITY_REACHED',
        participantCount: err.participantCount,
        participantTarget: err.participantTarget,
      });
      return;
    }
    sendMappedError(res, err);
  }
});

// POST /api/events/:id/registration/precheck — validates event gates without creating membership
eventsRouter.post('/:id/registration/precheck', authenticate, async (req, res) => {
  const user = (req as any).user;
  const parsed = registrationAnswersSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const precheck = await getRegistrationPrecheck(String(req.params['id']), user.id, parsed.data.answers);
    res.json({ precheck });
  } catch (err: any) {
    sendMappedError(res, err);
  }
});

// PATCH /api/events/:id/registration-answers — saves event-specific form answers before final join
eventsRouter.patch('/:id/registration-answers', authenticate, async (req, res) => {
  const user = (req as any).user;
  const parsed = registrationAnswersSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const answers = await saveRegistrationAnswers(String(req.params['id']), user.id, parsed.data.answers);
    res.json({ answers });
  } catch (err: any) {
    sendMappedError(res, err);
  }
});

// DELETE /api/events/:id/register — cancel current user's participant membership
eventsRouter.delete('/:id/register', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const membership = await unregisterFromEvent(String(req.params['id']), user.id);
    if (membership?.status === 'WITHDRAWAL_REQUEST_CREATED') {
      res.status(202).json(membership);
      return;
    }
    res.json({ membership });
  } catch (err: any) {
    if (err.code === 'CAPTAIN_CANNOT_CANCEL_EVENT_PARTICIPATION') {
      res.status(409).json({
        error: 'сначала передайте капитанство или решите вопрос с командой',
        code: err.code,
      });
      return;
    }
    const map: Record<string, [number, string]> = {
      REGISTRATION_NOT_FOUND: [404, 'Registration not found'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: err.message });
  }
});

// GET /api/events/:id/membership — current user's event-scoped roles and team
eventsRouter.get('/:id/membership', authenticate, async (req, res) => {
  const user = (req as any).user;
  const membership = await getEventMembership(String(req.params['id']), user.id);
  res.json({ membership });
});

async function handleVolunteerApplication(req: any, res: any) {
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
}

// POST /api/events/:id/volunteer/apply — existing URL kept for the web app.
eventsRouter.post('/:id/volunteer/apply', authenticate, handleVolunteerApplication);

// POST /api/events/:id/volunteer-application — URL from the MVP spec.
eventsRouter.post('/:id/volunteer-application', authenticate, handleVolunteerApplication);

// GET /api/events/:id/volunteer-application/me
eventsRouter.get('/:id/volunteer-application/me', authenticate, async (req, res) => {
  const user = (req as any).user;
  const membership = await getEventMembership(String(req.params['id']), user.id);
  const volunteerApplication = membership.memberships.find(item => item.role === 'VOLUNTEER') ?? null;
  res.json({ volunteerApplication });
});

// GET /api/events/:id/teams
eventsRouter.get('/:id/teams', optionalAuth, async (req, res) => {
  const teams = await getTeamsByEvent(String(req.params['id']));
  res.json({ teams });
});

// POST /api/events/:id/teams
eventsRouter.post('/:id/teams', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const team = await createTeam(String(req.params['id']), user.id, req.body);
    res.status(201).json({ team });
  } catch (err: any) {
    sendMappedError(res, err, { EVENT_NOT_AVAILABLE: [400, 'Event is not available for teams'] });
  }
});

// GET /api/events/:id/teams/:teamId/slots
eventsRouter.get('/:id/teams/:teamId/slots', authenticate, async (req, res) => {
  try {
    const slots = await getTeamSlots(String(req.params['teamId']));
    if (slots.team.eventId !== String(req.params['id'])) {
      res.status(404).json({ error: 'Team not found', code: 'TEAM_NOT_FOUND' });
      return;
    }
    res.json(slots);
  } catch (err: any) {
    sendMappedError(res, err);
  }
});

// POST /api/events/:id/teams/:teamId/invitations
eventsRouter.post('/:id/teams/:teamId/invitations', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const invitation = await inviteToTeamByEmail(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id,
      Number(req.body?.slotIndex),
      String(req.body?.email ?? ''),
      typeof req.body?.message === 'string' ? req.body.message : undefined
    );
    res.status(201).json({ invitation });
  } catch (err: any) {
    sendMappedError(res, err, {
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can invite members'],
    });
  }
});

// DELETE /api/events/:id/teams/:teamId/invitations/:invitationId
eventsRouter.delete('/:id/teams/:teamId/invitations/:invitationId', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const invitation = await cancelTeamInvitation(
      String(req.params['id']),
      String(req.params['teamId']),
      String(req.params['invitationId']),
      user.id
    );
    res.json({ ok: true, invitation });
  } catch (err: any) {
    sendMappedError(res, err, {
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can cancel invitations'],
    });
  }
});

// GET /api/events/:id/teams/:teamId
eventsRouter.get('/:id/teams/:teamId', optionalAuth, async (req, res) => {
  try {
    const team = await getTeamById(String(req.params['id']), String(req.params['teamId']));
    res.json({ team });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      TEAM_NOT_FOUND: [404, 'Team not found'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message });
  }
});

// POST /api/events/:id/teams/join-by-code
eventsRouter.post('/:id/teams/join-by-code', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const code = String(req.body?.code ?? '');
    const member = await joinTeamByCode(String(req.params['id']), user.id, code, req.body?.answers);
    res.status(200).json({ member });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_AVAILABLE: [400, 'Event is not available for teams'],
      TEAM_NOT_FOUND: [404, 'Team not found for this code'],
    });
  }
});

// POST /api/events/:id/teams/:teamId/join
eventsRouter.post('/:id/teams/:teamId/join', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const member = await joinTeam(String(req.params['id']), String(req.params['teamId']), user.id, req.body?.code, req.body?.answers);
    res.status(200).json({ member });
  } catch (err: any) {
    sendMappedError(res, err, { EVENT_NOT_AVAILABLE: [400, 'Event is not available for teams'] });
  }
});

// PATCH /api/events/:id/teams/:teamId — update team (captain only)
eventsRouter.patch('/:id/teams/:teamId', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const team = await updateTeam(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id,
      req.body
    );
    res.json({ team });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can update team'],
      TEAM_SUBMITTED_LOCKED: [409, 'Team is submitted and locked for editing'],
    });
  }
});

// POST /api/events/:id/teams/:teamId/submit — captain freezes current team draft and sends it to admin approval
eventsRouter.post('/:id/teams/:teamId/submit', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const team = await submitTeamForApproval(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id
    );
    res.json({ team });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can submit team for approval'],
    });
  }
});

// POST /api/events/:id/teams/:teamId/leave — leave team
eventsRouter.post('/:id/teams/:teamId/leave', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await leaveTeam(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id
    );
    if (result?.status === 'WITHDRAWAL_REQUEST_CREATED') {
      res.status(202).json(result);
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_IN_TEAM: [400, 'You are not in this team'],
      CAPTAIN_CANNOT_LEAVE: [400, 'Captain cannot leave team. Transfer captainship or delete team'],
      TEAM_SUBMITTED_LOCKED: [409, 'Team is submitted and locked for editing'],
      TEAM_CHANGE_REQUEST_ALREADY_OPEN: [409, 'Team already has an open change request'],
    });
  }
});

// POST /api/events/:id/teams/:teamId/members/:userId/approve — approve pending member (captain only)
eventsRouter.post('/:id/teams/:teamId/members/:userId/approve', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const member = await approveTeamMember(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id,
      String(req.params['userId'])
    );
    res.json({ member });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can approve members'],
      MEMBER_NOT_FOUND: [404, 'Team member not found'],
      TEAM_FULL: [400, 'Team is full'],
    });
  }
});

// POST /api/events/:id/teams/:teamId/members/:userId/reject — reject pending member (captain only)
eventsRouter.post('/:id/teams/:teamId/members/:userId/reject', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    await rejectTeamMember(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id,
      String(req.params['userId'])
    );
    res.json({ ok: true });
  } catch (err: any) {
    const map: Record<string, [number, string]> = {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can reject members'],
      MEMBER_NOT_FOUND: [404, 'Team member not found'],
    };
    const [status, message] = map[err.message] ?? [500, 'Internal error'];
    res.status(status).json({ error: message });
  }
});

// DELETE /api/events/:id/teams/:teamId/members/:userId — remove member (captain only)
eventsRouter.delete('/:id/teams/:teamId/members/:userId', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const team = await removeTeamMember(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id,
      String(req.params['userId'])
    );
    res.json({ ok: true, team });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can remove members'],
      MEMBER_NOT_FOUND: [404, 'Team member not found'],
      CANNOT_REMOVE_CAPTAIN: [400, 'Cannot remove team captain'],
      TEAM_APPROVED_LOCKED: [409, 'Approved team is locked. Submit a change request to edit it'],
      TEAM_SUBMITTED_LOCKED: [409, 'Team is submitted and locked for editing'],
    });
  }
});

// POST /api/events/:id/teams/:teamId/members/:userId/transfer-captain — transfer captain role to active member
eventsRouter.post('/:id/teams/:teamId/members/:userId/transfer-captain', authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    const team = await transferTeamCaptain(
      String(req.params['id']),
      String(req.params['teamId']),
      user.id,
      String(req.params['userId'])
    );
    res.json({ ok: true, team });
  } catch (err: any) {
    sendMappedError(res, err, {
      EVENT_NOT_FOUND: [404, 'Event not found'],
      TEAM_NOT_FOUND: [404, 'Team not found'],
      NOT_TEAM_CAPTAIN: [403, 'Only team captain can transfer captain role'],
      MEMBER_NOT_FOUND: [404, 'Team member not found'],
      TARGET_MEMBER_NOT_ACTIVE: [400, 'Captain role can only be transferred to active team member'],
      CANNOT_TRANSFER_TO_SELF: [400, 'Cannot transfer captain role to yourself'],
      TEAM_APPROVED_LOCKED: [409, 'Approved team is locked. Submit a change request to edit it'],
      TEAM_SUBMITTED_LOCKED: [409, 'Team is submitted and locked for editing'],
    });
  }
});
