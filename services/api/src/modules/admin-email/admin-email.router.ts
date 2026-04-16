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

adminEmailRouter.use(requirePlatformAdmin);

// ─── GET /api/admin/email/overview ────────────────────────────────────────────

adminEmailRouter.get('/overview', async (_req, res) => {
  try {
    const overview = await getEmailOverview();
    res.json(overview);
  } catch (error) {
    console.error('Email overview error:', error);
    res.status(500).json({ error: 'Failed to fetch email overview' });
  }
});

// ─── GET /api/admin/email/messages ─────────────────────────────────────────────

adminEmailRouter.get('/messages', async (req, res) => {
  try {
    const parsed = emailMessagesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }
    const result = await listEmailMessages(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Email messages error:', error);
    res.status(500).json({ error: 'Failed to fetch email messages' });
  }
});

// ─── GET /api/admin/email/templates ────────────────────────────────────────────

adminEmailRouter.get('/templates', async (req, res) => {
  try {
    const parsed = emailTemplatesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }
    const result = await listEmailTemplates(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Email templates error:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// ─── GET /api/admin/email/broadcasts ───────────────────────────────────────────

adminEmailRouter.get('/broadcasts', async (req, res) => {
  try {
    const parsed = emailBroadcastsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }
    const result = await listEmailBroadcasts(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Email broadcasts error:', error);
    res.status(500).json({ error: 'Failed to fetch email broadcasts' });
  }
});

// ─── GET /api/admin/email/automations ─────────────────────────────────────────

adminEmailRouter.get('/automations', async (req, res) => {
  try {
    const parsed = emailAutomationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }
    const result = await listEmailAutomations(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Email automations error:', error);
    res.status(500).json({ error: 'Failed to fetch email automations' });
  }
});

// ─── GET /api/admin/email/audience ─────────────────────────────────────────────

adminEmailRouter.get('/audience', async (_req, res) => {
  try {
    const audience = await getEmailAudience();
    res.json(audience);
  } catch (error) {
    console.error('Email audience error:', error);
    res.status(500).json({ error: 'Failed to fetch email audience' });
  }
});

// ─── GET /api/admin/email/domains ──────────────────────────────────────────────

adminEmailRouter.get('/domains', async (req, res) => {
  try {
    const parsed = emailDomainsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }
    const result = await listEmailDomains(parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Email domains error:', error);
    res.status(500).json({ error: 'Failed to fetch email domains' });
  }
});

// ─── GET /api/admin/email/webhooks ─────────────────────────────────────────────

adminEmailRouter.get('/webhooks', async (req, res) => {
  try {
    const parsed = emailWebhooksQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
      return;
    }
    const webhooks = await getEmailWebhooks();
    res.json(webhooks);
  } catch (error) {
    console.error('Email webhooks error:', error);
    res.status(500).json({ error: 'Failed to fetch email webhooks' });
  }
});