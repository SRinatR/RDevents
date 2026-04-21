import { Router, raw } from 'express';
import { Webhook } from 'svix';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    subject?: string;
  };
};

export const resendWebhookRouter = Router();

resendWebhookRouter.post('/', raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
  const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  if (!payload) {
    res.status(400).json({ error: 'Webhook payload is required' });
    return;
  }

  if (!env.RESEND_WEBHOOK_SECRET) {
    logger.warn('Resend webhook received without configured signing secret', {
      action: 'resend_webhook_not_configured',
      meta: {
        hasSvixHeaders: Boolean(req.header('svix-id') && req.header('svix-timestamp') && req.header('svix-signature')),
      },
    });
    res.status(503).json({ error: 'Resend webhook is not configured', code: 'RESEND_WEBHOOK_NOT_CONFIGURED' });
    return;
  }

  const svixId = req.header('svix-id');
  const svixTimestamp = req.header('svix-timestamp');
  const svixSignature = req.header('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing Resend webhook signature headers' });
    return;
  }

  let event: ResendWebhookEvent;
  try {
    event = new Webhook(env.RESEND_WEBHOOK_SECRET).verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent;
  } catch (error) {
    logger.warn('Invalid Resend webhook signature', {
      action: 'resend_webhook_invalid_signature',
      meta: { svixId },
    });
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  logger.info('Resend webhook accepted', {
    action: 'resend_webhook_received',
    meta: {
      svixId,
      type: event.type ?? 'unknown',
      createdAt: event.created_at ?? null,
      emailId: event.data?.email_id ?? null,
    },
  });

  res.status(202).json({ received: true });
});
