import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';
import { authRateLimits } from '../../common/rateLimiter.js';
import {
  completeRegistrationSchema,
  loginSchema,
  socialAuthSchema,
  startRegistrationSchema,
  updateProfileSchema,
  verifyRegistrationCodeSchema,
} from './auth.schemas.js';
import {
  completeEmailRegistration,
  loginWithEmail,
  loginWithProvider,
  startEmailRegistration,
  getMe,
  updateProfile,
  verifyEmailRegistrationCode,
} from './auth.service.js';
import { signAccessToken } from '../../common/jwt.js';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import {
  createSession,
  verifySession,
  revokeSession,
  revokeAllUserSessions,
  hashToken,
} from './auth.sessions.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';

function getClientContext(req: any) {
  return {
    ipAddress: req.ip ?? req.connection?.remoteAddress ?? null,
    userAgent: req.get('User-Agent') ?? null,
    deviceInfo: req.get('User-Agent') ?? null,
  };
}

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: env.JWT_REFRESH_TTL * 1000,
    path: '/',
  });
}

// POST /api/auth/register/start
authRouter.post('/register/start', authRateLimits.registerStart, async (req, res) => {
  const parsed = startRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await startEmailRegistration(parsed.data);
    res.status(201).json({ ok: true, ...result });
  } catch (err: any) {
    if (err.message === 'EMAIL_TAKEN') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    if (err.message === 'RESEND_COOLDOWN') {
      res.status(429).json({
        error: `You can request a new code in ${err.retryAfterSeconds ?? env.REGISTRATION_RESEND_COOLDOWN} seconds.`,
      });
      return;
    }
    if (err.message === 'EMAIL_DELIVERY_NOT_CONFIGURED' || err.message === 'EMAIL_SENDER_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Email delivery is not configured on the server.' });
      return;
    }
    throw err;
  }
});

// POST /api/auth/register/verify
authRouter.post('/register/verify', authRateLimits.registerVerify, async (req, res) => {
  const parsed = verifyRegistrationCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await verifyEmailRegistrationCode(parsed.data);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_CODE') {
      res.status(400).json({ error: 'Incorrect verification code' });
      return;
    }
    if (err.message === 'CODE_EXPIRED') {
      res.status(410).json({ error: 'Verification code expired. Request a new code.' });
      return;
    }
    if (err.message === 'TOO_MANY_ATTEMPTS') {
      res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
      return;
    }
    throw err;
  }
});

// POST /api/auth/register/complete
authRouter.post('/register/complete', authRateLimits.registerComplete, async (req, res) => {
  const parsed = completeRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await completeEmailRegistration(parsed.data);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    if (err.message === 'EMAIL_TAKEN') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    if (err.message === 'REGISTRATION_SESSION_EXPIRED') {
      res.status(410).json({ error: 'Registration session expired. Start over.' });
      return;
    }
    if (err.message === 'REGISTRATION_SESSION_INVALID') {
      res.status(401).json({ error: 'Registration session is invalid. Verify the code again.' });
      return;
    }
    throw err;
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimits.login, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await loginWithEmail(parsed.data);
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    if (err.message === 'WRONG_CREDENTIALS') {
      res.status(401).json({ error: 'Incorrect email or password' });
      return;
    }
    if (err.message === 'ACCOUNT_INACTIVE') {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }
    throw err;
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const tokenHash = hashToken(token);
      await revokeSession(tokenHash);
    } catch {
      // Session already invalid, just clear cookie
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// POST /api/auth/logout-all — revoke all sessions for the current user
authRouter.post('/logout-all', authenticate, async (req, res) => {
  const user = (req as any).user;
  const token = req.cookies?.[REFRESH_COOKIE];

  // Revoke all sessions
  await revokeAllUserSessions(user.id);

  // Clear current cookie
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// POST /api/auth/refresh — rotate refresh token and issue new access token
authRouter.post('/refresh', authRateLimits.refresh, async (req, res) => {
  const oldToken = req.cookies?.[REFRESH_COOKIE];
  if (!oldToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    // Verify the old token against DB
    const { userId: verifiedUserId, sessionId: oldSessionId } = await verifySession(oldToken);

    // Fetch fresh user data for access token
    const user = await prisma.user.findUnique({ where: { id: verifiedUserId } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Rotate: create new session, revoke old one
    const oldTokenHash = hashToken(oldToken);
    const context = getClientContext(req);
    const { token: newToken, sessionId: newSessionId } = await createSession(
      user.id,
      context,
      oldTokenHash
    );

    // Issue new access token
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    setRefreshCookie(res, newToken);
    res.json({ accessToken });
  } catch (err: any) {
    if (err.message === 'SESSION_REVOKED_REUSE_DETECTED') {
      res.status(401).json({
        error: 'Token reuse detected. All sessions have been revoked for security. Please log in again.',
      });
      return;
    }
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = await getMe(user.id);
  res.json({ user: data });
});

// PATCH /api/auth/profile
authRouter.patch('/profile', authenticate, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = (req as any).user;
  const updated = await updateProfile(user.id, parsed.data);
  res.json({ user: updated });
});

// POST /api/auth/google
// Production: returns 501 as real OAuth is not implemented.
// Dev: accepts mock payload for local development only.
authRouter.post('/google', async (req, res) => {
  if (env.isProd) {
    res.status(501).json({ error: 'SOCIAL_AUTH_DISABLED', message: 'Social authentication is not available in production.' });
    return;
  }

  const parsed = socialAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }

  const { providerAccountId, providerEmail, providerUsername, providerAvatarUrl } = parsed.data;
  const result = await loginWithProvider('GOOGLE', providerAccountId, {
    email: providerEmail,
    username: providerUsername,
    avatarUrl: providerAvatarUrl,
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
});

// POST /api/auth/yandex
authRouter.post('/yandex', async (req, res) => {
  if (env.isProd) {
    res.status(501).json({ error: 'SOCIAL_AUTH_DISABLED', message: 'Social authentication is not available in production.' });
    return;
  }

  const parsed = socialAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }

  const { providerAccountId, providerEmail, providerUsername, providerAvatarUrl } = parsed.data;
  const result = await loginWithProvider('YANDEX', providerAccountId, {
    email: providerEmail,
    username: providerUsername,
    avatarUrl: providerAvatarUrl,
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
});

// POST /api/auth/telegram
authRouter.post('/telegram', async (req, res) => {
  if (env.isProd) {
    res.status(501).json({ error: 'SOCIAL_AUTH_DISABLED', message: 'Social authentication is not available in production.' });
    return;
  }

  const parsed = socialAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }

  const { providerAccountId, providerEmail, providerUsername, providerAvatarUrl } = parsed.data;
  const result = await loginWithProvider('TELEGRAM', providerAccountId, {
    email: providerEmail,
    username: providerUsername,
    avatarUrl: providerAvatarUrl,
  });

  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
});