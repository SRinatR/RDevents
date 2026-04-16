import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
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

// Common error handler wrapper
function withErrorHandler(handler: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[admin-email]', req.path, error);
      res.status(500).json({ error: 'Internal server error' });
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
