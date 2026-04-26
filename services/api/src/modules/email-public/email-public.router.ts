import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { verifyUnsubscribeToken } from '../email/unsubscribe-token.service.js';
import { normalizeEmail } from '@event-platform/shared';

export const emailPublicRouter = Router();

emailPublicRouter.post('/unsubscribe', async (req, res) => {
  const token = String(req.body?.token ?? '');

  if (!token) {
    res.status(400).json({ error: 'Token is required', code: 'TOKEN_REQUIRED' });
    return;
  }

  try {
    const payload = verifyUnsubscribeToken(token);
    const normalizedEmail = normalizeEmail(payload.email);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const user = payload.userId
        ? await tx.user.findUnique({ where: { id: payload.userId } })
        : await tx.user.findUnique({ where: { email: payload.email } });

      if (user) {
        await tx.userCommunicationConsent.upsert({
          where: {
            userId_channel_topic: {
              userId: user.id,
              channel: 'EMAIL' as any,
              topic: 'MARKETING' as any,
            },
          },
          update: {
            status: 'OPTED_OUT' as any,
            optedOutAt: now,
            lastChangedAt: now,
          },
          create: {
            userId: user.id,
            channel: 'EMAIL' as any,
            topic: 'MARKETING' as any,
            status: 'OPTED_OUT' as any,
            optedOutAt: now,
            lastChangedAt: now,
          },
        });
      }

      await tx.emailSuppression.upsert({
        where: {
          normalizedEmail,
        },
        update: {
          reason: 'UNSUBSCRIBED' as any,
          source: 'UNSUBSCRIBE_LINK',
          updatedAt: now,
        },
        create: {
          email: payload.email,
          normalizedEmail,
          reason: 'UNSUBSCRIBED' as any,
          source: 'UNSUBSCRIBE_LINK',
        },
      });

      if (payload.broadcastId) {
        await tx.emailBroadcastEvent.create({
          data: {
            broadcastId: payload.broadcastId,
            type: 'UNSUBSCRIBED' as any,
            actorUserId: user?.id ?? null,
            payloadJson: {
              email: payload.email,
              normalizedEmail,
            } as any,
          },
        });
      }
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({
      error: 'Invalid or expired unsubscribe token',
      code: 'INVALID_UNSUBSCRIBE_TOKEN',
    });
  }
});
