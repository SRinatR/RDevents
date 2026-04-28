import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../common/password.js';

const { mockPrisma, resetMockState } = vi.hoisted(() => {
  let userSeq = 0;
  let tokenSeq = 0;
  const users = new Map<string, any>();
  const verifications = new Map<string, any>();
  const passwordResetTokens: any[] = [];
  const userAccounts: any[] = [];

  const normalize = (value: string) => String(value ?? '').trim().toLowerCase();

  const findUserByEmail = (email: string) => {
    const normalized = normalize(email);
    return Array.from(users.values()).find((user) => normalize(user.email) === normalized) ?? null;
  };

  const mockPrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where?.id) return users.get(String(where.id)) ?? null;
        if (where?.email) return findUserByEmail(String(where.email));
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        if (findUserByEmail(String(data.email))) {
          throw new Error('Unique constraint failed on users.email');
        }

        const user = {
          id: `user_${++userSeq}`,
          role: 'USER',
          isActive: true,
          registeredAt: new Date(),
          lastLoginAt: null,
          emailVerifiedAt: null,
          ...data,
        };

        users.set(user.id, user);
        return user;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.get(String(where.id));
        if (!user) throw new Error('User not found');
        const updated = { ...user, ...data };
        users.set(updated.id, updated);
        return updated;
      }),
      deleteMany: vi.fn(async ({ where }: any = {}) => {
        if (where?.email?.in) {
          const emails = new Set((where.email.in as string[]).map(normalize));
          for (const [id, user] of users.entries()) {
            if (emails.has(normalize(user.email))) {
              users.delete(id);
            }
          }
        } else {
          users.clear();
        }

        return { count: 0 };
      }),
    },
    registrationVerification: {
      findUnique: vi.fn(async ({ where }: any) => verifications.get(normalize(where.email)) ?? null),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const key = normalize(where.email);
        const current = verifications.get(key);
        const next = current ? { ...current, ...update } : { ...create, email: key };
        verifications.set(key, next);
        return next;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const key = normalize(where.email);
        const current = verifications.get(key);
        if (!current) throw new Error('Verification not found');
        const next = { ...current, ...data };
        verifications.set(key, next);
        return next;
      }),
      deleteMany: vi.fn(async () => {
        verifications.clear();
        return { count: 0 };
      }),
    },
    passwordResetToken: {
      create: vi.fn(async ({ data }: any) => {
        const token = { id: `prt_${++tokenSeq}`, usedAt: null, ...data };
        passwordResetTokens.push(token);
        return token;
      }),
      count: vi.fn(async ({ where }: any) => passwordResetTokens.filter((token) => token.userId === where.userId).length),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const token of passwordResetTokens) {
          const sameUser = token.userId === where.userId;
          const unused = where.usedAt === null ? token.usedAt === null : true;
          const notExpired = where.expiresAt?.gt ? token.expiresAt > where.expiresAt.gt : true;

          if (sameUser && unused && notExpired) {
            Object.assign(token, data);
            count += 1;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async () => {
        passwordResetTokens.length = 0;
        return { count: 0 };
      }),
    },
    userAccount: {
      create: vi.fn(async ({ data }: any) => {
        userAccounts.push(data);
        return data;
      }),
      deleteMany: vi.fn(async () => {
        userAccounts.length = 0;
        return { count: 0 };
      }),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }: any) => data),
    },
  };

  return {
    mockPrisma,
    resetMockState: () => {
      userSeq = 0;
      tokenSeq = 0;
      users.clear();
      verifications.clear();
      passwordResetTokens.length = 0;
      userAccounts.length = 0;
      Object.values(mockPrisma).forEach((group: any) => {
        Object.values(group).forEach((fn: any) => {
          if (typeof fn?.mockClear === 'function') fn.mockClear();
        });
      });
    },
  };
});

vi.mock('../../db/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../common/email.js', () => ({
  sendRegistrationCodeEmail: vi.fn().mockResolvedValue(undefined),
  sendEventNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendEventNotificationEmailSafe: vi.fn().mockResolvedValue(undefined),
  sendPlatformEmail: vi.fn().mockResolvedValue({
    messageId: 'test-message-id',
    providerMessageId: 'test-provider-message-id',
  }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../analytics/analytics.service.js', () => ({
  trackAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../events/team-invitations.service.js', () => ({
  bindPendingInvitationsToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./auth.sessions.js', () => ({
  createSession: vi.fn().mockResolvedValue({
    token: 'refresh-token',
    sessionId: 'session-id',
  }),
}));

import { prisma } from '../../db/prisma.js';
import { loginWithEmail, startEmailRegistration } from './auth.service.js';
import { requestPasswordReset } from '../password-reset/password-reset.service.js';

describe('email identity is case-insensitive', () => {
  beforeEach(async () => {
    resetMockState();
    await prisma.passwordResetToken.deleteMany();
    await prisma.registrationVerification.deleteMany();
    await prisma.userAccount.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['user@example.com', 'mixed@example.com', 'social@example.com'],
        },
      },
    });
  });

  it('logs in when email case differs', async () => {
    const passwordHash = await hashPassword('Password123!');

    await prisma.user.create({
      data: {
        email: 'mixed@example.com',
        passwordHash,
        name: 'Mixed',
        emailVerifiedAt: new Date(),
      },
    });

    const result = await loginWithEmail({
      email: 'MIXED@EXAMPLE.COM',
      password: 'Password123!',
    });

    expect(result.user).toBeTruthy();
    expect((result.user as any).email).toBe('mixed@example.com');
    expect(result.accessToken).toBeTruthy();
  });

  it('rejects duplicate registration with different email case', async () => {
    const passwordHash = await hashPassword('Password123!');

    await prisma.user.create({
      data: {
        email: 'user@example.com',
        passwordHash,
        name: 'User',
        emailVerifiedAt: new Date(),
      },
    });

    await expect(
      startEmailRegistration({ email: 'USER@EXAMPLE.COM' }),
    ).rejects.toThrow('EMAIL_TAKEN');
  });

  it('password reset finds user regardless of input case', async () => {
    const passwordHash = await hashPassword('Password123!');

    const user = await prisma.user.create({
      data: {
        email: 'user@example.com',
        passwordHash,
        name: 'User',
        emailVerifiedAt: new Date(),
      },
    });

    await requestPasswordReset(
      { email: 'USER@EXAMPLE.COM' },
      { ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    const tokenCount = await prisma.passwordResetToken.count({
      where: { userId: user.id },
    });

    expect(tokenCount).toBe(1);
  });

  it('database prevents case-only duplicate users', async () => {
    await prisma.user.create({
      data: {
        email: 'user@example.com',
        passwordHash: await hashPassword('Password123!'),
        name: 'User',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email: 'USER@EXAMPLE.COM',
          passwordHash: await hashPassword('Password123!'),
          name: 'Duplicate',
        },
      }),
    ).rejects.toBeTruthy();
  });
});
