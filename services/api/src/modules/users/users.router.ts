import { Router } from 'express';
import { authenticate, requirePlatformAdmin, requireSuperAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

export const usersRouter = Router();

// All user routes require at least being authenticated
usersRouter.use(authenticate);

// GET /api/users — admin: list all users with pagination
usersRouter.get('/', requirePlatformAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query['page'] ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));
  const search = String(req.query['search'] ?? '');

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        avatarUrl: true, registeredAt: true, lastLoginAt: true,
        accounts: { select: { provider: true } },
        _count: { select: { eventMemberships: true } },
      },
      orderBy: { registeredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ data: users, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// PATCH /api/users/:id/role — admin: update user role
usersRouter.patch('/:id/role', requireSuperAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['USER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const idOrEmail = String(req.params['id']);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: idOrEmail }, { email: idOrEmail }] },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });

  res.json({ user });
});

// PATCH /api/users/:id/active — admin: toggle active status
usersRouter.patch('/:id/active', requirePlatformAdmin, async (req, res) => {
  const { isActive } = req.body;
  const user = await prisma.user.update({
    where: { id: String(req.params['id']) },
    data: { isActive: Boolean(isActive) },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  res.json({ user });
});
