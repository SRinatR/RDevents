import type { AnalyticsEventType, AuthProvider, Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../../common/logger.js';

// Use a more permissive type that accepts both PrismaClient (normal) and
// TransactionClient (Omit<PrismaClient, ...>) which is passed inside $transaction callbacks.
// We cast to 'any' inside the function to bypass TypeScript's strict type checking,
// since Prisma's generated types don't fully reflect runtime capabilities.
type AnalyticsClient = Parameters<PrismaClient['$transaction']>[0] extends (tx: infer T) => any ? T : never;

export async function trackAnalyticsEvent(
  client: any,
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
    // Cast to 'any' because TransactionClient type doesn't expose model access at compile time
    // but at runtime it does. This is a TypeScript definition limitation with Prisma $transaction.
    const db = client as any;
    await db.analyticsEvent.create({
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
