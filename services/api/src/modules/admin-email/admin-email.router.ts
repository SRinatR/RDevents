import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
import { env } from '../../config/env.js';

export const adminEmailRouter = Router();

// All email admin endpoints return 501 as the module is not implemented yet.
// Real email management (broadcasts, automations, etc.) is not available.

adminEmailRouter.use(requirePlatformAdmin);

function notImplementedHandler(_req: any, res: any) {
  res.status(501).json({
    error: 'EMAIL_ADMIN_NOT_IMPLEMENTED',
    message: 'Email administration module is not available yet.',
  });
}

// All routes return 501
adminEmailRouter.get('/overview', notImplementedHandler);
adminEmailRouter.get('/messages', notImplementedHandler);
adminEmailRouter.get('/templates', notImplementedHandler);
adminEmailRouter.get('/broadcasts', notImplementedHandler);
adminEmailRouter.get('/automations', notImplementedHandler);
adminEmailRouter.get('/audience', notImplementedHandler);
adminEmailRouter.get('/domains', notImplementedHandler);
adminEmailRouter.get('/webhooks', notImplementedHandler);
