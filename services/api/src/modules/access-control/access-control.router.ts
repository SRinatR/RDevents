import { Router } from 'express';
import type { EventStaffRole, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { normalizeEmail } from '@event-platform/shared';
import { buildAuditRequestContext } from './access-control.audit.js';
import {
  assertNotRemovingLastEventOwner,
  canAccessEvent,
  createDirectEventStaffGrant,
  createWorkspaceAccessPolicy,
  previewWorkspaceAccessPolicy,
  recalculateEventStaffAccess,
  revokeEventStaffGrant,
  revokeWorkspaceAccessPolicy,
} from './access-control.service.js';
import {
  createDirectEventStaffGrantSchema,
  createWorkspaceEventAccessPolicySchema,
  updateEventStaffGrantSchema,
} from './access-control.schemas.js';

export const accessControlRouter = Router();

function sendAccessError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const statusByCode: Record<string, number> = {
    FORBIDDEN: 403,
    USER_NOT_FOUND: 404,
    WORKSPACE_NOT_FOUND: 404,
    POLICY_NOT_FOUND: 404,
    GRANT_NOT_FOUND: 404,
    CANNOT_REMOVE_LAST_EVENT_OWNER: 409,
    ADMIN_CANNOT_REMOVE_OWNER: 403,
    ONLY_OWNER_CAN_ASSIGN_OWNER: 403,
  };

  res.status(statusByCode[code] ?? 500).json({ error: code, code });
}

accessControlRouter.post('/workspaces/:workspaceId/access-policies/preview', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = createWorkspaceEventAccessPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const preview = await previewWorkspaceAccessPolicy(actor, {
      workspaceId: String(req.params['workspaceId']),
      ...parsed.data,
    });
    res.json(preview);
  } catch (error) {
    sendAccessError(res, error);
  }
});

accessControlRouter.post('/workspaces/:workspaceId/access-policies', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = createWorkspaceEventAccessPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await createWorkspaceAccessPolicy(actor, {
      workspaceId: String(req.params['workspaceId']),
      ...parsed.data,
      audit: buildAuditRequestContext(req),
    });
    res.status(201).json(result);
  } catch (error) {
    sendAccessError(res, error);
  }
});

accessControlRouter.post('/workspaces/:workspaceId/access-policies/:policyId/revoke', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    await revokeWorkspaceAccessPolicy(actor, String(req.params['policyId']), buildAuditRequestContext(req));
    res.json({ ok: true });
  } catch (error) {
    sendAccessError(res, error);
  }
});

accessControlRouter.get('/events/:eventId/staff', async (req, res) => {
  const actor = (req as any).user as User;
  const eventId = String(req.params['eventId']);

  if (!(await canAccessEvent(actor, eventId, 'event.manageStaff'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const [grants, accesses] = await Promise.all([
    prisma.eventStaffGrant.findMany({
      where: { eventId, status: { not: 'REMOVED' } },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
        policy: { select: { id: true, workspaceId: true, status: true } },
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.eventStaffAccess.findMany({
      where: { eventId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    }),
  ]);

  res.json({ grants, accesses });
});

accessControlRouter.post('/events/:eventId/staff', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = createDirectEventStaffGrantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const targetUser = parsed.data.userId
    ? await prisma.user.findUnique({ where: { id: parsed.data.userId } })
    : await prisma.user.findUnique({ where: { email: normalizeEmail(parsed.data.email!) } });

  if (!targetUser) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  try {
    const grant = await createDirectEventStaffGrant(actor, {
      eventId: String(req.params['eventId']),
      userId: targetUser.id,
      role: parsed.data.role as EventStaffRole,
      reason: parsed.data.reason,
      audit: buildAuditRequestContext(req),
    });

    const access = await prisma.eventStaffAccess.findUnique({
      where: { eventId_userId: { eventId: grant.eventId, userId: grant.userId } },
    });

    res.status(201).json({ grant, access });
  } catch (error) {
    sendAccessError(res, error);
  }
});

accessControlRouter.patch('/events/:eventId/staff/grants/:grantId', async (req, res) => {
  const actor = (req as any).user as User;
  const eventId = String(req.params['eventId']);
  const grantId = String(req.params['grantId']);
  const parsed = updateEventStaffGrantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  if (!(await canAccessEvent(actor, eventId, 'event.manageStaff'))) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const grant = await tx.eventStaffGrant.findUnique({ where: { id: grantId } });
      if (!grant || grant.eventId !== eventId) throw new Error('GRANT_NOT_FOUND');

      if ((parsed.data.status === 'REMOVED' || parsed.data.status === 'DISABLED') && grant.role === 'OWNER') {
        await assertNotRemovingLastEventOwner(tx, eventId, grant.userId, grant.id);
      }

      const nextRole = parsed.data.role ?? grant.role;
      if (nextRole === 'OWNER' && grant.role !== 'OWNER' && !['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
        const actorAccess = await tx.eventStaffAccess.findUnique({
          where: { eventId_userId: { eventId, userId: actor.id } },
          select: { status: true, isOwner: true },
        });
        if (!(actorAccess?.status === 'ACTIVE' && actorAccess.isOwner)) {
          throw new Error('ONLY_OWNER_CAN_ASSIGN_OWNER');
        }
      }

      const nextGrant = await tx.eventStaffGrant.update({
        where: { id: grantId },
        data: {
          role: nextRole,
          status: parsed.data.status ?? grant.status,
          reason: parsed.data.reason !== undefined ? parsed.data.reason : grant.reason,
          disabledAt: parsed.data.status === 'DISABLED' ? new Date() : grant.disabledAt,
          removedAt: parsed.data.status === 'REMOVED' ? new Date() : grant.removedAt,
        },
      });

      await recalculateEventStaffAccess(tx, eventId, grant.userId);
      return nextGrant;
    });

    res.json({ grant: updated });
  } catch (error) {
    sendAccessError(res, error);
  }
});

accessControlRouter.delete('/events/:eventId/staff/grants/:grantId', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    await revokeEventStaffGrant(actor, String(req.params['grantId']), buildAuditRequestContext(req));
    res.json({ ok: true });
  } catch (error) {
    sendAccessError(res, error);
  }
});
