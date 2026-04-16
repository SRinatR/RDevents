import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
import { logger } from '../../common/logger.js';
import {
  emailMessagesQuerySchema,
  emailTemplatesQuerySchema,
  emailBroadcastsQuerySchema,
  emailAutomationsQuerySchema,
  emailDomainsQuerySchema,
  emailWebhooksQuerySchema,
} from './admin-email.schemas.js';
import {
  getEmailOverview,
  listEmailMessages,
  listEmailTemplates,
  listEmailBroadcasts,
  listEmailAutomations,
  getEmailAudience,
  listEmailDomains,
  getEmailWebhooks,
} from './admin-email.service.js';

export const adminEmailRouter = Router();

// Typed request/response
import type { Request, Response } from 'express';

// Common error handler wrapper with proper typing
function withErrorHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const requestId = (req as any).requestId ?? req.headers['x-request-id'] ?? 'unknown';
      
      logger.error(`[admin-email] ${req.method} ${req.path} - ${errorMessage}`, error, {
        module: 'admin-email',
        action: 'request_error',
        requestId: String(requestId),
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        requestId: String(requestId),
      });
    }
  };
}

adminEmailRouter.use(requirePlatformAdmin);

// ─── GET /api/admin/email/overview ────────────────────────────────────────────

adminEmailRouter.get('/overview', withErrorHandler(async (_req, res) => {
  const overview = await getEmailOverview();
  res.json(overview);
}));

// ─── GET /api/admin/email/messages ─────────────────────────────────────────────

adminEmailRouter.get('/messages', withErrorHandler(async (req, res) => {
  const parsed = emailMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const result = await listEmailMessages(parsed.data);
  res.json(result);
}));

// ─── GET /api/admin/email/templates ───────────────────────────────────────────

adminEmailRouter.get('/templates', withErrorHandler(async (req, res) => {
  const parsed = emailTemplatesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const result = await listEmailTemplates(parsed.data);
  res.json(result);
}));

// ─── GET /api/admin/email/broadcasts ───────────────────────────────────────────

adminEmailRouter.get('/broadcasts', withErrorHandler(async (req, res) => {
  const parsed = emailBroadcastsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const result = await listEmailBroadcasts(parsed.data);
  res.json(result);
}));

// ─── GET /api/admin/email/automations ─────────────────────────────────────────

adminEmailRouter.get('/automations', withErrorHandler(async (req, res) => {
  const parsed = emailAutomationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const result = await listEmailAutomations(parsed.data);
  res.json(result);
}));

// ─── GET /api/admin/email/audience ─────────────────────────────────────────────

adminEmailRouter.get('/audience', withErrorHandler(async (_req, res) => {
  const audience = await getEmailAudience();
  res.json(audience);
}));

// ─── GET /api/admin/email/domains ──────────────────────────────────────────────

adminEmailRouter.get('/domains', withErrorHandler(async (req, res) => {
  const parsed = emailDomainsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const result = await listEmailDomains(parsed.data);
  res.json(result);
}));

// ─── GET /api/admin/email/webhooks ─────────────────────────────────────────────

adminEmailRouter.get('/webhooks', withErrorHandler(async (_req, res) => {
  const webhooks = await getEmailWebhooks();
  res.json(webhooks);
}));
