import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

import { adminEventsRouter } from './events.router.js';
import { adminParticipantsRouter } from './participants.router.js';
import { adminTeamsRouter } from './teams.router.js';
import { adminApplicationsRouter } from './applications.router.js';
import { adminUsersRouter } from './users.router.js';
import { adminAnalyticsRouter } from './analytics.router.js';
import { adminSupportRouter } from './support.router.js';
import { systemReportRouter } from './system-report.router.js';
import { profileConfigRouter } from '../profile-config/profile-config.router.js';
import { exportsRouter } from '../exports/exports.router.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

export const adminRouter = Router();

// Apply auth middleware to all admin routes
adminRouter.use(requireAuth);

// Mount all admin sub-routers
adminRouter.use('/events', adminEventsRouter);
adminRouter.use('/applications', adminApplicationsRouter);
adminRouter.use('/participants', adminParticipantsRouter);
adminRouter.use('/teams', adminTeamsRouter);
adminRouter.use('/support', adminSupportRouter);
adminRouter.use('/system-report', systemReportRouter);
adminRouter.use('/profile-fields', profileConfigRouter);
adminRouter.use('/exports', exportsRouter);

// Users routes on /users prefix
adminRouter.use('/users', adminUsersRouter);

// Analytics routes on /analytics prefix
adminRouter.use('/analytics', adminAnalyticsRouter);

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
export { adminEventsRouter, adminApplicationsRouter, adminParticipantsRouter, adminTeamsRouter, adminUsersRouter, adminAnalyticsRouter, adminSupportRouter, profileConfigRouter, exportsRouter };
