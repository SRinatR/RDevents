import { prisma } from '../../db/prisma.js';
import { hashPassword, verifyPassword } from '../../common/password.js';
import { signAccessToken, signRefreshToken } from '../../common/jwt.js';
import type { RegisterInput, LoginInput, UpdateProfileInput } from './auth.schemas.js';
import type { AuthProvider } from '@prisma/client';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';

// Strip sensitive fields before sending user to client
export function sanitizeUser(user: Record<string, unknown>) {
  const { passwordHash: _ph, eventMemberships, ...safe } = user;
  if (!Array.isArray(eventMemberships)) return safe;

  return {
    ...safe,
    eventRoles: eventMemberships.map((membership: any) => ({
      eventId: membership.eventId,
      eventSlug: membership.event?.slug,
      eventTitle: membership.event?.title,
      role: membership.role,
      status: membership.status,
    })),
  };
}

export async function registerWithEmail(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('EMAIL_TAKEN');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name ?? null,
        registeredAt: new Date(),
      },
    });

    await tx.userAccount.create({
      data: {
        userId: created.id,
        provider: 'EMAIL',
        providerAccountId: input.email,
        providerEmail: input.email,
      },
    });

    await trackAnalyticsEvent(tx, {
      type: 'USER_REGISTER',
      userId: created.id,
      authProvider: 'EMAIL',
      meta: { source: 'email_password' },
    });

    return created;
  });

  const tokens = issueTokens(user);
  return { user: sanitizeUser(user as any), ...tokens };
}

export async function loginWithEmail(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) throw new Error('WRONG_CREDENTIALS');

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw new Error('WRONG_CREDENTIALS');

  if (!user.isActive) throw new Error('ACCOUNT_INACTIVE');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await trackAnalyticsEvent(prisma, {
    type: 'USER_LOGIN',
    userId: user.id,
    authProvider: 'EMAIL',
    meta: { source: 'email_password' },
  });

  const tokens = issueTokens(user);
  return { user: sanitizeUser(user as any), ...tokens };
}

// Upsert-based social auth — creates user on first login, links account
export async function loginWithProvider(
  provider: AuthProvider,
  providerAccountId: string,
  providerData: {
    email?: string;
    username?: string;
    avatarUrl?: string;
  }
) {
  // Try to find existing linked account
  let account = await prisma.userAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });

  if (account) {
    // Update last used and return existing user
    await prisma.userAccount.update({
      where: { id: account.id },
      data: { lastUsedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: account.userId },
      data: { lastLoginAt: new Date() },
    });
    await trackAnalyticsEvent(prisma, {
      type: 'USER_LOGIN',
      userId: account.userId,
      authProvider: provider,
      meta: { source: 'provider' },
    });
    await trackAnalyticsEvent(prisma, {
      type: 'PROVIDER_USED',
      userId: account.userId,
      authProvider: provider,
    });
    const tokens = issueTokens(account.user);
    return { user: sanitizeUser(account.user as any), ...tokens };
  }

  // Try to find user by email (link accounts)
  let user = providerData.email
    ? await prisma.user.findUnique({ where: { email: providerData.email } })
    : null;

  const isNewUser = !user;
  if (!user) {
    // Create new user
    user = await prisma.user.create({
      data: {
        email: providerData.email ?? `${provider.toLowerCase()}_${providerAccountId}@noemail.local`,
        name: providerData.username ?? null,
        avatarUrl: providerData.avatarUrl,
        registeredAt: new Date(),
        lastLoginAt: new Date(),
      },
    });
  }

  // Link the provider account
  await prisma.userAccount.create({
    data: {
      userId: user.id,
      provider,
      providerAccountId,
      providerEmail: providerData.email,
      providerUsername: providerData.username,
      providerAvatarUrl: providerData.avatarUrl,
      linkedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });

  await trackAnalyticsEvent(prisma, {
    type: isNewUser ? 'USER_REGISTER' : 'USER_LOGIN',
    userId: user.id,
    authProvider: provider,
    meta: { source: 'provider' },
  });
  await trackAnalyticsEvent(prisma, {
    type: 'PROVIDER_USED',
    userId: user.id,
    authProvider: provider,
  });

  const tokens = issueTokens(user);
  return { user: sanitizeUser(user as any), ...tokens };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: { select: { provider: true, providerEmail: true, linkedAt: true } },
      eventMemberships: {
        where: { status: { not: 'REMOVED' } },
        select: {
          eventId: true,
          role: true,
          status: true,
          event: { select: { slug: true, title: true } },
        },
        orderBy: { assignedAt: 'desc' },
      },
    },
  });
  if (!user) throw new Error('NOT_FOUND');
  return sanitizeUser(user as any);
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name || null }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.telegram !== undefined && { telegram: input.telegram || null }),
      ...(input.birthDate !== undefined && { birthDate: input.birthDate ? new Date(input.birthDate) : null }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl || null }),
    },
  });
  return sanitizeUser(user as any);
}

function issueTokens(user: { id: string; email: string; role: string }) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  return { accessToken, refreshToken };
}
