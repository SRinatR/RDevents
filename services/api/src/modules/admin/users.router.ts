import { Router } from 'express';
import type { User } from '@prisma/client';
import { requirePlatformAdmin, requireSuperAdmin } from '../../common/middleware.js';
import { prisma } from '../../db/prisma.js';

export const adminUsersRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

// GET /admin/users
adminUsersRouter.get('/', requirePlatformAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query['page'] ?? 1)));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));
  const search = String(req.query['search'] ?? '');
  const role = req.query['role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (role) where['role'] = role;
  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where: where as any }),
    prisma.user.findMany({
      where: where as any,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        city: true,
        registeredAt: true,
        createdAt: true,
        lastLoginAt: true,
        accounts: { select: { id: true, provider: true } },
        _count: { select: { eventMemberships: true } },
      },
      orderBy: { registeredAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ data: users, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// PATCH /admin/users/:id/role
adminUsersRouter.patch('/users/:id/role', requireSuperAdmin, async (req, res) => {
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

// GET /admin/admins
adminUsersRouter.get('/admins', requireSuperAdmin, async (_req, res) => {
  const [admins, eventAdmins] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, isActive: true, registeredAt: true },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.eventMember.findMany({
      where: { role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
        event: { select: { id: true, slug: true, title: true, status: true } },
        assignedByUser: { select: { id: true, email: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  res.json({ admins, platformAdmins: admins, eventAdmins });
});
