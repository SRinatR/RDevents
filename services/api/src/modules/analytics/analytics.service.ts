import type { AnalyticsEventType, AuthProvider, Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../../common/logger.js';

type AnalyticsClient = PrismaClient | Prisma.TransactionClient;

export async function trackAnalyticsEvent(
  client: AnalyticsClient,
  input: {
    type: AnalyticsEventType;
    userId?: string | null;
    eventId?: string | null;
    authProvider?: AuthProvider | null;
    sessionId?: string | null;
    locale?: string | null;
    path?: string | null;
    meta?: Prisma.InputJsonValue | null;
  }
) {
  try {
    await client.analyticsEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        eventId: input.eventId ?? null,
        authProvider: input.authProvider ?? null,
        sessionId: input.sessionId ?? null,
        locale: input.locale ?? null,
        path: input.path ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (error) {
    logger.warn('Analytics event was not recorded', {
      action: 'analytics_write_failed',
      userId: input.userId ?? undefined,
      eventId: input.eventId ?? undefined,
      meta: {
        type: input.type,
        error: error instanceof Error ? error.message : 'unknown',
      },
    });
  }
}
