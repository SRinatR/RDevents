import type { Request, Response, NextFunction } from 'express';
import type { User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { verifyAccessToken } from './jwt.js';
import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';

const PLATFORM_ADMIN_ROLES: UserRole[] = ['PLATFORM_ADMIN', 'SUPER_ADMIN'];
const EVENT_ADMIN_STATUSES = ['ACTIVE'] as const;

export type AuthenticatedRequest = Request & { user?: User };

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = header.slice(7);
  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
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

// Request ID middleware - should be first in the chain
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).requestId;
  const user = (req as AuthenticatedRequest).user;
  const startTime = Date.now();

  logger.info('Request started', {
    action: 'request_started',
    requestId,
    userId: user?.id,
    meta: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const finishedUser = (req as AuthenticatedRequest).user;
    logger.info('Request finished', {
      action: 'request_finished',
      requestId,
      userId: finishedUser?.id,
      meta: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      },
    });
  });

  next();
}

// Improved error handler with safe error codes and logging
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).requestId;
  const user = (req as AuthenticatedRequest).user;

  if (res.headersSent) return next(err);

  // Determine error details
  const error = err instanceof Error ? err : new Error('Unknown error');
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let safeMessage = 'An unexpected error occurred';
  const prismaCode = typeof (error as any).code === 'string' ? (error as any).code : undefined;

  // Map known error types
  if (prismaCode?.startsWith('P10') || error.name === 'PrismaClientInitializationError') {
    statusCode = 503;
    errorCode = 'DATABASE_UNAVAILABLE';
    safeMessage = 'Service is temporarily unavailable';
  } else if (prismaCode === 'P2002' || error.message.includes('P2002')) {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    safeMessage = 'A record with this value already exists';
  } else if (prismaCode === 'P2025' || error.message.includes('P2025')) {
    statusCode = 404;
    errorCode = 'RECORD_NOT_FOUND';
    safeMessage = 'The requested record was not found';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'UPLOAD_ERROR';
    safeMessage = 'Uploaded file is invalid or too large';
  } else if (error.message.includes('validation')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    safeMessage = 'Invalid input data';
  }

  // Log the error with full context
  logger.error('Request error', error, {
    action: 'request_error',
    requestId,
    userId: user?.id,
    errorCode,
    meta: {
      method: req.method,
      path: req.path,
      statusCode,
    },
  });

  // Send safe error response to client
  res.status(statusCode).json({
    error: safeMessage,
    code: errorCode,
    requestId,
  });
}
