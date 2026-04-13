import type { Request, Response, NextFunction } from 'express';
import type { User, UserRole } from '@prisma/client';
import { verifyAccessToken } from './jwt.js';
import { prisma } from '../db/prisma.js';

const PLATFORM_ADMIN_ROLES: UserRole[] = ['PLATFORM_ADMIN', 'SUPER_ADMIN'];
const EVENT_ADMIN_STATUSES = ['ACTIVE', 'APPROVED'] as const;

export type AuthenticatedRequest = Request & { user?: User };

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Backwards-compatible name used by existing routers.
export const authenticate = requireAuth;

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user?.isActive) (req as AuthenticatedRequest).user = user;
  } catch {
    // Public routes should not fail just because an optional token is stale.
  }

  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export const requireSuperAdmin = requireRole('SUPER_ADMIN');
export const requirePlatformAdmin = requireRole(...PLATFORM_ADMIN_ROLES);

// Backwards-compatible alias. Event-admin access is checked with requireEventAdmin.
export const requireAdmin = requirePlatformAdmin;

export async function canManageEvent(user: User, eventId: string) {
  if (PLATFORM_ADMIN_ROLES.includes(user.role)) return true;

  const membership = await prisma.eventMember.findFirst({
    where: {
      eventId,
      userId: user.id,
      role: 'EVENT_ADMIN',
      status: { in: [...EVENT_ADMIN_STATUSES] },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export function requireEventAdmin(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    const eventId = req.params[paramName] ?? req.params['eventId'] ?? req.params['id'];

    if (!user || !eventId || !(await canManageEvent(user, String(eventId)))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  if (res.headersSent) return next(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
}
