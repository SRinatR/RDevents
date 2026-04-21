import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { hashPassword } from '../../common/password.js';
import { prisma } from '../../db/prisma.js';
import { revokeAllUserSessions } from '../auth/auth.sessions.js';
import { sendPasswordResetEmail } from '../../common/email.js';
import { logger } from '../../common/logger.js';
import { env } from '../../config/env.js';
import type {
  RequestPasswordResetInput,
  ResetPasswordInput,
} from './password-reset.schemas.js';

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const PASSWORD_RESET_TOKEN_LENGTH = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(PASSWORD_RESET_TOKEN_LENGTH).toString('hex');
}

export async function requestPasswordReset(
  input: RequestPasswordResetInput,
  context: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      name: true,
    },
  });

  if (!user) {
    logger.info('Password reset requested for non-existent email', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_REQUESTED',
      meta: { email: input.email },
    });
    return { success: true };
  }

  if (!user.passwordHash) {
    logger.info('Password reset requested for social-only account', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_REJECTED',
      meta: { email: input.email, reason: 'social_only_account' },
    });
    return { success: true };
  }

  await invalidateExistingResetTokens(user.id);

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      requestedIp: context.ipAddress ?? null,
      requestedUa: context.userAgent ?? null,
    },
  });

  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name ?? user.email,
      resetUrl,
      expiresAt: expiresAt.toISOString(),
      ipHint: context.ipAddress ?? undefined,
      supportContact: env.SUPPORT_EMAIL ?? undefined,
    });

    logger.info('Password reset email sent', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_REQUESTED',
      userId: user.id,
      meta: {
        email: user.email,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to send password reset email', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_EMAIL_FAILED',
      userId: user.id,
      meta: {
        email: user.email,
        reason: error instanceof Error ? error.message : String(error),
      },
    });

    if (!env.isDev) {
      throw error;
    }
  }

  return { success: true };
}

export async function verifyPasswordResetToken(token: string): Promise<{ valid: boolean; userId?: string; reason?: string }> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken) {
    logger.info('Password reset token not found', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_VERIFY_FAILED',
      meta: { reason: 'token_not_found' },
    });
    return { valid: false, reason: 'Token not found' };
  }

  if (resetToken.usedAt) {
    logger.info('Password reset token already used', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_VERIFY_FAILED',
      meta: { reason: 'token_already_used' },
    });
    return { valid: false, reason: 'Token has already been used' };
  }

  if (resetToken.expiresAt < now) {
    logger.info('Password reset token expired', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_VERIFY_FAILED',
      meta: { reason: 'token_expired' },
    });
    return { valid: false, reason: 'Token has expired' };
  }

  return { valid: true, userId: resetToken.userId };
}

export async function resetPassword(
  input: ResetPasswordInput,
  context: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  const tokenHash = hashToken(input.token);
  const now = new Date();

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken) {
    logger.warn('Password reset attempted with invalid token', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_REJECTED',
      meta: { reason: 'token_not_found' },
    });
    throw new Error('INVALID_TOKEN');
  }

  if (resetToken.usedAt) {
    logger.warn('Password reset attempted with already used token', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_REJECTED',
      meta: { reason: 'token_already_used' },
    });
    throw new Error('TOKEN_ALREADY_USED');
  }

  if (resetToken.expiresAt < now) {
    logger.warn('Password reset attempted with expired token', {
      module: 'password-reset',
      action: 'PASSWORD_RESET_REJECTED',
      meta: { reason: 'token_expired' },
    });
    throw new Error('TOKEN_EXPIRED');
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash },
    });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        usedAt: now,
        consumedIp: context.ipAddress ?? null,
        consumedUa: context.userAgent ?? null,
      },
    });

    await tx.refreshSession.updateMany({
      where: {
        userId: resetToken.userId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
  });

  logger.info('Password successfully reset', {
    module: 'password-reset',
    action: 'PASSWORD_RESET_COMPLETED',
    userId: resetToken.userId,
    meta: {
      ipAddress: context.ipAddress ?? null,
    },
  });

  return { success: true };
}

async function invalidateExistingResetTokens(userId: string) {
  await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      expiresAt: new Date(0),
    },
  });
}
