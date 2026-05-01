import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../common/middleware.js';
import { logger } from '../../common/logger.js';
import {
  createEmailBroadcastSchema,
  createEmailTemplateSchema,
  audienceEstimateSchema,
  audiencePreviewQuerySchema,
  emailPreviewSchema,
  emailRecipientsQuerySchema,
  emailTestSendSchema,
  emailMessagesQuerySchema,
  emailTemplatesQuerySchema,
  emailBroadcastsQuerySchema,
  emailAutomationsQuerySchema,
  emailDomainsQuerySchema,
  emailWebhooksQuerySchema,
  scheduleBroadcastSchema,
  sendBroadcastSchema,
  updateEmailBroadcastSchema,
  updateEmailTemplateSchema,
} from './admin-email.schemas.js';
import {
  archiveEmailTemplate,
  cancelEmailBroadcast,
  createEmailBroadcast,
  createEmailBroadcastSnapshot,
  createEmailTemplate,
  estimateEmailAudience,
  exportEmailBroadcastRecipientsCsv,
  getEmailBroadcast,
  getEmailBroadcastAnalytics,
  getEmailOverview,
  listEmailBroadcastRecipients,
  listEmailMessages,
  listEmailTemplates,
  listEmailBroadcasts,
  listEmailAutomations,
  getEmailAudience,
  listEmailDomains,
  getEmailWebhooks,
  previewEmailAudience,
  previewEmailContent,
  previewBroadcastContent,
  retryEmailBroadcastRecipient,
  scheduleEmailBroadcast,
  sendEmailBroadcast,
  sendTestEmail,
  sendBroadcastTestEmail,
  updateEmailBroadcast,
  updateEmailTemplate,
} from './admin-email.service.js';
import { previewManualRecipients, sendDirectEmailToUsers } from './email-direct.service.js';
import { z } from 'zod';

export const adminEmailRouter = Router();

// Common error handler wrapper with proper typing
function withErrorHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const requestId = (req as any).requestId ?? req.headers['x-request-id'] ?? 'unknown';
      const known = mapServiceError(errorMessage);

      if (known.status >= 500) {
        logger.error(`[admin-email] ${req.method} ${req.path} - ${errorMessage}`, error, {
          module: 'admin-email',
          action: 'request_error',
          requestId: String(requestId),
        });
      } else {
        logger.warn(`[admin-email] ${req.method} ${req.path} - ${errorMessage}`, {
          module: 'admin-email',
          action: 'request_error',
          requestId: String(requestId),
        });
      }

      res.status(known.status).json({
        error: known.message,
        code: known.code,
        requestId: String(requestId),
      });
    }
  };
}

function mapServiceError(message: string) {
  const code = message.split(':')[0] || 'INTERNAL_ERROR';

  const known: Record<string, [number, string]> = {
    FORBIDDEN: [403, 'Forbidden'],
    EVENT_SCOPED_AUDIENCE_REQUIRED: [403, 'Event-scoped audience is required for event admins'],

    EMAIL_BROADCAST_NOT_FOUND: [404, 'Broadcast not found'],
    EMAIL_RECIPIENT_NOT_FOUND: [404, 'Recipient not found'],

    EMAIL_BROADCAST_NOT_EDITABLE: [409, 'Broadcast is not editable'],
    EMAIL_BROADCAST_NOT_SENDABLE: [409, 'Broadcast is not sendable'],
    EMAIL_BROADCAST_NOT_CANCELLABLE: [409, 'Broadcast is not cancellable'],
    EMAIL_RECIPIENT_NOT_RETRYABLE: [409, 'Recipient is not retryable'],
    NO_FAILED_RECIPIENTS_TO_RETRY: [409, 'No failed recipients to retry'],

    EMAIL_SUBJECT_REQUIRED: [400, 'Subject is required'],
    EMAIL_TEXT_BODY_REQUIRED: [400, 'Text body is required'],
    EMAIL_HTML_BODY_REQUIRED: [400, 'HTML body is required'],
    UNSUBSCRIBE_URL_REQUIRED: [400, 'Marketing/event broadcasts must include {{unsubscribeUrl}} in HTML or text'],
    SCHEDULED_AT_IN_PAST: [400, 'scheduledAt must be in the future'],
    EMAIL_BROADCAST_MAX_RECIPIENTS_EXCEEDED: [400, 'Broadcast recipient limit exceeded'],

    EMAIL_TEST_SEND_RATE_LIMITED: [429, 'Test send rate limit exceeded'],
  };

  const [status, text] = known[code] ?? [500, 'Internal server error'];

  return {
    status,
    code,
    message: code === 'EMAIL_BROADCAST_MAX_RECIPIENTS_EXCEEDED'
      ? `${text}: ${message.split(':')[1] ?? ''}`.trim()
      : text,
  };
}

function requirePlatformAdminForMutation(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return false;
  }
  return true;
}

adminEmailRouter.use(requireAuth);

function requirePlatformAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as AuthenticatedRequest).user;

  if (!user || !['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    res.status(403).json({
      error: 'Forbidden',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
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

adminEmailRouter.post('/templates', withErrorHandler(async (req, res) => {
  if (!requirePlatformAdminForMutation(req, res)) return;
  const parsed = createEmailTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const user = (req as AuthenticatedRequest).user;
  const template = await createEmailTemplate(parsed.data, user?.id);
  res.status(201).json({ data: template });
}));

adminEmailRouter.patch('/templates/:id', withErrorHandler(async (req, res) => {
  if (!requirePlatformAdminForMutation(req, res)) return;
  const parsed = updateEmailTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const user = (req as AuthenticatedRequest).user;
  const template = await updateEmailTemplate(String(req.params['id']), parsed.data, user?.id);
  res.json({ data: template });
}));

adminEmailRouter.post('/templates/:id/archive', withErrorHandler(async (req, res) => {
  if (!requirePlatformAdminForMutation(req, res)) return;
  const user = (req as AuthenticatedRequest).user;
  const template = await archiveEmailTemplate(String(req.params['id']), user?.id);
  res.json({ data: template });
}));

// ─── GET /api/admin/email/broadcasts ───────────────────────────────────────────

adminEmailRouter.get('/broadcasts', withErrorHandler(async (req, res) => {
  const parsed = emailBroadcastsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const result = await listEmailBroadcasts(user, parsed.data);
  res.json(result);
}));

adminEmailRouter.post('/broadcasts', withErrorHandler(async (req, res) => {
  const parsed = createEmailBroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const user = (req as AuthenticatedRequest).user;
  const broadcast = await createEmailBroadcast(parsed.data, user);
  res.status(201).json({ data: broadcast });
}));

adminEmailRouter.post('/broadcasts/:id/send', withErrorHandler(async (req, res) => {
  const parsed = sendBroadcastSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const broadcast = await sendEmailBroadcast(String(req.params['id']), parsed.data, user);
  res.json({ data: broadcast });
}));

adminEmailRouter.get('/broadcasts/:id', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const data = await getEmailBroadcast(String(req.params['id']), user);
  res.json(data);
}));

adminEmailRouter.patch('/broadcasts/:id', withErrorHandler(async (req, res) => {
  const parsed = updateEmailBroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const broadcast = await updateEmailBroadcast(String(req.params['id']), parsed.data, user);
  res.json({ data: broadcast });
}));

adminEmailRouter.post('/broadcasts/:id/snapshot', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const broadcast = await createEmailBroadcastSnapshot(String(req.params['id']), user);
  res.json({ data: broadcast });
}));

adminEmailRouter.post('/broadcasts/:id/schedule', withErrorHandler(async (req, res) => {
  const parsed = scheduleBroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const broadcast = await scheduleEmailBroadcast(String(req.params['id']), parsed.data, user);
  res.json({ data: broadcast });
}));

adminEmailRouter.post('/broadcasts/:id/cancel', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const broadcast = await cancelEmailBroadcast(String(req.params['id']), user);
  res.json({ data: broadcast });
}));

adminEmailRouter.get('/broadcasts/:id/recipients', withErrorHandler(async (req, res) => {
  const parsed = emailRecipientsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const result = await listEmailBroadcastRecipients(String(req.params['id']), parsed.data, user);
  res.json(result);
}));

adminEmailRouter.get('/broadcasts/:id/recipients/export.csv', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const csv = await exportEmailBroadcastRecipientsCsv(String(req.params['id']), user);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="broadcast-${String(req.params['id'])}-recipients.csv"`);
  res.send(csv);
}));

adminEmailRouter.post('/broadcasts/:id/recipients/:recipientId/retry', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const broadcast = await retryEmailBroadcastRecipient(String(req.params['id']), String(req.params['recipientId']), user);
  res.json({ data: broadcast });
}));

adminEmailRouter.get('/broadcasts/:id/analytics', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const analytics = await getEmailBroadcastAnalytics(String(req.params['id']), user);
  res.json(analytics);
}));

adminEmailRouter.post('/audience/estimate', withErrorHandler(async (req, res) => {
  const parsed = audienceEstimateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const result = await estimateEmailAudience(parsed.data, user);
  res.json(result);
}));

adminEmailRouter.post('/audience/preview', withErrorHandler(async (req, res) => {
  const body = audienceEstimateSchema.safeParse(req.body);
  const query = audiencePreviewQuerySchema.safeParse(req.query);
  if (!body.success || !query.success) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  const result = await previewEmailAudience(body.data, query.data, user);
  res.json(result);
}));

adminEmailRouter.post('/preview', withErrorHandler(async (req, res) => {
  const parsed = emailPreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }
  res.json(await previewBroadcastContent(id, { ...parsed.data, recipientId: req.body?.recipientId }, user));
}));

adminEmailRouter.post('/test-send', withErrorHandler(async (req, res) => {
  const parsed = emailTestSendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthenticatedRequest).user;
  res.json(await sendBroadcastTestEmail(String(req.params['id']), parsed.data, user));
}));

adminEmailRouter.post('/broadcasts/:id/audience-preview', withErrorHandler(async (req, res) => {
  const id = String(req.params['id']);
  const user = (req as AuthenticatedRequest).user;
  const current = await getEmailBroadcast(id, user);
  const body = audienceEstimateSchema.safeParse({
    broadcastType: req.body?.broadcastType ?? current.broadcast.type,
    audienceKind: req.body?.audienceKind ?? current.broadcast.audienceKind,
    audienceSource: req.body?.audienceSource ?? current.broadcast.audienceSource,
    audienceFilterJson: req.body?.audienceFilterJson ?? current.broadcast.audienceFilterJson,
    savedAudienceId: req.body?.savedAudienceId ?? null,
  });
  if (!body.success) return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
  const result = await previewEmailAudience(body.data, { page: 1, limit: 200 }, user);
  res.json({
    totalSelected: result.totals.totalMatched,
    willSend: result.totals.totalEligible,
    skipped: result.totals.totalSkipped,
    skippedByReason: result.totals.skippedByReason,
    recipients: result.data,
  });
}));

adminEmailRouter.post('/broadcasts/:id/preview', withErrorHandler(async (req, res) => {
  const id = String(req.params['id']);
  const user = (req as AuthenticatedRequest).user;
  const current = await getEmailBroadcast(id, user);
  const parsed = emailPreviewSchema.safeParse({
    subject: req.body?.subject ?? current.broadcast.subject,
    preheader: req.body?.preheader ?? current.broadcast.preheader,
    textBody: req.body?.textBody ?? current.broadcast.textBody,
    htmlBody: req.body?.htmlBody ?? current.broadcast.htmlBody,
    sampleVariables: req.body?.sampleVariables ?? {},
  });
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  res.json(await previewEmailContent(parsed.data));
}));

adminEmailRouter.post('/broadcasts/:id/send-test', withErrorHandler(async (req, res) => {
  const parsed = emailTestSendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  const user = (req as AuthenticatedRequest).user;
  res.json(await sendTestEmail(parsed.data, user));
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

adminEmailRouter.get('/webhooks', withErrorHandler(async (req, res) => {
  const parsed = emailWebhooksQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const webhooks = await getEmailWebhooks(parsed.data);
  res.json(webhooks);
}));

// ─── POST /api/admin/email/recipients/preview ───────────────────────────────────

const manualRecipientsPreviewSchema = z.object({
  selectedUserIds: z.array(z.string()).min(1),
  excludedUserIds: z.array(z.string()).optional().default([]),
  emailType: z.enum(['ADMIN_DIRECT', 'SYSTEM_NOTIFICATION', 'MARKETING']).default('ADMIN_DIRECT'),
  respectConsent: z.boolean().default(false),
  eventId: z.string().optional(),
});

adminEmailRouter.post('/recipients/preview', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  if (!user || !['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const parsed = manualRecipientsPreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await previewManualRecipients({
      selectedUserIds: parsed.data.selectedUserIds,
      excludedUserIds: parsed.data.excludedUserIds,
      emailType: parsed.data.emailType,
      respectConsent: parsed.data.respectConsent,
      eventId: parsed.data.eventId,
    });

    res.json(result);
  } catch (err: any) {
    const code = err instanceof Error ? err.message : String(err);
    const [status, message] = mapDirectEmailError(code);
    res.status(status).json({ error: message, code });
  }
}));

// ─── POST /api/admin/email/direct ──────────────────────────────────────────────

const sendDirectEmailSchema = z.object({
  selectedUserIds: z.array(z.string()).min(1),
  excludedUserIds: z.array(z.string()).optional().default([]),
  subject: z.string().min(1).max(200),
  preheader: z.string().max(220).optional().nullable(),
  text: z.string().max(100_000).optional().nullable(),
  html: z.string().max(200_000).optional().nullable(),
  emailType: z.enum(['ADMIN_DIRECT', 'SYSTEM_NOTIFICATION', 'MARKETING']).default('ADMIN_DIRECT'),
  reason: z.string().min(1).max(1000),
  respectConsent: z.boolean().default(false),
  eventId: z.string().optional().nullable(),
});

adminEmailRouter.post('/direct', withErrorHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  if (!user || !['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }

  const parsed = sendDirectEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await sendDirectEmailToUsers({
      actorUserId: user.id,
      eventId: parsed.data.eventId ?? null,
      selectedUserIds: parsed.data.selectedUserIds,
      excludedUserIds: parsed.data.excludedUserIds,
      subject: parsed.data.subject,
      preheader: parsed.data.preheader ?? null,
      text: parsed.data.text ?? null,
      html: parsed.data.html ?? null,
      emailType: parsed.data.emailType,
      reason: parsed.data.reason,
      respectConsent: parsed.data.respectConsent,
    });

    res.json(result);
  } catch (err: any) {
    const code = err instanceof Error ? err.message : String(err);
    const [status, message] = mapDirectEmailError(code);
    res.status(status).json({ error: message, code });
  }
}));

function mapDirectEmailError(code: string): [number, string] {
  const map: Record<string, [number, string]> = {
    FORBIDDEN: [403, 'Forbidden'],
    RECIPIENTS_REQUIRED: [400, 'Recipients are required'],
    SUBJECT_REQUIRED: [400, 'Subject is required'],
    EMAIL_CONTENT_REQUIRED: [400, 'Text or HTML is required'],
    REASON_REQUIRED: [400, 'Reason is required'],
    TOO_MANY_RECIPIENTS: [400, 'Too many recipients'],
    EMAIL_DELIVERY_NOT_CONFIGURED: [503, 'Email delivery is not configured'],
    EMAIL_SENDER_NOT_CONFIGURED: [503, 'Email sender is not configured'],
  };

  return map[code] ?? [500, 'Internal error'];
}
