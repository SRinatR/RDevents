import { prisma } from '../../db/prisma.js';
import { getMyEvents, getMyTeams, getMyVolunteerApplications } from '../events/events.service.js';
import { sanitizeUser } from './auth.service.js';
import {
  PROFILE_SECTION_KEYS,
  PROFILE_SECTION_META,
  isProfileSectionKey,
  type ProfileSectionKey,
  type ProfileSectionStatus,
} from './profile.sections.js';
import { profileSectionSchemaMap } from './profile.schemas.js';
import {
  attachAvatarToUser,
  createMediaAsset,
  detachAvatarFromUser,
  listUserDocuments,
  markMediaAssetDeleted,
  validateAvatarFile,
  validateDocumentFile,
} from './profile.media.js';

type ProfileUser = Record<string, any>;

export async function getProfileSections(userId: string) {
  const user = await getProfileUserForStatus(userId);
  if (!user) throw new Error('NOT_FOUND');

  const sections = [];
  for (const key of PROFILE_SECTION_KEYS) {
    const status = getSectionStatus(key, user);
    sections.push(await upsertSectionState(userId, key, status));
  }

  return sections;
}

export async function updateProfileSection(userId: string, sectionKey: ProfileSectionKey, input: unknown) {
  if (!isProfileSectionKey(sectionKey)) {
    throw new Error('INVALID_PROFILE_SECTION');
  }

  const schema = profileSectionSchemaMap[sectionKey];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const error = new Error('Profile section validation failed');
    (error as Error & { details?: unknown }).details = parsed.error.flatten();
    throw error;
  }

  const data = parsed.data as Record<string, any>;

  if (sectionKey === 'basic') {
    await updateBasicSection(userId, data);
  } else if (sectionKey === 'contacts') {
    await updateContactsSection(userId, data);
  } else if (sectionKey === 'address') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data['city'] !== undefined && { city: nullableString(data['city']) }),
        ...(data['factualAddress'] !== undefined && { factualAddress: nullableString(data['factualAddress']) }),
      },
    });
  } else if (sectionKey === 'languages') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data['nativeLanguage'] !== undefined && { nativeLanguage: nullableString(data['nativeLanguage']) }),
        ...(data['communicationLanguage'] !== undefined && { communicationLanguage: nullableString(data['communicationLanguage']) }),
      },
    });
  } else if (sectionKey === 'consents') {
    await updateConsentsSection(userId, data);
  }

  const user = await getProfileUserForResponse(userId);
  const statusUser = await getProfileUserForStatus(userId);
  const section = await upsertSectionState(userId, sectionKey, getSectionStatus(sectionKey, statusUser as ProfileUser));

  return {
    user: sanitizeUser(user as any),
    section,
  };
}

export async function uploadProfileAvatar(userId: string, file: Express.Multer.File) {
  validateAvatarFile(file);
  const asset = await createMediaAsset(userId, 'AVATAR', file);
  await attachAvatarToUser(userId, asset.id);

  const user = await getProfileUserForResponse(userId);
  const statusUser = await getProfileUserForStatus(userId);
  const section = await upsertSectionState(userId, 'photo', getSectionStatus('photo', statusUser as ProfileUser));

  return {
    asset: publicMediaAsset(asset),
    user: sanitizeUser(user as any),
    section,
  };
}

export async function removeProfileAvatar(userId: string) {
  await detachAvatarFromUser(userId);
  const statusUser = await getProfileUserForStatus(userId);
  return upsertSectionState(userId, 'photo', getSectionStatus('photo', statusUser as ProfileUser));
}

export async function listProfileDocuments(userId: string) {
  return listUserDocuments(userId);
}

export async function uploadProfileDocument(userId: string, file: Express.Multer.File) {
  validateDocumentFile(file);
  const asset = await createMediaAsset(userId, 'DOCUMENT', file);
  const statusUser = await getProfileUserForStatus(userId);
  const section = await upsertSectionState(userId, 'documents', getSectionStatus('documents', statusUser as ProfileUser));
  return { asset: publicMediaAsset(asset), section };
}

export async function removeProfileDocument(userId: string, assetId: string) {
  await markMediaAssetDeleted(userId, assetId);
  const statusUser = await getProfileUserForStatus(userId);
  return upsertSectionState(userId, 'documents', getSectionStatus('documents', statusUser as ProfileUser));
}

export async function getProfileActivity(userId: string) {
  const [events, teams, volunteerApplications] = await Promise.all([
    getMyEvents(userId),
    getMyTeams(userId),
    getMyVolunteerApplications(userId),
  ]);

  await upsertSectionState(userId, 'activity', 'COMPLETED');

  return {
    events,
    teams,
    volunteerApplications,
  };
}

export async function verifyProfileContact(userId: string, channel: 'email' | 'phone' | 'telegram') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      telegram: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      telegramVerifiedAt: true,
    },
  });
  if (!user) throw new Error('NOT_FOUND');

  if (channel === 'email') {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    return sanitizeUser(updated as any);
  }

  if (channel === 'phone') {
    if (!hasText(user.phone)) throw new Error('CONTACT_VALUE_REQUIRED');
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
    return sanitizeUser(updated as any);
  }

  if (!hasText(user.telegram)) throw new Error('CONTACT_VALUE_REQUIRED');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { telegramVerifiedAt: new Date() },
  });
  return sanitizeUser(updated as any);
}

async function updateBasicSection(userId: string, input: Record<string, any>) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new Error('NOT_FOUND');

  const next = {
    lastNameCyrillic: input['lastNameCyrillic'] !== undefined ? nullableString(input['lastNameCyrillic']) : existing.lastNameCyrillic,
    firstNameCyrillic: input['firstNameCyrillic'] !== undefined ? nullableString(input['firstNameCyrillic']) : existing.firstNameCyrillic,
    middleNameCyrillic: input['middleNameCyrillic'] !== undefined ? nullableString(input['middleNameCyrillic']) : existing.middleNameCyrillic,
    lastNameLatin: input['lastNameLatin'] !== undefined ? nullableString(input['lastNameLatin']) : existing.lastNameLatin,
    firstNameLatin: input['firstNameLatin'] !== undefined ? nullableString(input['firstNameLatin']) : existing.firstNameLatin,
    middleNameLatin: input['middleNameLatin'] !== undefined ? nullableString(input['middleNameLatin']) : existing.middleNameLatin,
  };

  const fullNameCyrillic = buildFullName([
    next.lastNameCyrillic,
    next.firstNameCyrillic,
    next.middleNameCyrillic,
  ]);
  const fullNameLatin = buildFullName([
    next.lastNameLatin,
    next.firstNameLatin,
    next.middleNameLatin,
  ]);

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...next,
      ...(input['birthDate'] !== undefined && {
        birthDate: input['birthDate'] ? new Date(input['birthDate']) : null,
      }),
      fullNameCyrillic,
      fullNameLatin,
      name: fullNameCyrillic,
    },
  });
}

async function updateContactsSection(userId: string, input: Record<string, any>) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phone: true,
      telegram: true,
    },
  });
  if (!existing) throw new Error('NOT_FOUND');

  const nextPhone = input['phone'] !== undefined ? nullableString(input['phone']) : existing.phone;
  const nextTelegram = input['telegram'] !== undefined ? nullableString(input['telegram']) : existing.telegram;
  const phoneChanged = normalizeComparable(nextPhone) !== normalizeComparable(existing.phone);
  const telegramChanged = normalizeComparable(nextTelegram) !== normalizeComparable(existing.telegram);

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input['phone'] !== undefined && {
        phone: nextPhone,
        ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
      }),
      ...(input['telegram'] !== undefined && {
        telegram: nextTelegram,
        ...(telegramChanged ? { telegramVerifiedAt: null } : {}),
      }),
    },
  });
}

async function updateConsentsSection(userId: string, input: Record<string, any>) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      consentPersonalDataAt: true,
      consentClientRulesAt: true,
    },
  });
  if (!existing) throw new Error('NOT_FOUND');

  const now = new Date();
  const consentPersonalData = Boolean(input['consentPersonalData']);
  const consentClientRules = Boolean(input['consentClientRules']);

  await prisma.user.update({
    where: { id: userId },
    data: {
      consentPersonalData,
      consentClientRules,
      consentPersonalDataAt: consentPersonalData ? existing.consentPersonalDataAt ?? now : null,
      consentClientRulesAt: consentClientRules ? existing.consentClientRulesAt ?? now : null,
    },
  });
}

async function upsertSectionState(userId: string, sectionKey: ProfileSectionKey, status: ProfileSectionStatus) {
  const state = await prisma.userProfileSectionState.upsert({
    where: {
      userId_sectionKey: {
        userId,
        sectionKey,
      },
    },
    update: { status },
    create: {
      userId,
      sectionKey,
      status,
    },
  });

  return {
    key: sectionKey,
    title: PROFILE_SECTION_META[sectionKey].title,
    description: PROFILE_SECTION_META[sectionKey].description,
    status: state.status as ProfileSectionStatus,
  };
}

function getSectionStatus(sectionKey: ProfileSectionKey, user: ProfileUser): ProfileSectionStatus {
  switch (sectionKey) {
    case 'basic': {
      const hasAny = [
        user.lastNameCyrillic,
        user.firstNameCyrillic,
        user.middleNameCyrillic,
        user.lastNameLatin,
        user.firstNameLatin,
        user.middleNameLatin,
      ].some(hasText) || Boolean(user.birthDate);
      if (!hasAny) return 'NOT_STARTED';
      return hasText(user.firstNameCyrillic) && Boolean(user.birthDate) ? 'COMPLETED' : 'IN_PROGRESS';
    }
    case 'photo':
      return user.avatarAssetId || user.avatarAsset || hasText(user.avatarUrl) ? 'COMPLETED' : 'NOT_STARTED';
    case 'contacts':
      return hasText(user.phone) || hasText(user.telegram) ? 'COMPLETED' : 'NOT_STARTED';
    case 'address':
      if (!hasText(user.city) && !hasText(user.factualAddress)) return 'NOT_STARTED';
      return hasText(user.city) ? 'COMPLETED' : 'IN_PROGRESS';
    case 'languages':
      if (!hasText(user.nativeLanguage) && !hasText(user.communicationLanguage)) return 'NOT_STARTED';
      return hasText(user.communicationLanguage) ? 'COMPLETED' : 'IN_PROGRESS';
    case 'documents':
      return Array.isArray(user.mediaAssets) && user.mediaAssets.length > 0 ? 'COMPLETED' : 'NOT_STARTED';
    case 'consents':
      if (!user.consentPersonalData && !user.consentClientRules) return 'NOT_STARTED';
      return user.consentPersonalData && user.consentClientRules ? 'COMPLETED' : 'IN_PROGRESS';
    case 'activity':
      return 'COMPLETED';
  }
}

async function getProfileUserForStatus(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      avatarAsset: true,
      mediaAssets: {
        where: {
          purpose: 'DOCUMENT',
          status: 'ACTIVE',
        },
        select: { id: true },
      },
    },
  });
}

async function getProfileUserForResponse(userId: string) {
  return prisma.user.findUnique({
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
}

function buildFullName(parts: Array<string | null | undefined>): string | null {
  const trimmed = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);
  return trimmed.length > 0 ? trimmed.join(' ') : null;
}

function nullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeComparable(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function publicMediaAsset(asset: Record<string, any>) {
  return {
    id: asset.id,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    publicUrl: asset.publicUrl,
    createdAt: asset.createdAt,
    status: asset.status,
  };
}
