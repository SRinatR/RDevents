import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { hashPassword } from '../../common/password.js';
import { loginWithEmail, startEmailRegistration } from './auth.service.js';
import { requestPasswordReset } from '../password-reset/password-reset.service.js';

describe('email identity is case-insensitive', () => {
  beforeEach(async () => {
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
