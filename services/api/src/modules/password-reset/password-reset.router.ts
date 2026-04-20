import { Router } from 'express';
import { authRateLimits } from '../../common/rateLimiter.js';
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
} from './password-reset.schemas.js';
import {
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
} from './password-reset.service.js';
import { logger } from '../../common/logger.js';

export const passwordResetRouter = Router();

function getClientContext(req: any) {
  return {
    ipAddress: req.ip ?? req.connection?.remoteAddress ?? null,
    userAgent: req.get('User-Agent') ?? null,
  };
}

passwordResetRouter.post('/forgot', authRateLimits.passwordResetRequest, async (req, res) => {
  const parsed = requestPasswordResetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    await requestPasswordReset(parsed.data, getClientContext(req));
    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (err: any) {
    logger.error('Password reset request failed', {
      module: 'password-reset',
      action: 'password_reset_request_failed',
      meta: {
        reason: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
});

passwordResetRouter.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  const result = await verifyPasswordResetToken(token);

  if (!result.valid) {
    res.status(400).json({ valid: false, reason: result.reason });
    return;
  }

  res.json({ valid: true });
});

passwordResetRouter.post('/reset', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    await resetPassword(parsed.data, getClientContext(req));
    res.json({
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err: any) {
    if (err.message === 'INVALID_TOKEN') {
      res.status(400).json({ error: 'Invalid reset token', code: 'INVALID_TOKEN' });
      return;
    }
    if (err.message === 'TOKEN_ALREADY_USED') {
      res.status(400).json({ error: 'This reset token has already been used', code: 'TOKEN_ALREADY_USED' });
      return;
    }
    if (err.message === 'TOKEN_EXPIRED') {
      res.status(400).json({ error: 'This reset token has expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    throw err;
  }
});
