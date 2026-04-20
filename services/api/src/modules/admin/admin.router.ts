import { Router } from 'express';
import { requireAuth } from '../../common/middleware.js';

// Re-export all admin routers
import { adminEventsRouter } from './events.router.js';
import { adminParticipantsRouter } from './participants.router.js';
import { adminTeamsRouter } from './teams.router.js';
import { adminApplicationsRouter } from './applications.router.js';
import { adminUsersRouter } from './users.router.js';
import { adminAnalyticsRouter } from './analytics.router.js';
import { adminSupportRouter } from './support.router.js';
import { profileConfigRouter } from '../profile-config/profile-config.router.js';

export const adminRouter = Router();

// Apply auth middleware to all admin routes
adminRouter.use(requireAuth);

// Mount all admin sub-routers
adminRouter.use('/events', adminEventsRouter);
adminRouter.use('/applications', adminApplicationsRouter);
adminRouter.use('/participants', adminParticipantsRouter);
adminRouter.use('/teams', adminTeamsRouter);
adminRouter.use('/support', adminSupportRouter);
adminRouter.use('/profile-fields', profileConfigRouter);
adminRouter.use('/', adminUsersRouter);
adminRouter.use('/', adminAnalyticsRouter);

// Re-export for convenience
export { adminEventsRouter, adminApplicationsRouter, adminParticipantsRouter, adminTeamsRouter, adminUsersRouter, adminAnalyticsRouter, adminSupportRouter };
