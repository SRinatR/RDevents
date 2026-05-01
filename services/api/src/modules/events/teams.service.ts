import { prisma } from '../../db/prisma.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import {
  notifyTeamApproved,
  notifyTeamCreated,
  notifyTeamMemberChanged,
  notifyTeamRejected,
  notifyTeamSubmitted,
  notifyTeamUpdated,
} from './notifications.service.js';
import { assertEmailInviteTeamReady, markMemberInvitationRemoved } from './team-invitations.service.js';
import {
  ACTIVE_EVENT_MEMBER_STATUSES,
  getTeamStatusAfterReject,
  isApprovalTeam,
  isInitialApprovalRequest,
  isOpenChangeRequestStatus,
  isTeamApprovedStatus,
  isTeamEditableByCaptain,
  isTeamLockedForUserActions,
  LIVE_TEAM_MEMBER_STATUSES,
  OPEN_CHANGE_REQUEST_STATUSES,
  TEAM_STATUSES_EDITABLE_BY_CAPTAIN,
} from './team-governance.js';
import { assertRegistrationGateOpen } from './registration-gates.js';

const PLATFORM_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;

function isCaptainEditableStatus(status: string) {
  return TEAM_STATUSES_EDITABLE_BY_CAPTAIN.includes(status as any);
}

function isPendingReviewTeamStatus(status: string) {
  return ['PENDING', 'CHANGES_PENDING', 'SUBMITTED'].includes(status);
}

function buildSnapshotFromTeam(team: any) {
  return {
    id: team.id,
    eventId: team.eventId,
    name: team.name,
    description: team.description,
    status: team.status,
    captainUserId: team.captainUserId,
    maxSize: team.maxSize,
    members: (team.members ?? []).map((member: any) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      approvedAt: member.approvedAt,
      removedAt: member.removedAt,
      user: member.user
        ? {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
          }
        : undefined,
    })),
  };
}

async function buildTeamSnapshot(tx: any, teamId: string) {
  const team = await tx.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      captainUser: { select: { id: true, name: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!team) throw new Error('TEAM_NOT_FOUND');
  return buildSnapshotFromTeam(team);
}

async function writeTeamHistory(
  tx: any,
  input: {
    eventId: string;
    teamId: string;
    requestId?: string | null;
    actorUserId?: string | null;
    targetUserId?: string | null;
    action: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    metaJson?: unknown;
    reason?: string | null;
  }
) {
  await tx.eventTeamHistory.create({
    data: {
      eventId: input.eventId,
      teamId: input.teamId,
      requestId: input.requestId ?? null,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action as any,
      beforeJson: input.beforeJson ?? undefined,
      afterJson: input.afterJson ?? undefined,
      metaJson: input.metaJson ?? undefined,
      reason: input.reason ?? null,
    },
  });
}

export interface TeamCabinetPermissions {
  canOpenEditor: boolean;
  canEditDetails: boolean;
  canManageMembers: boolean;
  canSubmitForApproval: boolean;
  requiresApprovalAfterEdit: boolean;
  isPendingReview: boolean;
  isLocked: boolean;
}

export interface TeamSubmissionState {
  canSubmit: boolean;
  requiredActiveMembers: number;
  blocksOnPendingInvites: boolean;
}

export function getTeamCabinetPermissions(input: {
  status: string;
  isCaptain: boolean;
  requireAdminApprovalForTeams: boolean;
}): TeamCabinetPermissions {
  const { status, isCaptain, requireAdminApprovalForTeams } = input;
  const event = { requireAdminApprovalForTeams };
  const isDraft = isCaptainEditableStatus(status);
  const isPendingReview = isPendingReviewTeamStatus(status);
  const isActive = !requireAdminApprovalForTeams && status === 'ACTIVE';
  const isLocked = isTeamLockedForUserActions({ status, event });
  const canEditDetails = isCaptain && (isDraft || isActive || (isApprovalTeam(event) && isTeamApprovedStatus(status)));
  const canManageMembers = isCaptain && (isDraft || isActive);
  const canSubmitForApproval = isCaptain && requireAdminApprovalForTeams && isDraft;

  return {
    canOpenEditor: canEditDetails || canManageMembers || canSubmitForApproval,
    canEditDetails,
    canManageMembers,
    canSubmitForApproval,
    requiresApprovalAfterEdit: isCaptain && isApprovalTeam(event) && isTeamApprovedStatus(status),
    isPendingReview,
    isLocked,
  };
}

export function getTeamSubmissionState(input: {
  status: string;
  isCaptain: boolean;
  requireAdminApprovalForTeams: boolean;
  teamJoinMode?: string | null;
  minTeamSize?: number | null;
  maxTeamSize?: number | null;
  activeMembers: number;
  pendingInvites: number;
}): TeamSubmissionState {
  const {
    status,
    isCaptain,
    requireAdminApprovalForTeams,
    teamJoinMode,
    minTeamSize,
    maxTeamSize,
    activeMembers,
    pendingInvites,
  } = input;
  const resolvedMinTeamSize = Math.max(minTeamSize ?? 1, 1);
  const resolvedMaxTeamSize = Math.max(maxTeamSize ?? resolvedMinTeamSize, 1);
  const blocksOnPendingInvites = teamJoinMode === 'EMAIL_INVITE';
  const requiredActiveMembers = blocksOnPendingInvites ? resolvedMaxTeamSize : resolvedMinTeamSize;
  const hasRequiredMembers = activeMembers >= requiredActiveMembers;
  const hasBlockingInvites = blocksOnPendingInvites && pendingInvites > 0;

  return {
    canSubmit:
      isCaptain &&
      requireAdminApprovalForTeams &&
      isCaptainEditableStatus(status) &&
      hasRequiredMembers &&
      !hasBlockingInvites,
    requiredActiveMembers,
    blocksOnPendingInvites,
  };
}

async function canManageTeamMembers(eventId: string, teamCaptainUserId: string, actorUserId: string) {
  if (teamCaptainUserId === actorUserId) return true;

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (actor && PLATFORM_ADMIN_ROLES.includes(actor.role as any)) return true;

  const eventAdmin = await prisma.eventMember.findFirst({
    where: {
      eventId,
      userId: actorUserId,
      role: 'EVENT_ADMIN',
      status: { in: [...ACTIVE_EVENT_MEMBER_STATUSES] },
    },
    select: { id: true },
  });

  return Boolean(eventAdmin);
}

async function assertApprovedParticipant(eventId: string, userId: string) {
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
    select: { id: true, status: true },
  });

  if (!membership || !ACTIVE_EVENT_MEMBER_STATUSES.includes(membership.status as any)) {
    throw new Error('PARTICIPANT_APPROVAL_REQUIRED');
  }

  return membership;
}

async function getProposedMemberUserIds(teamId: string, extraUserIds: string[] = []) {
  const members = await prisma.eventTeamMember.findMany({
    where: { teamId, status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } },
    select: { userId: true },
  });
  return [...new Set([...members.map(member => member.userId), ...extraUserIds])];
}

async function getOpenChangeRequest(tx: any, teamId: string) {
  return tx.eventTeamChangeRequest.findFirst({
    where: { teamId, status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
    orderBy: { createdAt: 'desc' },
  });
}

async function ensureNoOpenChangeRequest(tx: any, teamId: string, excludeRequestId?: string) {
  const openRequest = await tx.eventTeamChangeRequest.findFirst({
    where: {
      teamId,
      status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: { id: true },
  });

  if (openRequest) throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');
}

async function validateProposedTeamMembers(
  tx: any,
  input: { eventId: string; teamId: string; memberUserIds: string[]; maxSize?: number | null }
) {
  const memberUserIds = [...new Set(input.memberUserIds)];
  if (memberUserIds.length === 0) throw new Error('TEAM_EMPTY');
  if (input.maxSize && memberUserIds.length > input.maxSize) throw new Error('TEAM_FULL');

  const [participants, existingTeamMembers, otherTeamMembers] = await Promise.all([
    tx.eventMember.findMany({
      where: {
        eventId: input.eventId,
        role: 'PARTICIPANT',
        userId: { in: memberUserIds },
      },
      select: { userId: true, status: true },
    }),
    tx.eventTeamMember.findMany({
      where: { teamId: input.teamId, userId: { in: memberUserIds } },
      select: { userId: true, status: true },
    }),
    tx.eventTeamMember.findMany({
      where: {
        userId: { in: memberUserIds },
        teamId: { not: input.teamId },
        status: { in: [...LIVE_TEAM_MEMBER_STATUSES] },
        team: { eventId: input.eventId },
      },
      select: { userId: true },
    }),
  ]);

  const participantByUserId = new Map(participants.map((item: any) => [item.userId, item]));
  for (const userId of memberUserIds) {
    const participant = participantByUserId.get(userId) as any;
    if (!participant || !ACTIVE_EVENT_MEMBER_STATUSES.includes(participant.status as any)) {
      throw new Error('STALE_CHANGE_REQUEST');
    }
  }

  if (existingTeamMembers.some((member: any) => ['LEFT', 'REMOVED'].includes(member.status))) {
    throw new Error('STALE_CHANGE_REQUEST');
  }

  if (otherTeamMembers.length > 0) {
    throw new Error('USER_ALREADY_IN_OTHER_TEAM');
  }
}

async function setTeamCaptain(tx: any, teamId: string, newCaptainUserId: string) {
  await tx.eventTeamMember.updateMany({
    where: { teamId, role: 'CAPTAIN' },
    data: { role: 'MEMBER' },
  });

  await tx.eventTeamMember.upsert({
    where: { teamId_userId: { teamId, userId: newCaptainUserId } },
    create: {
      teamId,
      userId: newCaptainUserId,
      role: 'CAPTAIN',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
    update: {
      role: 'CAPTAIN',
      status: 'ACTIVE',
      approvedAt: new Date(),
      removedAt: null,
    },
  });

  await tx.eventTeam.update({
    where: { id: teamId },
    data: { captainUserId: newCaptainUserId },
  });
}

async function cancelOpenChangeRequests(
  tx: any,
  input: { eventId: string; teamId: string; actorUserId: string; reason: string; excludeRequestId?: string }
) {
  const openRequests = await tx.eventTeamChangeRequest.findMany({
    where: {
      teamId: input.teamId,
      status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] },
      ...(input.excludeRequestId ? { id: { not: input.excludeRequestId } } : {}),
    },
    select: { id: true },
  });

  if (openRequests.length === 0) return;

  const now = new Date();
  await tx.eventTeamChangeRequest.updateMany({
    where: { id: { in: openRequests.map((request: any) => request.id) } },
    data: {
      status: 'CANCELLED',
      decidedByUserId: input.actorUserId,
      decisionReason: input.reason,
      decidedAt: now,
      cancelledAt: now,
    },
  });

  for (const request of openRequests) {
    await writeTeamHistory(tx, {
      eventId: input.eventId,
      teamId: input.teamId,
      requestId: request.id,
      actorUserId: input.actorUserId,
      action: 'ADMIN_OPEN_REQUEST_CANCELLED',
      reason: input.reason,
    });
  }
}

async function upsertPendingTeamChangeRequest(
  tx: any,
  team: { id: string; eventId: string; name: string; description: string | null; status: string; captainUserId: string; maxSize: number },
  requestedByUserId: string,
  data: {
    requestType: string;
    name?: string | null;
    description?: string | null;
    memberUserIds?: string[];
    proposedCaptainUserId?: string | null;
    reason?: string | null;
    notes?: string | null;
    targetStatus?: string;
  }
) {
  const proposedMemberUserIds = data.memberUserIds ?? await getProposedMemberUserIds(team.id);
  await validateProposedTeamMembers(tx, {
    eventId: team.eventId,
    teamId: team.id,
    memberUserIds: proposedMemberUserIds,
    maxSize: team.maxSize,
  });

  const existing = await getOpenChangeRequest(tx, team.id);
  if (existing) throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');

  const beforeSnapshotJson = await buildTeamSnapshot(tx, team.id);
  const afterSnapshotJson = {
    ...beforeSnapshotJson,
    name: data.name ?? team.name,
    description: data.description !== undefined ? data.description : team.description,
    captainUserId: data.proposedCaptainUserId ?? team.captainUserId,
    members: beforeSnapshotJson.members.filter((member: any) => proposedMemberUserIds.includes(member.userId)),
  };

  const payload = {
    type: data.requestType as any,
    status: 'PENDING' as any,
    requestedByUserId,
    submittedAt: new Date(),
    reason: data.reason ?? null,
    notes: data.notes ?? null,
    proposedName: data.name ?? team.name,
    proposedDescription: data.description !== undefined ? data.description : team.description,
    proposedMemberUserIds,
    proposedCaptainUserId: data.proposedCaptainUserId ?? team.captainUserId,
    beforeSnapshotJson,
    afterSnapshotJson,
  };

  return tx.eventTeamChangeRequest.create({
    data: {
      teamId: team.id,
      ...payload,
    },
  });
}

async function syncApprovedTeamMembers(tx: any, teamId: string, memberUserIds: string[]) {
  const proposed = new Set(memberUserIds);
  const existing = await tx.eventTeamMember.findMany({
    where: { teamId, status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } },
  });

  for (const member of existing) {
    if (proposed.has(member.userId)) {
      if (member.status !== 'ACTIVE') {
        await tx.eventTeamMember.update({
          where: { id: member.id },
          data: { status: 'ACTIVE', approvedAt: new Date(), removedAt: null },
        });
      }
      proposed.delete(member.userId);
    } else if (member.role !== 'CAPTAIN') {
      await tx.eventTeamMember.update({
        where: { id: member.id },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
    }
  }

  for (const userId of proposed) {
    await tx.eventTeamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: {
        teamId,
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
  }
}

export async function getTeamsByEvent(eventId: string) {
  return prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      captainUser: { select: { id: true, name: true, avatarUrl: true } },
      changeRequests: {
        where: { status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTeamById(eventId: string, teamId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      captainUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        where: { status: { notIn: ['REMOVED', 'LEFT'] } },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'desc' },
      },
      changeRequests: {
        where: { status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
  });

  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  const latestRejectedRequest = await prisma.eventTeamChangeRequest.findFirst({
    where: { teamId, status: 'REJECTED' },
    orderBy: { decidedAt: 'desc' },
  });
  return { ...team, latestRejectedRequest };
}

export async function createTeam(
  eventId: string,
  userId: string,
  data: { name: string; description?: string; answers?: Record<string, unknown> }
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (!event.isTeamBased) throw new Error('EVENT_NOT_TEAM_BASED');
  assertRegistrationGateOpen(event);
  await assertApprovedParticipant(eventId, userId);

  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } }
  });
  if (existingMembership) throw new Error('ALREADY_IN_TEAM');

  // Generate slug and strict join code
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 6);
  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const team = await prisma.$transaction(async (tx: any) => {
    const teamStatus = event.requireAdminApprovalForTeams ? 'DRAFT' : 'ACTIVE';

    // Create Team
    const team = await tx.eventTeam.create({
      data: {
        eventId,
        name: data.name,
        slug,
        joinCode,
        description: data.description,
        captainUserId: userId,
        status: teamStatus,
        maxSize: event.maxTeamSize,
        members: {
          create: {
            userId,
            role: 'CAPTAIN',
            status: 'ACTIVE', // Captain is active within their own team
            approvedAt: new Date(),
          }
        }
      },
      include: { members: true, changeRequests: true }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_CREATED',
      userId,
      eventId,
      meta: { teamId: team.id, teamName: team.name, status: team.status },
    });

    await writeTeamHistory(tx, {
      eventId,
      teamId: team.id,
      actorUserId: userId,
      action: 'TEAM_CREATED',
      afterJson: buildSnapshotFromTeam(team),
    });

    return team;
  });

  await notifyTeamCreated(eventId, team.id);
  return team;
}

export async function joinTeam(
  eventId: string,
  teamId: string,
  userId: string,
  code?: string,
  answers?: Record<string, unknown>
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (!event.isTeamBased) throw new Error('EVENT_NOT_TEAM_BASED');
  assertRegistrationGateOpen(event);
  await assertApprovedParticipant(eventId, userId);

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.status === 'SUBMITTED') throw new Error('TEAM_SUBMITTED_LOCKED');
  if (team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION') throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');
  if (event.requireAdminApprovalForTeams && isTeamApprovedStatus(team.status)) {
    throw new Error('TEAM_LOCKED_CONTACT_ORGANIZER');
  }
  if (!['ACTIVE', 'DRAFT', 'REJECTED'].includes(team.status)) throw new Error('TEAM_NOT_ACTIVE');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  if (event.teamJoinMode === 'BY_CODE' && team.joinCode !== code) throw new Error('INVALID_JOIN_CODE');

  const existingTeamMember = await prisma.eventTeamMember.findFirst({
    where: { team: { eventId }, userId, status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } }
  });
  if (existingTeamMember) throw new Error('ALREADY_IN_TEAM');

  const member = await prisma.$transaction(async (tx: any) => {
    const isPending = event.teamJoinMode === 'BY_REQUEST';

    // Member record
    const member = await tx.eventTeamMember.create({
      data: {
        teamId,
        userId,
        role: 'MEMBER',
        status: isPending ? 'PENDING' : 'ACTIVE',
        approvedAt: isPending ? null : new Date(),
      }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_JOIN_REQUESTED',
      userId,
      eventId,
      meta: { teamId, status: member.status, mode: event.teamJoinMode },
    });

    return member;
  });

  await notifyTeamMemberChanged(eventId, teamId, userId, member.status);
  return member;
}

export async function joinTeamByCode(
  eventId: string,
  userId: string,
  code: string,
  answers?: Record<string, unknown>
) {
  const normalizedCode = code.trim().toUpperCase();
  const team = await prisma.eventTeam.findFirst({
    where: { eventId, joinCode: normalizedCode },
    select: { id: true },
  });

  if (!team) throw new Error('TEAM_NOT_FOUND');
  return joinTeam(eventId, team.id, userId, normalizedCode, answers);
}

export async function updateTeam(eventId: string, teamId: string, userId: string, data: { name?: string; description?: string }) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true, minTeamSize: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== userId) throw new Error('NOT_TEAM_CAPTAIN');
  if (team.status === 'SUBMITTED') throw new Error('TEAM_SUBMITTED_LOCKED');
  if (team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION') throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');

  if (team.event.requireAdminApprovalForTeams && isTeamApprovedStatus(team.status)) {
    const changeRequest = await prisma.$transaction(async (tx: any) => {
      const changeRequest = await upsertPendingTeamChangeRequest(tx, team as any, userId, {
        requestType: 'DETAILS_UPDATE',
        name: data.name,
        description: data.description,
      });
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'CHANGES_PENDING' },
      });
      await writeTeamHistory(tx, {
        eventId,
        teamId,
        requestId: changeRequest.id,
        actorUserId: userId,
        action: 'CHANGE_REQUEST_CREATED',
        reason: changeRequest.reason ?? null,
        beforeJson: changeRequest.beforeSnapshotJson,
        afterJson: changeRequest.afterSnapshotJson,
      });
      return changeRequest;
    });
    await notifyTeamUpdated(eventId, teamId);
    return { ...team, changeRequests: [changeRequest], status: 'CHANGES_PENDING' };
  }

  if (!isTeamEditableByCaptain(team)) throw new Error('TEAM_APPROVED_LOCKED');

  const updated = await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, teamId);
    const updated = await tx.eventTeam.update({
      where: { id: teamId },
      data: {
        name: data.name ?? undefined,
        description: data.description !== undefined ? data.description : undefined,
      }
    });
    const afterJson = await buildTeamSnapshot(tx, teamId);
    await writeTeamHistory(tx, {
      eventId,
      teamId,
      actorUserId: userId,
      action: 'TEAM_DETAILS_UPDATED',
      beforeJson,
      afterJson,
    });
    return updated;
  });

  await notifyTeamUpdated(eventId, teamId);
  return updated;
}

export async function submitTeamForApproval(eventId: string, teamId: string, userId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: {
        select: {
          status: true,
          registrationEnabled: true,
          registrationOpensAt: true,
          registrationDeadline: true,
          requireAdminApprovalForTeams: true,
          minTeamSize: true,
          teamJoinMode: true,
        },
      },
      members: {
        where: { status: { in: [...LIVE_TEAM_MEMBER_STATUSES] } },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  assertRegistrationGateOpen(team.event);
  if (team.captainUserId !== userId) throw new Error('NOT_TEAM_CAPTAIN');
  if (!team.event.requireAdminApprovalForTeams) return team;
  if (team.status === 'SUBMITTED') throw new Error('TEAM_SUBMITTED_LOCKED');
  if (team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION') throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');
  if (!isCaptainEditableStatus(team.status)) throw new Error('TEAM_APPROVED_LOCKED');

  if (team.event.teamJoinMode === 'EMAIL_INVITE') {
    await assertEmailInviteTeamReady(teamId);
  }

  const changeRequest = await prisma.$transaction(async (tx: any) => {
    await ensureNoOpenChangeRequest(tx, teamId);
    const proposedMemberUserIds = await getProposedMemberUserIds(teamId);
    if (proposedMemberUserIds.length === 0) throw new Error('TEAM_EMPTY');
    if (proposedMemberUserIds.length < team.event.minTeamSize) throw new Error('TEAM_MIN_SIZE');
    const changeRequest = await upsertPendingTeamChangeRequest(tx, team as any, userId, {
      requestType: 'INITIAL_APPROVAL',
      memberUserIds: proposedMemberUserIds,
      name: team.name,
      description: team.description,
      proposedCaptainUserId: team.captainUserId,
    });
    await tx.eventTeam.update({
      where: { id: teamId },
      data: { status: 'SUBMITTED' },
    });
    await writeTeamHistory(tx, {
      eventId,
      teamId,
      requestId: changeRequest.id,
      actorUserId: userId,
      action: 'TEAM_SUBMITTED',
      beforeJson: null,
      afterJson: changeRequest.afterSnapshotJson,
    });
    await writeTeamHistory(tx, {
      eventId,
      teamId,
      requestId: changeRequest.id,
      actorUserId: userId,
      action: 'CHANGE_REQUEST_CREATED',
      beforeJson: changeRequest.beforeSnapshotJson,
      afterJson: changeRequest.afterSnapshotJson,
    });
    return changeRequest;
  });

  await notifyTeamSubmitted(eventId, teamId);
  await notifyTeamUpdated(eventId, teamId);
  return { ...team, status: 'SUBMITTED', changeRequests: [changeRequest] };
}

export async function leaveTeam(eventId: string, teamId: string, userId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId === userId) throw new Error('CAPTAIN_CANNOT_LEAVE');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  });
  if (!member) throw new Error('NOT_IN_TEAM');

  if (team.status === 'CHANGES_PENDING') throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');
  if (team.event.requireAdminApprovalForTeams && isTeamLockedForUserActions(team)) {
    const request = await prisma.$transaction(async (tx: any) => {
      await ensureNoOpenChangeRequest(tx, teamId);
      const beforeJson = await buildTeamSnapshot(tx, teamId);
      const request = await tx.eventTeamChangeRequest.create({
        data: {
          teamId,
          type: 'WITHDRAWAL_REQUEST',
          status: 'PENDING',
          requestedByUserId: userId,
          reason: 'Participant requested withdrawal after roster lock.',
          proposedName: team.name,
          proposedDescription: team.description,
          proposedCaptainUserId: team.captainUserId,
          proposedMemberUserIds: beforeJson.members.map((item: any) => item.userId),
          beforeSnapshotJson: beforeJson,
          afterSnapshotJson: beforeJson,
          submittedAt: new Date(),
        },
      });
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'NEEDS_ATTENTION' },
      });
      await writeTeamHistory(tx, {
        eventId,
        teamId,
        requestId: request.id,
        actorUserId: userId,
        targetUserId: userId,
        action: 'MEMBER_WITHDRAWAL_REQUESTED',
        beforeJson,
        afterJson: beforeJson,
        reason: request.reason,
      });
      return request;
    });

    await notifyTeamUpdated(eventId, teamId);
    return { status: 'WITHDRAWAL_REQUEST_CREATED', request };
  }

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'LEFT', removedAt: new Date() }
  });
  await notifyTeamMemberChanged(eventId, teamId, userId, 'LEFT');
  return { status: 'LEFT' };
}

export async function approveTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { requireAdminApprovalForTeams: true } },
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    }
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.event.requireAdminApprovalForTeams && !isCaptainEditableStatus(team.status)) {
    throw new Error('TEAM_APPROVED_LOCKED');
  }
  if (!(await canManageTeamMembers(eventId, team.captainUserId, captainId))) throw new Error('NOT_TEAM_CAPTAIN');
  if (team._count.members >= team.maxSize) throw new Error('TEAM_FULL');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');
  await assertApprovedParticipant(eventId, memberUserId);

  const updatedMember = await prisma.$transaction(async (tx: any) => {
    const updatedMember = await tx.eventTeamMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE', approvedAt: new Date() }
    });

    await trackAnalyticsEvent(tx, {
      type: 'TEAM_MEMBER_APPROVED',
      userId: memberUserId,
      eventId,
      meta: { teamId },
    });

    return updatedMember;
  });

  await notifyTeamMemberChanged(eventId, teamId, memberUserId, 'ACTIVE');
  return updatedMember;
}

export async function rejectTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({ where: { id: teamId } });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (!(await canManageTeamMembers(eventId, team.captainUserId, captainId))) throw new Error('NOT_TEAM_CAPTAIN');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'REJECTED' }
  });
  await notifyTeamMemberChanged(eventId, teamId, memberUserId, 'REJECTED');
}

export async function removeTeamMember(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== captainId) throw new Error('NOT_TEAM_CAPTAIN');
  if (team.captainUserId === memberUserId) throw new Error('CANNOT_REMOVE_CAPTAIN');

  const member = await prisma.eventTeamMember.findUnique({
    where: { teamId_userId: { teamId, userId: memberUserId } }
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  if (team.status === 'SUBMITTED') throw new Error('TEAM_SUBMITTED_LOCKED');
  if (team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION') throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');

  if (team.event.requireAdminApprovalForTeams && isTeamApprovedStatus(team.status)) {
    const changeRequest = await prisma.$transaction(async (tx: any) => {
      const proposedMemberUserIds = (await getProposedMemberUserIds(teamId)).filter((userId) => userId !== memberUserId);
      if (proposedMemberUserIds.length === 0) throw new Error('TEAM_EMPTY');
      const changeRequest = await upsertPendingTeamChangeRequest(tx, team as any, captainId, {
        requestType: 'MEMBER_REMOVE',
        memberUserIds: proposedMemberUserIds,
        name: team.name,
        description: team.description,
      });
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'CHANGES_PENDING' },
      });
      await writeTeamHistory(tx, {
        eventId,
        teamId,
        requestId: changeRequest.id,
        actorUserId: captainId,
        targetUserId: memberUserId,
        action: 'CHANGE_REQUEST_CREATED',
        beforeJson: changeRequest.beforeSnapshotJson,
        afterJson: changeRequest.afterSnapshotJson,
      });
      return changeRequest;
    });

    await notifyTeamUpdated(eventId, teamId);
    return { ...team, changeRequests: [changeRequest], status: 'CHANGES_PENDING' };
  }

  if (!isTeamEditableByCaptain(team)) throw new Error('TEAM_APPROVED_LOCKED');

  await prisma.eventTeamMember.update({
    where: { id: member.id },
    data: { status: 'REMOVED', removedAt: new Date() }
  });
  await markMemberInvitationRemoved(teamId, memberUserId);
  await notifyTeamMemberChanged(eventId, teamId, memberUserId, 'REMOVED');
  return getTeamById(eventId, teamId);
}

export async function transferTeamCaptain(eventId: string, teamId: string, captainId: string, memberUserId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { event: { select: { requireAdminApprovalForTeams: true } } },
  });
  if (!team || team.eventId !== eventId) throw new Error('TEAM_NOT_FOUND');
  if (team.captainUserId !== captainId) throw new Error('NOT_TEAM_CAPTAIN');
  if (captainId === memberUserId) throw new Error('CANNOT_TRANSFER_TO_SELF');

  const [targetMember, currentCaptainMember] = await Promise.all([
    prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberUserId } }
    }),
    prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: captainId } }
    }),
  ]);

  if (!targetMember || targetMember.status !== 'ACTIVE') throw new Error('TARGET_MEMBER_NOT_ACTIVE');
  if (!currentCaptainMember) throw new Error('MEMBER_NOT_FOUND');

  if (team.status === 'SUBMITTED') throw new Error('TEAM_SUBMITTED_LOCKED');
  if (team.status === 'CHANGES_PENDING' || team.status === 'NEEDS_ATTENTION') throw new Error('TEAM_CHANGE_REQUEST_ALREADY_OPEN');

  if (team.event.requireAdminApprovalForTeams && isTeamApprovedStatus(team.status)) {
    const changeRequest = await prisma.$transaction(async (tx: any) => {
      const changeRequest = await upsertPendingTeamChangeRequest(tx, team as any, captainId, {
        requestType: 'CAPTAIN_TRANSFER',
        memberUserIds: await getProposedMemberUserIds(teamId),
        name: team.name,
        description: team.description,
        proposedCaptainUserId: memberUserId,
      });
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'CHANGES_PENDING' },
      });
      await writeTeamHistory(tx, {
        eventId,
        teamId,
        requestId: changeRequest.id,
        actorUserId: captainId,
        targetUserId: memberUserId,
        action: 'CHANGE_REQUEST_CREATED',
        beforeJson: changeRequest.beforeSnapshotJson,
        afterJson: changeRequest.afterSnapshotJson,
      });
      return changeRequest;
    });

    await notifyTeamUpdated(eventId, teamId);
    return { ...team, changeRequests: [changeRequest], status: 'CHANGES_PENDING' };
  }

  if (!isTeamEditableByCaptain(team)) throw new Error('TEAM_APPROVED_LOCKED');

  await prisma.$transaction(async (tx: any) => {
    await tx.eventTeam.update({
      where: { id: teamId },
      data: { captainUserId: memberUserId },
    });
    await tx.eventTeamMember.update({
      where: { id: currentCaptainMember.id },
      data: { role: 'MEMBER' },
    });
    await tx.eventTeamMember.update({
      where: { id: targetMember.id },
      data: { role: 'CAPTAIN' },
    });
    await writeTeamHistory(tx, {
      eventId,
      teamId,
      actorUserId: captainId,
      targetUserId: memberUserId,
      action: 'CAPTAIN_TRANSFERRED',
    });
  });

  await notifyTeamUpdated(eventId, teamId);
  return getTeamById(eventId, teamId);
}

export async function approveTeamChangeRequest(eventId: string, teamId: string, requestId: string, adminUserId: string, notes?: string) {
  const request = await prisma.eventTeamChangeRequest.findUnique({
    where: { id: requestId },
    include: { team: { include: { event: { select: { requireAdminApprovalForTeams: true } } } } },
  });
  if (!request || request.teamId !== teamId || request.team.eventId !== eventId) throw new Error('TEAM_CHANGE_REQUEST_NOT_FOUND');
  if (request.status !== 'PENDING') throw new Error('TEAM_CHANGE_REQUEST_CLOSED');

  const updated = await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, teamId);
    await cancelOpenChangeRequests(tx, {
      eventId,
      teamId,
      actorUserId: adminUserId,
      reason: 'Cancelled after approving a newer team change request.',
      excludeRequestId: requestId,
    });

    if (request.type === 'WITHDRAWAL_REQUEST') {
      const member = await tx.eventTeamMember.findUnique({
        where: { teamId_userId: { teamId, userId: request.requestedByUserId } },
      });
      if (!member) throw new Error('MEMBER_NOT_FOUND');
      await tx.eventTeamMember.update({
        where: { id: member.id },
        data: { status: 'LEFT', removedAt: new Date() },
      });
      await tx.eventMember.updateMany({
        where: { eventId, userId: request.requestedByUserId, role: 'PARTICIPANT' },
        data: { status: 'CANCELLED', removedAt: new Date() },
      });
      await tx.eventTeam.update({
        where: { id: teamId },
        data: { status: 'NEEDS_ATTENTION' },
      });
    } else {
      await validateProposedTeamMembers(tx, {
        eventId,
        teamId,
        memberUserIds: request.proposedMemberUserIds,
        maxSize: request.team.maxSize,
      });
      await syncApprovedTeamMembers(tx, teamId, request.proposedMemberUserIds);
      if (request.proposedCaptainUserId) {
        await setTeamCaptain(tx, teamId, request.proposedCaptainUserId);
      }
      await tx.eventTeam.update({
        where: { id: teamId },
        data: {
          name: request.proposedName ?? request.team.name,
          description: request.proposedDescription,
          status: request.team.event.requireAdminApprovalForTeams ? 'APPROVED' : 'ACTIVE',
        },
      });
    }

    await tx.eventTeamChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        decidedByUserId: adminUserId,
        decidedAt: new Date(),
        decisionReason: notes?.trim() || null,
        notes: notes?.trim() || null,
      },
    });
    const afterJson = await buildTeamSnapshot(tx, teamId);
    await writeTeamHistory(tx, {
      eventId,
      teamId,
      requestId,
      actorUserId: adminUserId,
      targetUserId: request.type === 'WITHDRAWAL_REQUEST' ? request.requestedByUserId : request.proposedCaptainUserId,
      action: isInitialApprovalRequest(request, request.team.status) ? 'TEAM_APPROVED' : 'CHANGE_REQUEST_APPROVED',
      beforeJson,
      afterJson,
      reason: notes?.trim() || null,
    });
    const team = await tx.eventTeam.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'desc' },
        },
        changeRequests: {
          where: { status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return team;
  });

  await notifyTeamApproved(eventId, teamId, notes);
  await notifyTeamUpdated(eventId, teamId);
  return updated;
}

export async function rejectTeamChangeRequest(eventId: string, teamId: string, requestId: string, adminUserId: string, notes?: string) {
  const request = await prisma.eventTeamChangeRequest.findUnique({
    where: { id: requestId },
    include: { team: { include: { event: { select: { requireAdminApprovalForTeams: true } } } } },
  });
  if (!request || request.teamId !== teamId || request.team.eventId !== eventId) throw new Error('TEAM_CHANGE_REQUEST_NOT_FOUND');
  if (request.status !== 'PENDING') throw new Error('TEAM_CHANGE_REQUEST_CLOSED');
  if (!notes?.trim()) throw new Error('DECISION_REASON_REQUIRED');

  const nextTeamStatus = getTeamStatusAfterReject({
    requestType: request.type,
    requireAdminApprovalForTeams: request.team.event.requireAdminApprovalForTeams,
  });
  const updated = await prisma.$transaction(async (tx: any) => {
    const beforeJson = await buildTeamSnapshot(tx, teamId);
    await tx.eventTeamChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedByUserId: adminUserId,
        decidedAt: new Date(),
        decisionReason: notes.trim(),
        notes: notes.trim(),
      },
    });
    const team = await tx.eventTeam.update({
      where: { id: teamId },
      data: { status: nextTeamStatus },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'desc' },
        },
        changeRequests: {
          where: { status: { in: [...OPEN_CHANGE_REQUEST_STATUSES] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const afterJson = await buildTeamSnapshot(tx, teamId);
    await writeTeamHistory(tx, {
      eventId,
      teamId,
      requestId,
      actorUserId: adminUserId,
      action: isInitialApprovalRequest(request, request.team.status) ? 'TEAM_REJECTED' : 'CHANGE_REQUEST_REJECTED',
      beforeJson,
      afterJson,
      reason: notes.trim(),
    });
    return team;
  });

  await notifyTeamRejected(eventId, teamId, notes);
  await notifyTeamUpdated(eventId, teamId);
  return updated;
}
