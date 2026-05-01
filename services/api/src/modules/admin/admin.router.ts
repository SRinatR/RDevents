import { Router } from 'express';
import { AuditAction, Prisma } from '@prisma/client';
import { requireAuth, requirePlatformAdmin, requireSuperAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

import { adminEventsRouter } from './events.router.js';
import { adminParticipantsRouter } from './participants.router.js';
import { adminTeamsRouter } from './teams.router.js';
import { adminApplicationsRouter } from './applications.router.js';
import { adminUsersRouter } from './users.router.js';
import { adminAnalyticsRouter } from './analytics.router.js';
import { adminSupportRouter } from './support.router.js';
import { systemReportsRouter } from '../system-reports/system-reports.router.js';
import { profileConfigRouter } from '../profile-config/profile-config.router.js';
import { exportsRouter } from '../exports/exports.router.js';
import { workspacesRouter } from '../workspaces/workspaces.router.js';
import { organizationMapRouter } from '../organization-map/organization-map.router.js';
import { accessControlRouter } from '../access-control/access-control.router.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const AUDIT_ACTION_VALUES = new Set<string>(Object.values(AuditAction));

export const adminRouter = Router();

// Apply auth middleware to all admin routes
adminRouter.use(requireAuth);

// Mount all admin sub-routers
adminRouter.use('/events', adminEventsRouter);
adminRouter.use('/applications', adminApplicationsRouter);
adminRouter.use('/participants', adminParticipantsRouter);
adminRouter.use('/teams', adminTeamsRouter);
adminRouter.use('/support', adminSupportRouter);
adminRouter.use('/system-reports', systemReportsRouter);
adminRouter.use('/profile-fields', profileConfigRouter);
adminRouter.use('/exports', exportsRouter);
adminRouter.use('/workspaces', workspacesRouter);
adminRouter.use(organizationMapRouter);
adminRouter.use(accessControlRouter);

// Users routes on /users prefix
adminRouter.use('/users', adminUsersRouter);

// Analytics routes on /analytics prefix
adminRouter.use('/analytics', adminAnalyticsRouter);

// GET /api/admin/audit - real platform audit log entries
adminRouter.get('/audit', requirePlatformAdmin, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  const limitValue = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 250) : 100;

  if (action && !AUDIT_ACTION_VALUES.has(action)) {
    res.status(400).json({ error: 'Invalid audit action' });
    return;
  }

  const where: Prisma.AuditLogWhereInput = {};

  if (action) {
    where.action = action as AuditAction;
  }

  if (search) {
    const normalizedAction = search.toUpperCase().replace(/\s+/g, '_');
    const or: Prisma.AuditLogWhereInput[] = [
      { actor: { is: { email: { contains: search, mode: 'insensitive' } } } },
      { targetUser: { is: { email: { contains: search, mode: 'insensitive' } } } },
      { workspaceId: { contains: search } },
      { eventId: { contains: search } },
      { targetUserId: { contains: search } },
      { requestId: { contains: search } },
    ];

    if (AUDIT_ACTION_VALUES.has(normalizedAction)) {
      or.push({ action: normalizedAction as AuditAction });
    }

    where.OR = or;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { id: true, email: true, name: true } },
      targetUser: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({
    data: logs.map((log) => {
      const entity = log.eventId ? 'Event' : log.workspaceId ? 'Workspace' : log.targetUserId ? 'User' : 'System';
      const entityId = log.eventId ?? log.workspaceId ?? log.targetUserId ?? log.id;

      return {
        id: log.id,
        actor: log.actor?.email ?? 'system',
        actorName: log.actor?.name ?? null,
        action: log.action,
        entity,
        entityId,
        targetUserEmail: log.targetUser?.email ?? null,
        timestamp: log.createdAt.toISOString(),
        status: 'success',
      };
    }),
    meta: { limit, total: logs.length },
  });
});

// GET /api/admin/admins - список всех админов (platform + event admins)
adminRouter.get('/admins', requireSuperAdmin, async (_req, res) => {
  const [admins, eventAdmins] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, isActive: true, registeredAt: true },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.eventMember.findMany({
      where: { role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
        event: { select: { id: true, slug: true, title: true, status: true } },
        assignedByUser: { select: { id: true, email: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  res.json({ admins, platformAdmins: admins, eventAdmins });
});

// Re-export for convenience
export { adminEventsRouter, adminApplicationsRouter, adminParticipantsRouter, adminTeamsRouter, adminUsersRouter, adminAnalyticsRouter, adminSupportRouter, profileConfigRouter, exportsRouter, systemReportsRouter };
