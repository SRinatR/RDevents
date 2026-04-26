import type {
  EventStaffGrant,
  EventStaffRole,
  Prisma,
  User,
  WorkspaceEventAccessPolicy,
} from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../common/logger.js';
import {
  EVENT_ROLE_PERMISSIONS,
  WORKSPACE_ROLE_PERMISSIONS,
  type EventPermission,
  type WorkspacePermission,
  unionPermissionsForRoles,
} from './access-control.permissions.js';
import {
  buildEventScopeWhere,
  classifyEventTimeScope,
  eventMatchesScopeOptions,
  type EventTimeScope,
} from './access-control.event-scope.js';
import { canManageEventLegacy, getLegacyManagedEventIds } from './access-control.legacy.js';
import { writeAuditLog, type AuditLogInput } from './access-control.audit.js';

type Tx = Prisma.TransactionClient;

export interface CreateWorkspaceEventAccessPolicyInput {
  workspaceId: string;
  userId: string;
  role: EventStaffRole;
  includePastEvents?: boolean;
  includeCurrentEvents?: boolean;
  includeFutureEvents?: boolean;
  includeCancelledEvents?: boolean;
  autoApplyToNewEvents?: boolean;
  fullWorkspaceAccess?: boolean;
  audit?: Omit<AuditLogInput, 'action' | 'workspaceId' | 'targetUserId' | 'afterJson'>;
}

export interface CreateDirectEventStaffGrantInput {
  eventId: string;
  userId: string;
  role: EventStaffRole;
  reason?: string | null;
  source?: 'DIRECT' | 'SYSTEM' | 'LEGACY_EVENT_ADMIN_MIGRATION';
  audit?: Omit<AuditLogInput, 'action' | 'eventId' | 'targetUserId' | 'afterJson'>;
}

export interface PolicyPreview {
  workspace: { id: string; name: string };
  targetUser: { id: string; email: string; name: string | null };
  role: EventStaffRole;
  matchedEvents: Record<EventTimeScope, Array<{ id: string; title: string; startsAt: Date; endsAt: Date; status: string }>>;
  totalMatched: number;
  autoApplyToNewEvents: boolean;
  warnings: string[];
}

const PLATFORM_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN'] as const;

function isPlatformAdmin(user: User) {
  return PLATFORM_ADMIN_ROLES.includes(user.role as any);
}

function normalizePolicyInput(input: CreateWorkspaceEventAccessPolicyInput) {
  const fullWorkspaceAccess = Boolean(input.fullWorkspaceAccess);

  return {
    includePastEvents: fullWorkspaceAccess || Boolean(input.includePastEvents),
    includeCurrentEvents: fullWorkspaceAccess || Boolean(input.includeCurrentEvents),
    includeFutureEvents: fullWorkspaceAccess || Boolean(input.includeFutureEvents),
    includeCancelledEvents: Boolean(input.includeCancelledEvents),
    autoApplyToNewEvents: fullWorkspaceAccess || Boolean(input.autoApplyToNewEvents),
    fullWorkspaceAccess,
  };
}

async function canAccessEventV2(user: User, eventId: string, permission: EventPermission) {
  const access = await prisma.eventStaffAccess.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId: user.id,
      },
    },
    select: {
      status: true,
      permissions: true,
    },
  });

  return access?.status === 'ACTIVE' && access.permissions.includes(permission);
}

export async function canManagePlatform(user: User): Promise<boolean> {
  return isPlatformAdmin(user);
}

export async function canManageWorkspace(
  user: User,
  workspaceId: string,
  permission: WorkspacePermission,
): Promise<boolean> {
  if (isPlatformAdmin(user)) return true;

  const membership = await prisma.organizerWorkspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });

  if (membership?.status !== 'ACTIVE') return false;
  return WORKSPACE_ROLE_PERMISSIONS[membership.role].includes(permission);
}

export async function canAccessEvent(
  user: User,
  eventId: string,
  permission: EventPermission = 'event.read',
): Promise<boolean> {
  if (isPlatformAdmin(user)) return true;

  if (env.RBAC_V2_SHADOW_COMPARE) {
    const [legacyAllowed, v2Allowed] = await Promise.all([
      canManageEventLegacy(user, eventId),
      canAccessEventV2(user, eventId, permission),
    ]);

    if (legacyAllowed !== v2Allowed) {
      logger.warn('RBAC shadow mismatch', {
        action: 'rbac_shadow_mismatch',
        userId: user.id,
        eventId,
        meta: { permission, legacyAllowed, v2Allowed },
      });
    }

    if (!env.RBAC_V2_ENABLED) return legacyAllowed;
  }

  if (env.RBAC_V2_ENABLED) {
    const v2Allowed = await canAccessEventV2(user, eventId, permission);
    if (v2Allowed) return true;

    if (env.RBAC_V2_LEGACY_FALLBACK) {
      const legacyAllowed = await canManageEventLegacy(user, eventId);
      if (legacyAllowed) {
        logger.warn('RBAC legacy fallback used', {
          action: 'rbac_legacy_fallback_used',
          userId: user.id,
          eventId,
          meta: { permission },
        });
      }
      return legacyAllowed;
    }

    logger.warn('RBAC access denied', {
      action: 'rbac_access_denied',
      userId: user.id,
      eventId,
      meta: { permission },
    });
    return false;
  }

  return canManageEventLegacy(user, eventId);
}

export async function getManagedEventIds(
  user: User,
  permission: EventPermission = 'event.read',
): Promise<string[]> {
  if (isPlatformAdmin(user)) {
    const events = await prisma.event.findMany({ select: { id: true } });
    return events.map(event => event.id);
  }

  if (!env.RBAC_V2_ENABLED) return getLegacyManagedEventIds(user);

  const accesses = await prisma.eventStaffAccess.findMany({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      permissions: { has: permission },
    },
    select: { eventId: true },
  });

  const ids = new Set(accesses.map(access => access.eventId));

  if (env.RBAC_V2_LEGACY_FALLBACK) {
    for (const eventId of await getLegacyManagedEventIds(user)) ids.add(eventId);
  }

  return [...ids];
}

export async function previewWorkspaceAccessPolicy(
  actor: User,
  input: CreateWorkspaceEventAccessPolicyInput,
): Promise<PolicyPreview> {
  if (!(await canManageWorkspace(actor, input.workspaceId, 'workspace.policies.manage'))) {
    throw new Error('FORBIDDEN');
  }

  const [workspace, targetUser] = await Promise.all([
    prisma.organizerWorkspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, name: true },
    }),
  ]);

  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
  if (!targetUser) throw new Error('USER_NOT_FOUND');

  const policyOptions = normalizePolicyInput(input);
  const events = await prisma.event.findMany({
    where: {
      organizerWorkspaceId: input.workspaceId,
      ...buildEventScopeWhere(policyOptions),
    } as any,
    select: { id: true, title: true, startsAt: true, endsAt: true, status: true },
    orderBy: { startsAt: 'asc' },
  });

  const matchedEvents: PolicyPreview['matchedEvents'] = {
    past: [],
    current: [],
    future: [],
    cancelled: [],
  };

  for (const event of events) {
    matchedEvents[classifyEventTimeScope(event)].push(event);
  }

  const warnings: string[] = [];
  if (events.length === 0 && !policyOptions.autoApplyToNewEvents) {
    warnings.push('No events match this policy. Nothing will be granted now.');
  }

  logger.info('RBAC policy previewed', {
    action: 'rbac_policy_previewed',
    userId: actor.id,
    meta: {
      targetUserId: input.userId,
      workspaceId: input.workspaceId,
      role: input.role,
      totalMatched: events.length,
    },
  });

  return {
    workspace,
    targetUser,
    role: input.role,
    matchedEvents,
    totalMatched: events.length,
    autoApplyToNewEvents: policyOptions.autoApplyToNewEvents,
    warnings,
  };
}

export async function createWorkspaceAccessPolicy(
  actor: User,
  input: CreateWorkspaceEventAccessPolicyInput,
): Promise<{ policy: WorkspaceEventAccessPolicy; applied: { eventsCount: number; grantsCreated: number; grantsUpdated: number } }> {
  if (!(await canManageWorkspace(actor, input.workspaceId, 'workspace.policies.manage'))) {
    throw new Error('FORBIDDEN');
  }

  const policyOptions = normalizePolicyInput(input);
  const targetUser = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!targetUser) throw new Error('USER_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const policy = await tx.workspaceEventAccessPolicy.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.role,
        createdByUserId: actor.id,
        ...policyOptions,
      },
    });

    const events = await tx.event.findMany({
      where: {
        organizerWorkspaceId: input.workspaceId,
        ...buildEventScopeWhere(policyOptions),
      } as any,
      select: { id: true },
    });

    let grantsCreated = 0;
    let grantsUpdated = 0;

    for (const event of events) {
      const existingGrant = await tx.eventStaffGrant.findFirst({
        where: {
          eventId: event.id,
          userId: input.userId,
          policyId: policy.id,
        },
        select: { id: true },
      });

      if (existingGrant) {
        await tx.eventStaffGrant.update({
          where: { id: existingGrant.id },
          data: {
            status: 'ACTIVE',
            role: input.role,
            removedAt: null,
            disabledAt: null,
            assignedByUserId: actor.id,
            assignedAt: new Date(),
          },
        });
        grantsUpdated += 1;
      } else {
        await tx.eventStaffGrant.create({
          data: {
            eventId: event.id,
            userId: input.userId,
            role: input.role,
            source: 'WORKSPACE_POLICY',
            policyId: policy.id,
            assignedByUserId: actor.id,
          },
        });
        grantsCreated += 1;
      }

      await recalculateEventStaffAccess(tx, event.id, input.userId);
    }

    await writeAuditLog(tx, {
      ...(input.audit ?? {}),
      actorUserId: input.audit?.actorUserId ?? actor.id,
      action: 'WORKSPACE_ACCESS_POLICY_CREATED',
      workspaceId: input.workspaceId,
      targetUserId: input.userId,
      afterJson: policy as any,
      meta: { eventsCount: events.length, grantsCreated, grantsUpdated },
    });

    logger.info('RBAC policy created', {
      action: 'rbac_policy_created',
      userId: actor.id,
      meta: {
        targetUserId: input.userId,
        workspaceId: input.workspaceId,
        policyId: policy.id,
        eventsCount: events.length,
        grantsCreated,
        grantsUpdated,
      },
    });

    return {
      policy,
      applied: {
        eventsCount: events.length,
        grantsCreated,
        grantsUpdated,
      },
    };
  });
}

export async function revokeWorkspaceAccessPolicy(
  actor: User,
  policyId: string,
  audit?: Omit<AuditLogInput, 'action' | 'workspaceId' | 'targetUserId' | 'beforeJson'>,
): Promise<void> {
  const policy = await prisma.workspaceEventAccessPolicy.findUnique({ where: { id: policyId } });
  if (!policy) throw new Error('POLICY_NOT_FOUND');

  if (!(await canManageWorkspace(actor, policy.workspaceId, 'workspace.policies.manage'))) {
    throw new Error('FORBIDDEN');
  }

  await prisma.$transaction(async (tx) => {
    const activeGrants = await tx.eventStaffGrant.findMany({
      where: { policyId, status: 'ACTIVE' },
      select: { id: true, eventId: true, userId: true },
    });

    await tx.workspaceEventAccessPolicy.update({
      where: { id: policyId },
      data: {
        status: 'REMOVED',
        revokedAt: new Date(),
        revokedByUserId: actor.id,
      },
    });

    await tx.eventStaffGrant.updateMany({
      where: { policyId, status: 'ACTIVE' },
      data: { status: 'REMOVED', removedAt: new Date() },
    });

    for (const grant of activeGrants) {
      await recalculateEventStaffAccess(tx, grant.eventId, grant.userId);
    }

    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: 'WORKSPACE_ACCESS_POLICY_REVOKED',
      workspaceId: policy.workspaceId,
      targetUserId: policy.userId,
      beforeJson: policy as any,
      meta: { policyId, affectedGrants: activeGrants.length },
    });
  });

  logger.info('RBAC policy revoked', {
    action: 'rbac_policy_revoked',
    userId: actor.id,
    meta: { policyId, workspaceId: policy.workspaceId, targetUserId: policy.userId },
  });
}

export async function createDirectEventStaffGrant(
  actor: User,
  input: CreateDirectEventStaffGrantInput,
): Promise<EventStaffGrant> {
  const canManageStaff = await canAccessEvent(actor, input.eventId, 'event.manageStaff');
  if (!canManageStaff) throw new Error('FORBIDDEN');

  const targetUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  if (!targetUser) throw new Error('USER_NOT_FOUND');

  if (input.role === 'OWNER' && !isPlatformAdmin(actor)) {
    const actorAccess = await prisma.eventStaffAccess.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: actor.id } },
      select: { status: true, isOwner: true },
    });
    if (!(actorAccess?.status === 'ACTIVE' && actorAccess.isOwner)) {
      throw new Error('ONLY_OWNER_CAN_ASSIGN_OWNER');
    }
  }

  return prisma.$transaction(async (tx) => {
    const existingGrant = await tx.eventStaffGrant.findFirst({
      where: {
        eventId: input.eventId,
        userId: input.userId,
        role: input.role,
        source: input.source ?? 'DIRECT',
        policyId: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const grant = existingGrant
      ? await tx.eventStaffGrant.update({
          where: { id: existingGrant.id },
          data: {
            status: 'ACTIVE',
            assignedByUserId: actor.id,
            assignedAt: new Date(),
            removedAt: null,
            disabledAt: null,
            reason: input.reason ?? null,
          },
        })
      : await tx.eventStaffGrant.create({
          data: {
            eventId: input.eventId,
            userId: input.userId,
            role: input.role,
            source: input.source ?? 'DIRECT',
            assignedByUserId: actor.id,
            reason: input.reason ?? null,
          },
        });

    await recalculateEventStaffAccess(tx, input.eventId, input.userId);

    await writeAuditLog(tx, {
      ...(input.audit ?? {}),
      actorUserId: input.audit?.actorUserId ?? actor.id,
      action: 'EVENT_STAFF_GRANT_CREATED',
      eventId: input.eventId,
      targetUserId: input.userId,
      afterJson: grant as any,
      meta: { grantId: grant.id, role: input.role, source: grant.source },
    });

    logger.info('RBAC event staff grant created', {
      action: 'rbac_event_staff_grant_created',
      userId: actor.id,
      eventId: input.eventId,
      meta: { targetUserId: input.userId, grantId: grant.id, role: input.role },
    });

    return grant;
  });
}

export async function revokeEventStaffGrant(
  actor: User,
  grantId: string,
  audit?: Omit<AuditLogInput, 'action' | 'eventId' | 'targetUserId' | 'beforeJson'>,
): Promise<void> {
  const grant = await prisma.eventStaffGrant.findUnique({ where: { id: grantId } });
  if (!grant) throw new Error('GRANT_NOT_FOUND');

  if (!(await canAccessEvent(actor, grant.eventId, 'event.manageStaff'))) {
    throw new Error('FORBIDDEN');
  }

  if (grant.role === 'OWNER') {
    if (!isPlatformAdmin(actor)) {
      const actorAccess = await prisma.eventStaffAccess.findUnique({
        where: { eventId_userId: { eventId: grant.eventId, userId: actor.id } },
        select: { status: true, isOwner: true },
      });
      if (!(actorAccess?.status === 'ACTIVE' && actorAccess.isOwner)) {
        throw new Error('ADMIN_CANNOT_REMOVE_OWNER');
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    if (grant.role === 'OWNER') {
      await assertNotRemovingLastEventOwner(tx, grant.eventId, grant.userId, grant.id);
    }

    await tx.eventStaffGrant.update({
      where: { id: grantId },
      data: { status: 'REMOVED', removedAt: new Date() },
    });

    await recalculateEventStaffAccess(tx, grant.eventId, grant.userId);

    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: 'EVENT_STAFF_GRANT_REVOKED',
      eventId: grant.eventId,
      targetUserId: grant.userId,
      beforeJson: grant as any,
      meta: { grantId, role: grant.role, source: grant.source },
    });
  });
}

export async function recalculateEventStaffAccess(
  tx: Tx,
  eventId: string,
  userId: string,
) {
  const activeGrants = await tx.eventStaffGrant.findMany({
    where: {
      eventId,
      userId,
      status: 'ACTIVE',
    },
    select: {
      role: true,
    },
  });

  if (activeGrants.length === 0) {
    await tx.eventStaffAccess.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      create: {
        eventId,
        userId,
        status: 'REMOVED',
        roles: [],
        permissions: [],
        isOwner: false,
        recalculatedAt: new Date(),
      },
      update: {
        status: 'REMOVED',
        roles: [],
        permissions: [],
        isOwner: false,
        recalculatedAt: new Date(),
      },
    });

    logger.info('RBAC event access recalculated', {
      action: 'rbac_event_access_recalculated',
      eventId,
      meta: { targetUserId: userId, status: 'REMOVED' },
    });

    return null;
  }

  const roles = [...new Set(activeGrants.map(grant => grant.role))];
  const permissions = unionPermissionsForRoles(roles);
  const isOwner = roles.includes('OWNER');

  const access = await tx.eventStaffAccess.upsert({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
    create: {
      eventId,
      userId,
      status: 'ACTIVE',
      roles,
      permissions,
      isOwner,
      recalculatedAt: new Date(),
    },
    update: {
      status: 'ACTIVE',
      roles,
      permissions,
      isOwner,
      recalculatedAt: new Date(),
    },
  });

  logger.info('RBAC event access recalculated', {
    action: 'rbac_event_access_recalculated',
    eventId,
    meta: { targetUserId: userId, status: 'ACTIVE', roles, permissions },
  });

  return access;
}

export async function applyActiveWorkspacePoliciesToEvent(
  tx: Tx,
  eventId: string,
): Promise<void> {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerWorkspaceId: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });

  if (!event?.organizerWorkspaceId) return;

  const policies = await tx.workspaceEventAccessPolicy.findMany({
    where: {
      workspaceId: event.organizerWorkspaceId,
      status: 'ACTIVE',
      autoApplyToNewEvents: true,
    },
  });

  for (const policy of policies) {
    if (!eventMatchesScopeOptions(event, policy)) continue;

    const existingGrant = await tx.eventStaffGrant.findFirst({
      where: {
        eventId,
        userId: policy.userId,
        policyId: policy.id,
      },
      select: { id: true },
    });

    if (existingGrant) {
      await tx.eventStaffGrant.update({
        where: { id: existingGrant.id },
        data: {
          status: 'ACTIVE',
          role: policy.role,
          removedAt: null,
          disabledAt: null,
        },
      });
    } else {
      await tx.eventStaffGrant.create({
        data: {
          eventId,
          userId: policy.userId,
          role: policy.role,
          source: 'WORKSPACE_POLICY',
          policyId: policy.id,
          assignedByUserId: policy.createdByUserId,
          reason: 'Auto-applied workspace policy',
        },
      });
    }

    await recalculateEventStaffAccess(tx, eventId, policy.userId);
  }
}

export async function assertNotRemovingLastEventOwner(
  tx: Tx,
  eventId: string,
  userId: string,
  grantId?: string,
) {
  const remainingOwnerGrants = await tx.eventStaffGrant.count({
    where: {
      eventId,
      role: 'OWNER',
      status: 'ACTIVE',
      ...(grantId ? { id: { not: grantId } } : { userId: { not: userId } }),
    },
  });

  if (remainingOwnerGrants === 0) {
    logger.warn('RBAC last owner removal blocked', {
      action: 'rbac_last_owner_removal_blocked',
      eventId,
      meta: { targetUserId: userId, grantId },
    });
    throw new Error('CANNOT_REMOVE_LAST_EVENT_OWNER');
  }
}

export function getPermissionsForRole(role: EventStaffRole): EventPermission[] {
  return EVENT_ROLE_PERMISSIONS[role];
}
