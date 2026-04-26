import type { AuditAction, Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../../common/middleware.js';

type AuditTx = Pick<Prisma.TransactionClient, 'auditLog'>;

export interface AuditLogInput {
  actorUserId?: string | null;
  action: AuditAction;
  workspaceId?: string | null;
  eventId?: string | null;
  targetUserId?: string | null;
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
  meta?: Prisma.InputJsonValue | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function buildAuditRequestContext(req: Request) {
  return {
    actorUserId: (req as AuthenticatedRequest).user?.id ?? null,
    requestId: (req as any).requestId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

export async function writeAuditLog(tx: AuditTx, input: AuditLogInput) {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      workspaceId: input.workspaceId ?? null,
      eventId: input.eventId ?? null,
      targetUserId: input.targetUserId ?? null,
      beforeJson: input.beforeJson ?? undefined,
      afterJson: input.afterJson ?? undefined,
      meta: input.meta ?? undefined,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
