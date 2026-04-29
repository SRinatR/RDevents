import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { sendEventNotificationEmailSafe } from '../../common/email.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import { assertRegistrationRequirements, registerForEvent } from './registration.service.js';
import { notifyTeamMemberChanged, notifyTeamUpdated } from './notifications.service.js';
import { getTeamCabinetPermissions, getTeamSubmissionState } from './teams.service.js';
import { normalizeEmail } from '@event-platform/shared';
import {
  isTeamApprovedStatus,
  LIVE_TEAM_MEMBER_STATUSES,
  OPEN_CHANGE_REQUEST_STATUSES,
  TEAM_STATUSES_EDITABLE_BY_CAPTAIN,
} from './team-governance.js';
import { assertRegistrationGateOpen } from './registration-gates.js';

const OPEN_INVITATION_STATUSES = ['PENDING_ACCOUNT', 'PENDING_RESPONSE'] as const;
const OCCUPIED_INVITATION_STATUSES = ['PENDING_ACCOUNT', 'PENDING_RESPONSE', 'ACCEPTED'] as const;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isOpenInvitation(status: string) {
  return (OPEN_INVITATION_STATUSES as readonly string[]).includes(status);
}

function assertTeamEditableForInvites(team: { status: string; event: { requireAdminApprovalForTeams: boolean } }) {
  if (team.status === 'ARCHIVED') throw new Error('TEAM_NOT_ACTIVE');
  if (team.event.requireAdminApprovalForTeams && !TEAM_STATUSES_EDITABLE_BY_CAPTAIN.includes(team.status as any)) {
    if (team.status === 'PENDING' || team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION') throw new Error('TEAM_APPROVAL_PENDING');
    throw new Error('TEAM_APPROVED_LOCKED');
  }
}

async function sendInvitationEmail(invitation: any, team: any, event: any) {
  const origin = (env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0]?.trim() || 'http://localhost:3000';
  const actionUrl = `${origin.replace(/\/$/, '')}/ru/cabinet/events/${event.slug}`;
  await sendEventNotificationEmailSafe({
    to: invitation.inviteeEmail,
    subject: `RDEvents: приглашение в команду "${team.name}"`,
    title: `Вас пригласили в команду "${team.name}"`,
    body: [
      `Мероприятие: ${event.title}`,
      'Войдите или зарегистрируйтесь с этим email, чтобы принять или отклонить приглашение.',
    ],
    actionUrl,
    actionLabel: 'Открыть приглашение',
  }, { eventId: event.id, userId: invitation.inviteeUserId ?? undefined, action: 'team_invitation_email' });
}

async function findInvitationForUser(invitationId: string, userId: string) {
  const [invitation, user] = await Promise.all([
    prisma.eventTeamInvitation.findUnique({
      where: { id: invitationId },
      include: {
        event: true,
        team: true,
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
  ]);

  if (!invitation) throw new Error('INVITATION_NOT_FOUND');
  if (!user) throw new Error('USER_NOT_FOUND');

  const userEmail = normalizeEmail(user.email);
  const inviteEmail = normalizeEmail(invitation.inviteeEmail);
  const belongsToUser = invitation.inviteeUserId === userId || inviteEmail === userEmail;
  if (!belongsToUser) throw new Error('INVITATION_FORBIDDEN');

  return { invitation, user };
}

async function ensureActiveParticipant(event: any, userId: string) {
  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId: event.id, userId, role: 'PARTICIPANT' } },
  });

  if (existing?.status === 'ACTIVE') return existing;
  if (event.requireParticipantApproval) throw new Error('PARTICIPANT_APPROVAL_REQUIRED');

  try {
    await registerForEvent(event.id, userId, {});
  } catch (error: any) {
    if (error.message !== 'ALREADY_REGISTERED' && error.message !== 'ALREADY_HAS_PENDING_APPLICATION') {
      throw error;
    }

    if (error.message === 'ALREADY_HAS_PENDING_APPLICATION') {
      await assertRegistrationRequirements(event.id, userId, {}, { allowExistingParticipant: true });
      await prisma.$transaction(async (tx: any) => {
        const current = await tx.eventMember.findUnique({
          where: { eventId_userId_role: { eventId: event.id, userId, role: 'PARTICIPANT' } },
        });
        const shouldIncrement = !current || current.status !== 'ACTIVE';
        if (current) {
          await tx.eventMember.update({
            where: { id: current.id },
            data: {
              status: 'ACTIVE',
              assignedAt: new Date(),
              approvedAt: new Date(),
              rejectedAt: null,
              removedAt: null,
            },
          });
        }
        if (shouldIncrement) {
          await tx.event.update({ where: { id: event.id }, data: { registrationsCount: { increment: 1 } } });
        }
      });
    }
  }

  return prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId: event.id, userId, role: 'PARTICIPANT' } },
  });
}

export async function bindPendingInvitationsToUser(userId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { count: 0 };

  const result = await prisma.eventTeamInvitation.updateMany({
    where: {
      inviteeEmail: normalizedEmail,
      inviteeUserId: null,
      status: 'PENDING_ACCOUNT',
    },
    data: {
      inviteeUserId: userId,
      status: 'PENDING_RESPONSE',
    },
  });

  return { count: result.count };
}

export async function listMyTeamInvitations(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email) await bindPendingInvitationsToUser(userId, user.email);

  return prisma.eventTeamInvitation.findMany({
    where: { inviteeUserId: userId },
    include: {
      event: { select: { 
        id: true, slug: true, title: true, coverImageUrl: true, startsAt: true, endsAt: true,
        registrationEnabled: true, registrationOpensAt: true, registrationDeadline: true,
        participantLimitMode: true, participantTarget: true, capacity: true, registrationsCount: true,
      } },
      team: { select: { id: true, name: true, status: true, captainUserId: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function inviteToTeamByEmail(
  eventId: string,
  teamId: string,
  captainUserId: string,
  slotIndex: number,
  email: string,
  message?: string
) {
  const inviteeEmail = normalizeEmail(email);
  if (!isValidEmail(inviteeEmail)) throw new Error('INVALID_INVITATION_EMAIL');

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: true,
      members: {
        where: { status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } },
        include: { user: { select: { id: true, email: true } } },
      },
      invitations: {
        where: { status: { in: [...OCCUPIED_INVITATION_STATUSES] } },
      },
    },
  });

  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!team.event.isTeamBased) throw new Error('EVENT_NOT_TEAM_BASED');
  assertRegistrationGateOpen(team.event);
  if (team.event.teamJoinMode !== 'EMAIL_INVITE') throw new Error('TEAM_INVITATIONS_DISABLED');
  if (team.captainUserId !== captainUserId) throw new Error('NOT_TEAM_CAPTAIN');
  assertTeamEditableForInvites(team);
  if (!Number.isInteger(slotIndex) || slotIndex < 2 || slotIndex > team.maxSize) throw new Error('INVALID_TEAM_SLOT');
  if (team.members.length >= team.maxSize) throw new Error('TEAM_FULL');

  const captain = await prisma.user.findUnique({ where: { id: captainUserId }, select: { email: true } });
  if (normalizeEmail(captain?.email) === inviteeEmail) throw new Error('CANNOT_INVITE_SELF');

  if (team.members.some(member => normalizeEmail(member.user.email) === inviteeEmail)) {
    throw new Error('ALREADY_IN_TEAM');
  }

  if (team.invitations.some(invitation => invitation.slotIndex === slotIndex)) {
    throw new Error('TEAM_SLOT_OCCUPIED');
  }

  if (team.invitations.some(invitation => normalizeEmail(invitation.inviteeEmail) === inviteeEmail && isOpenInvitation(invitation.status))) {
    throw new Error('INVITATION_ALREADY_EXISTS');
  }

  const invitee = await prisma.user.findUnique({ where: { email: inviteeEmail }, select: { id: true, email: true } });
  if (invitee) {
    const existingEventTeam = await prisma.eventTeamMember.findFirst({
      where: {
        userId: invitee.id,
        team: { eventId },
        status: { in: [...LIVE_TEAM_MEMBER_STATUSES] },
      },
      select: { id: true },
    });
    if (existingEventTeam) throw new Error('ALREADY_IN_TEAM');
  }

  const invitation = await prisma.$transaction(async (tx: any) => {
    const created = await tx.eventTeamInvitation.create({
      data: {
        eventId,
        teamId,
        slotIndex,
        inviteeEmail,
        inviteeUserId: invitee?.id ?? null,
        invitedByUserId: captainUserId,
        status: invitee ? 'PENDING_RESPONSE' : 'PENDING_ACCOUNT',
        message: message?.trim() || null,
      },
      include: {
        event: { select: { id: true, slug: true, title: true } },
        team: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_JOIN_REQUESTED',
      userId: invitee?.id ?? captainUserId,
      eventId,
      meta: { teamId, invitationId: created.id, slotIndex, mode: 'EMAIL_INVITE' },
    });

    return created;
  });

  await sendInvitationEmail(invitation, team, team.event);
  await notifyTeamUpdated(eventId, teamId);
  return invitation;
}

export async function acceptTeamInvitation(invitationId: string, userId: string) {
  const { invitation, user } = await findInvitationForUser(invitationId, userId);
  if (!isOpenInvitation(invitation.status)) throw new Error('INVITATION_CLOSED');
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await prisma.eventTeamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    });
    throw new Error('INVITATION_EXPIRED');
  }

  const team = await prisma.eventTeam.findUnique({
    where: { id: invitation.teamId },
    include: {
      event: true,
      members: {
        where: { status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } },
        select: { id: true, userId: true },
      },
      invitations: {
        where: { status: { in: [...OCCUPIED_INVITATION_STATUSES] } },
        select: { id: true, slotIndex: true, status: true },
      },
    },
  });

  if (!team || team.eventId !== invitation.eventId) throw new Error('TEAM_NOT_FOUND');

  assertRegistrationGateOpen(team.event);

  if (team.status === 'ARCHIVED') throw new Error('TEAM_NOT_ACTIVE');
  if (team.event.requireAdminApprovalForTeams && (isTeamApprovedStatus(team.status) || team.status === 'SUBMITTED' || team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION')) {
    throw new Error('TEAM_LOCKED_CONTACT_ORGANIZER');
  }
  if (team.members.some(member => member.userId !== userId) && team.members.length >= team.maxSize) throw new Error('TEAM_FULL');

  const otherTeamMember = await prisma.eventTeamMember.findFirst({
    where: {
      userId,
      team: { eventId: invitation.eventId },
      status: { in: [...LIVE_TEAM_MEMBER_STATUSES] },
      NOT: { teamId: invitation.teamId },
    },
    select: { id: true },
  });
  if (otherTeamMember) throw new Error('ALREADY_IN_TEAM');

  const occupiedSlot = team.invitations.find(item => item.slotIndex === invitation.slotIndex && item.id !== invitation.id);
  if (occupiedSlot) throw new Error('TEAM_SLOT_OCCUPIED');

  await ensureActiveParticipant(team.event, userId);

  const updated = await prisma.$transaction(async (tx: any) => {
    const member = await tx.eventTeamMember.upsert({
      where: { teamId_userId: { teamId: invitation.teamId, userId } },
      create: {
        teamId: invitation.teamId,
        userId,
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      update: {
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
        removedAt: null,
      },
    });

    const accepted = await tx.eventTeamInvitation.update({
      where: { id: invitation.id },
      data: {
        inviteeUserId: user.id,
        status: 'ACCEPTED',
        respondedAt: new Date(),
        acceptedAt: new Date(),
      },
      include: {
        event: { select: { id: true, slug: true, title: true } },
        team: { select: { id: true, name: true, status: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_MEMBER_APPROVED',
      userId,
      eventId: invitation.eventId,
      meta: { teamId: invitation.teamId, invitationId: invitation.id, source: 'EMAIL_INVITE' },
    });

    return { invitation: accepted, member };
  });

  await notifyTeamMemberChanged(invitation.eventId, invitation.teamId, userId, 'ACTIVE');
  return updated;
}

export async function declineTeamInvitation(invitationId: string, userId: string) {
  const { invitation, user } = await findInvitationForUser(invitationId, userId);
  if (!isOpenInvitation(invitation.status)) throw new Error('INVITATION_CLOSED');

  const declined = await prisma.eventTeamInvitation.update({
    where: { id: invitation.id },
    data: {
      inviteeUserId: user.id,
      status: 'DECLINED',
      respondedAt: new Date(),
      declinedAt: new Date(),
    },
    include: {
      event: { select: { id: true, slug: true, title: true } },
      team: { select: { id: true, name: true, status: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await notifyTeamUpdated(invitation.eventId, invitation.teamId);
  return declined;
}

export async function cancelTeamInvitation(eventId: string, teamId: string, invitationId: string, captainUserId: string) {
  const invitation = await prisma.eventTeamInvitation.findUnique({
    where: { id: invitationId },
    include: { team: { include: { event: true } } },
  });
  if (!invitation || invitation.eventId !== eventId || invitation.teamId !== teamId) throw new Error('INVITATION_NOT_FOUND');
  if (invitation.team.captainUserId !== captainUserId) throw new Error('NOT_TEAM_CAPTAIN');
  assertTeamEditableForInvites(invitation.team);
  if (!isOpenInvitation(invitation.status)) throw new Error('INVITATION_CLOSED');

  const cancelled = await prisma.eventTeamInvitation.update({
    where: { id: invitationId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  await notifyTeamUpdated(eventId, teamId);
  return cancelled;
}

export async function markMemberInvitationRemoved(teamId: string, userId: string) {
  await prisma.eventTeamInvitation.updateMany({
    where: {
      teamId,
      inviteeUserId: userId,
      status: 'ACCEPTED',
    },
    data: {
      status: 'REMOVED',
      cancelledAt: new Date(),
    },
  });
}

export async function getTeamSlots(teamId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { id: true, minTeamSize: true, maxTeamSize: true, requireAdminApprovalForTeams: true, teamJoinMode: true } },
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        where: { status: { notIn: ['REMOVED', 'LEFT'] } },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      invitations: {
        orderBy: [{ slotIndex: 'asc' }, { createdAt: 'desc' }],
        include: { invitee: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
      changeRequests: {
        where: { status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!team) throw new Error('TEAM_NOT_FOUND');

  const maxSize = Math.max(team.maxSize, team.event.maxTeamSize ?? team.maxSize, 1);
  const activeMembers = team.members.filter(member => member.status === 'ACTIVE');
  const activeMembersByUserId = new Map(activeMembers.map(member => [member.userId, member]));
  const usedMemberIds = new Set<string>();
  const slots: any[] = Array.from({ length: maxSize }, (_, index) => ({
    slotIndex: index + 1,
    kind: 'EMPTY',
    status: 'EMPTY',
  }));

  const captainMember = activeMembersByUserId.get(team.captainUserId);
  slots[0] = {
    slotIndex: 1,
    kind: 'CAPTAIN',
    status: 'ACTIVE',
    member: captainMember ?? null,
    user: team.captainUser,
  };
  usedMemberIds.add(team.captainUserId);

  const latestInvitationBySlot = new Map<number, any>();
  for (const invitation of team.invitations) {
    if (!latestInvitationBySlot.has(invitation.slotIndex)) {
      latestInvitationBySlot.set(invitation.slotIndex, invitation);
    }
  }

  for (const invitation of team.invitations) {
    if (invitation.slotIndex < 2 || invitation.slotIndex > maxSize) continue;
    if (!(OCCUPIED_INVITATION_STATUSES as readonly string[]).includes(invitation.status)) continue;
    if (latestInvitationBySlot.get(invitation.slotIndex)?.id !== invitation.id) continue;

    if (invitation.status === 'ACCEPTED' && invitation.inviteeUserId) {
      const member = activeMembersByUserId.get(invitation.inviteeUserId);
      if (member && member.userId !== team.captainUserId) {
        slots[invitation.slotIndex - 1] = {
          slotIndex: invitation.slotIndex,
          kind: 'MEMBER',
          status: 'ACTIVE',
          member,
          user: member.user,
          invitation,
        };
        usedMemberIds.add(member.userId);
      }
      continue;
    }

    slots[invitation.slotIndex - 1] = {
      slotIndex: invitation.slotIndex,
      kind: 'INVITATION',
      status: invitation.status,
      invitation,
      email: invitation.inviteeEmail,
    };
  }

  for (const member of activeMembers) {
    if (usedMemberIds.has(member.userId)) continue;
    const slot = slots.find(item => item.kind === 'EMPTY');
    if (!slot) break;
    const index = slot.slotIndex - 1;
    slots[index] = {
      slotIndex: slot.slotIndex,
      kind: 'MEMBER',
      status: 'ACTIVE',
      member,
      user: member.user,
    };
    usedMemberIds.add(member.userId);
  }

  const history = team.invitations.filter(invitation =>
    !['PENDING_ACCOUNT', 'PENDING_RESPONSE', 'ACCEPTED'].includes(invitation.status)
  );
  const activeCount = activeMembers.length;
  const pendingCount = slots.filter(slot => slot.kind === 'INVITATION').length;
  const permissions = getTeamCabinetPermissions({
    status: team.status,
    isCaptain: true,
    requireAdminApprovalForTeams: team.event.requireAdminApprovalForTeams,
  });
  const submission = getTeamSubmissionState({
    status: team.status,
    isCaptain: true,
    requireAdminApprovalForTeams: team.event.requireAdminApprovalForTeams,
    teamJoinMode: team.event.teamJoinMode,
    minTeamSize: team.event.minTeamSize,
    maxTeamSize: maxSize,
    activeMembers: activeCount,
    pendingInvites: pendingCount,
  });

  return {
    team,
    slots,
    history,
    permissions,
    submission,
    progress: {
      active: activeCount,
      pending: pendingCount,
      max: maxSize,
      min: team.event.minTeamSize,
    },
    canSubmit: submission.canSubmit,
  };
}

export async function assertEmailInviteTeamReady(teamId: string) {
  const slots = await getTeamSlots(teamId);
  if (!slots.canSubmit) {
    const error = new Error(slots.progress.pending > 0 ? 'TEAM_INVITATIONS_PENDING' : 'TEAM_NOT_FULL');
    throw error;
  }
  return slots;
}
