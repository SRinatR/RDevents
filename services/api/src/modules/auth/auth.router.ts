import { Router } from 'express';
import { authenticate } from '../../common/middleware.js';
import { registerSchema, loginSchema, updateProfileSchema, socialAuthSchema } from './auth.schemas.js';
import {
  registerWithEmail,
  loginWithEmail,
  loginWithProvider,
  getMe,
  updateProfile,
} from './auth.service.js';
import { verifyRefreshToken, signAccessToken } from '../../common/jwt.js';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: env.JWT_REFRESH_TTL * 1000,
    path: '/',
  });
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await registerWithEmail(parsed.data);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    if (err.message === 'EMAIL_TAKEN') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    throw err;
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
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
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// POST /api/auth/refresh — exchange refresh cookie for new access token
authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
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
// Production: exchange code via Google OAuth. Dev: accepts mock payload directly.
authRouter.post('/google', async (req, res) => {
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
