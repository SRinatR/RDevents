import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { AuthProvider } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../common/password.js';
import { signAccessToken } from '../../common/jwt.js';
import { sendRegistrationCodeEmail } from '../../common/email.js';
import { logger } from '../../common/logger.js';
import { buildPublicMediaUrl } from '../../common/storage.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import { createSession } from './auth.sessions.js';
import type {
  CompleteRegistrationInput,
  LoginInput,
  StartRegistrationInput,
  UpdateProfileInput,
  VerifyRegistrationCodeInput,
} from './auth.schemas.js';

// Strip sensitive fields before sending user to client
export function sanitizeUser(user: Record<string, unknown>) {
  const {
    passwordHash: _ph,
    eventMemberships,
    avatarAsset,
    mediaAssets: _mediaAssets,
    profileSectionStates: _profileSectionStates,
    ...safe
  } = user;
  const avatarStorageKey = (avatarAsset as any)?.storageKey;
  const resolvedAvatarUrl = typeof avatarStorageKey === 'string'
    ? buildPublicMediaUrl(avatarStorageKey)
    : ((avatarAsset as any)?.publicUrl ?? safe.avatarUrl ?? null);
  const base = {
    ...safe,
    avatarUrl: resolvedAvatarUrl,
  };
  if (!Array.isArray(eventMemberships)) return base;

  return {
    ...base,
    eventRoles: eventMemberships.map((membership: any) => ({
      eventId: membership.eventId,
      eventSlug: membership.event?.slug,
      eventTitle: membership.event?.title,
      role: membership.role,
      status: membership.status,
    })),
  };
}

export async function startEmailRegistration(input: StartRegistrationInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('EMAIL_TAKEN');

  const existingVerification = await prisma.registrationVerification.findUnique({
    where: { email: input.email },
  });
  const now = Date.now();
  const lastCodeSentAt = existingVerification?.codeSentAt?.getTime() ?? 0;
  const cooldownEndsAt = lastCodeSentAt + env.REGISTRATION_RESEND_COOLDOWN * 1000;

  if (cooldownEndsAt > now) {
    const error = new Error('RESEND_COOLDOWN');
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = Math.ceil((cooldownEndsAt - now) / 1000);
    throw error;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeSentAt = new Date(now);
  const codeExpiresAt = new Date(now + env.REGISTRATION_CODE_TTL * 1000);

  await prisma.registrationVerification.upsert({
    where: { email: input.email },
    update: {
      codeHash: hashOpaqueValue(code),
      codeSentAt,
      codeExpiresAt,
      verifiedAt: null,
      completionTokenHash: null,
      completionTokenExpiresAt: null,
      attempts: 0,
    },
    create: {
      email: input.email,
      codeHash: hashOpaqueValue(code),
      codeSentAt,
      codeExpiresAt,
    },
  });

  try {
    await sendRegistrationCodeEmail({
      to: input.email,
      code,
      ttlMinutes: Math.ceil(env.REGISTRATION_CODE_TTL / 60),
    });
  } catch (error) {
    if (!env.isDev) {
      throw error;
    }
  }

  logger.info('Registration verification code generated', {
    module: 'auth',
    action: 'registration_code_generated',
    meta: {
      email: input.email,
      code,
      expiresAt: codeExpiresAt.toISOString(),
      delivery: env.RESEND_API_KEY ? 'resend' : 'dev_log_only',
    },
  });

  return {
    expiresAt: codeExpiresAt.toISOString(),
    cooldownSeconds: env.REGISTRATION_RESEND_COOLDOWN,
    ...(env.isDev ? { devCode: code } : {}),
  };
}

export async function verifyEmailRegistrationCode(input: VerifyRegistrationCodeInput) {
  const verification = await prisma.registrationVerification.findUnique({
    where: { email: input.email },
  });

  if (!verification || verification.codeExpiresAt.getTime() <= Date.now()) {
    throw new Error('CODE_EXPIRED');
  }

  if (verification.attempts >= env.REGISTRATION_MAX_ATTEMPTS) {
    throw new Error('TOO_MANY_ATTEMPTS');
  }

  if (verification.codeHash !== hashOpaqueValue(input.code)) {
    const attempts = verification.attempts + 1;

    await prisma.registrationVerification.update({
      where: { email: input.email },
      data: { attempts },
    });

    if (attempts >= env.REGISTRATION_MAX_ATTEMPTS) {
      throw new Error('TOO_MANY_ATTEMPTS');
    }

    throw new Error('INVALID_CODE');
  }

  const completionToken = randomBytes(24).toString('hex');
  const completionTokenExpiresAt = new Date(Date.now() + env.REGISTRATION_COMPLETION_TTL * 1000);

  await prisma.registrationVerification.update({
    where: { email: input.email },
    data: {
      attempts: 0,
      verifiedAt: new Date(),
      completionTokenHash: hashOpaqueValue(completionToken),
      completionTokenExpiresAt,
    },
  });

  return {
    registrationToken: completionToken,
    expiresAt: completionTokenExpiresAt.toISOString(),
  };
}

export async function completeEmailRegistration(input: CompleteRegistrationInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('EMAIL_TAKEN');

  const verification = await prisma.registrationVerification.findUnique({
    where: { email: input.email },
  });

  const isCompletionExpired = !verification?.completionTokenExpiresAt
    || verification.completionTokenExpiresAt.getTime() <= Date.now();

  if (
    !verification
    || !verification.verifiedAt
    || !verification.completionTokenHash
    || isCompletionExpired
  ) {
    throw new Error('REGISTRATION_SESSION_EXPIRED');
  }

  if (verification.completionTokenHash !== hashOpaqueValue(input.registrationToken)) {
    throw new Error('REGISTRATION_SESSION_INVALID');
  }

  const passwordHash = await hashPassword(input.password);
  // Cast tx to 'any' to bypass Prisma's TransactionClient type limitation
  // At runtime, tx has full model access but TypeScript definitions are incomplete
  const user = await prisma.$transaction(async (tx: any) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name ?? null,
        emailVerifiedAt: verification.verifiedAt,
        registeredAt: new Date(),
        lastLoginAt: new Date(),
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

    await tx.registrationVerification.delete({
      where: { email: input.email },
    });

    await trackAnalyticsEvent(tx, {
      type: 'USER_REGISTER',
      userId: created.id,
      authProvider: 'EMAIL',
      meta: { source: 'email_password' },
    });

    return created;
  });

  const tokens = await issueTokens(user);
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

  const tokens = await issueTokens(user);
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
    const tokens = await issueTokens(account.user);
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

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user as any), ...tokens };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      avatarAsset: true,
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

// Helper: build full name from non-empty parts
function buildFullName(parts: string[]): string | null {
  const trimmed = parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);
  if (trimmed.length === 0) return null;
  return trimmed.join(' ');
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // Build full names from parts
  const fullNameCyrillic = buildFullName([
    input.lastNameCyrillic ?? '',
    input.firstNameCyrillic ?? '',
    input.middleNameCyrillic ?? '',
  ]);
  const fullNameLatin = buildFullName([
    input.lastNameLatin ?? '',
    input.firstNameLatin ?? '',
    input.middleNameLatin ?? '',
  ]);

  // Sync name with fullNameCyrillic for backward compatibility
  const syncName = input.name !== undefined 
    ? input.name || fullNameCyrillic
    : fullNameCyrillic;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: syncName }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.factualAddress !== undefined && { factualAddress: input.factualAddress || null }),
      ...(input.phone !== undefined && { phone: normalizeUzbekPhone(input.phone), phoneVerifiedAt: null }),
      ...(input.telegram !== undefined && { telegram: normalizeTelegramUsername(input.telegram), telegramVerifiedAt: null }),
      ...(input.nativeLanguage !== undefined && { nativeLanguage: input.nativeLanguage || null }),
      ...(input.communicationLanguage !== undefined && { communicationLanguage: input.communicationLanguage || null }),
      ...(input.consentPersonalData !== undefined && {
        consentPersonalData: input.consentPersonalData,
        consentPersonalDataAt: input.consentPersonalData ? new Date() : null,
      }),
      ...(input.consentClientRules !== undefined && {
        consentClientRules: input.consentClientRules,
        consentClientRulesAt: input.consentClientRules ? new Date() : null,
      }),
      ...(input.birthDate !== undefined && { birthDate: input.birthDate ? new Date(input.birthDate) : null }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl || null }),
      // Cyrillic name fields
      ...(input.lastNameCyrillic !== undefined && { lastNameCyrillic: input.lastNameCyrillic || null }),
      ...(input.firstNameCyrillic !== undefined && { firstNameCyrillic: input.firstNameCyrillic || null }),
      ...(input.middleNameCyrillic !== undefined && { middleNameCyrillic: input.middleNameCyrillic || null }),
      // Latin name fields
      ...(input.lastNameLatin !== undefined && { lastNameLatin: input.lastNameLatin || null }),
      ...(input.firstNameLatin !== undefined && { firstNameLatin: input.firstNameLatin || null }),
      ...(input.middleNameLatin !== undefined && { middleNameLatin: input.middleNameLatin || null }),
      // Computed full names
      ...(fullNameCyrillic !== null && { fullNameCyrillic }),
      ...(fullNameLatin !== null && { fullNameLatin }),
    },
  });
  return sanitizeUser(user as any);
}

function normalizeUzbekPhone(value: unknown) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('998') ? digits.slice(3) : digits;
  const normalized = local.slice(0, 9);
  if (normalized.length === 0) return null;
  if (normalized.length !== 9) throw new Error('INVALID_UZBEK_PHONE');
  return `+998${normalized}`;
}

function normalizeTelegramUsername(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 32);
  if (!cleaned) return null;
  if (cleaned.length < 5) throw new Error('INVALID_TELEGRAM_USERNAME');
  return `@${cleaned}`;
}

async function issueTokens(
  user: { id: string; email: string; role: string },
  context: { ipAddress?: string; userAgent?: string; deviceInfo?: string } = {}
) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken } = await createSession(user.id, context);
  return { accessToken, refreshToken };
}

function hashOpaqueValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
