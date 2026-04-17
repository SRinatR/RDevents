import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

export interface SessionInfo {
  userId: string;
  sessionId: string;
  tokenHash: string;
}

/** Hash a refresh token so only the hash is stored in the DB */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new refresh session and optionally rotate from an old session.
 *
 * Rotation chain (CRITICAL):
 *   1. INSERT new session → get newSession.id (cuid)
 *   2. UPDATE old session: replacedById = newSession.id (cuid, NOT jti)
 *
 * If `previousTokenHash` is null, creates a brand new session (login / registration).
 * If `previousTokenHash` is provided, rotates: old session is revoked and replaced by new one.
 *
 * Returns { token, sessionId }.
 */
export async function createSession(
  userId: string,
  context: { ipAddress?: string; userAgent?: string; deviceInfo?: string },
  previousTokenHash?: string | null
): Promise<{ token: string; sessionId: string }> {
  // 1. Generate new token and hash
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);

  // 2. INSERT new session — get its id BEFORE updating old session
  const newSession = await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      deviceInfo: context.deviceInfo ?? null,
    },
  });

  // newSession.id is a cuid — this is what we store in replacedById

  // 3. If rotating from an existing session, revoke it and link it to the new one
  if (previousTokenHash) {
    await prisma.refreshSession.update({
      where: { tokenHash: previousTokenHash },
      data: {
        revokedAt: new Date(),
        replacedById: newSession.id, // store cuid, NOT jti
      },
    });
  }

  return { token, sessionId: newSession.id };
}

/**
 * Verify a refresh token:
 *   - Must exist in DB (hash match)
 *   - Must not be expired
 *   - Must not have been revoked
 *
 * Reuse detection: if the session is already revoked (revokedAt != null),
 * revoke ALL active sessions for this user (token compromise).
 */
export async function verifySession(
  token: string
): Promise<{ userId: string; sessionId: string }> {
  const tokenHash = hashToken(token);

  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
  });

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  // Reuse detection: if session was already revoked, someone stole the token
  if (session.revokedAt) {
    // Revoke all active sessions for this user — they may all be compromised
    await prisma.refreshSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new Error('SESSION_REVOKED_REUSE_DETECTED');
  }

  // Token expired (DB-level check)
  if (session.expiresAt.getTime() < Date.now()) {
    throw new Error('SESSION_EXPIRED');
  }

  return { userId: session.userId, sessionId: session.id };
}

/**
 * Revoke a single session by its token hash.
 * Used for logout (current session) and logout-all (all sessions).
 */
export async function revokeSession(tokenHash: string): Promise<void> {
  await prisma.refreshSession.update({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all active sessions for a user.
 * Used when a refresh token is reused (compromise detected) and for logout-all.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all sessions EXCEPT the current one (identified by sessionId).
 * Used for "logout everywhere except current device".
 */
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      id: { not: currentSessionId },
    },
    data: { revokedAt: new Date() },
  });
}