import { prisma } from '../../db/prisma.js';
import { buildPublicMediaUrl } from '../../common/storage.js';
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
  isDomesticDocumentComplete,
  isInternationalPassportComplete,
  isSocialLinksComplete,
} from './profile.snapshot.js';
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
    const status = getSectionStatus(key, user as ProfileUser);
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

  if (sectionKey === 'registration_data') {
    await updateRegistrationDataSection(userId, data);
  } else if (sectionKey === 'general_info') {
    await updateGeneralInfoSection(userId, data);
  } else if (sectionKey === 'personal_documents') {
    await updatePersonalDocumentsSection(userId, data);
  } else if (sectionKey === 'contact_data') {
    await updateContactDataSection(userId, data);
  } else if (sectionKey === 'activity_info') {
    await updateActivityInfoSection(userId, data);
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
  const section = await upsertSectionState(userId, 'general_info', getSectionStatus('general_info', statusUser as ProfileUser));

  return {
    asset: publicMediaAsset(asset),
    user: sanitizeUser(user as any),
    section,
  };
}

export async function removeProfileAvatar(userId: string) {
  await detachAvatarFromUser(userId);
  const statusUser = await getProfileUserForStatus(userId);
  return upsertSectionState(userId, 'general_info', getSectionStatus('general_info', statusUser as ProfileUser));
}

export async function listProfileDocuments(userId: string) {
  return listUserDocuments(userId);
}

export async function uploadProfileDocument(userId: string, file: Express.Multer.File) {
  validateDocumentFile(file);
  const asset = await createMediaAsset(userId, 'DOCUMENT', file);
  const statusUser = await getProfileUserForStatus(userId);
  const section = await upsertSectionState(userId, 'personal_documents', getSectionStatus('personal_documents', statusUser as ProfileUser));
  return { asset: publicMediaAsset(asset), section };
}

export async function removeProfileDocument(userId: string, assetId: string) {
  await markMediaAssetDeleted(userId, assetId);
  await prisma.userAdditionalDocument.deleteMany({ where: { userId, assetId } });
  await prisma.userIdentityDocument.updateMany({ where: { userId, scanAssetId: assetId }, data: { scanAssetId: null } });
  await prisma.userInternationalPassport.updateMany({ where: { userId, scanAssetId: assetId }, data: { scanAssetId: null } });
  const statusUser = await getProfileUserForStatus(userId);
  return upsertSectionState(userId, 'personal_documents', getSectionStatus('personal_documents', statusUser as ProfileUser));
}

async function updateRegistrationDataSection(userId: string, input: Record<string, any>) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { extendedProfile: true },
  });
  if (!existing) throw new Error('NOT_FOUND');

  const hasNoLastName = input['hasNoLastName'] ?? existing.hasNoLastName;
  const hasNoFirstName = input['hasNoFirstName'] ?? existing.hasNoFirstName;
  const hasNoMiddleName = input['hasNoMiddleName'] ?? existing.hasNoMiddleName;
  const next = {
    lastNameCyrillic: hasNoLastName ? null : valueOrExisting(input, 'lastNameCyrillic', existing.lastNameCyrillic),
    firstNameCyrillic: hasNoFirstName ? null : valueOrExisting(input, 'firstNameCyrillic', existing.firstNameCyrillic),
    middleNameCyrillic: hasNoMiddleName ? null : valueOrExisting(input, 'middleNameCyrillic', existing.middleNameCyrillic),
    lastNameLatin: hasNoLastName ? null : valueOrExisting(input, 'lastNameLatin', existing.lastNameLatin),
    firstNameLatin: hasNoFirstName ? null : valueOrExisting(input, 'firstNameLatin', existing.firstNameLatin),
    middleNameLatin: hasNoMiddleName ? null : valueOrExisting(input, 'middleNameLatin', existing.middleNameLatin),
  };

  const fullNameCyrillic = buildFullName([next.lastNameCyrillic, next.firstNameCyrillic, next.middleNameCyrillic]);
  const fullNameLatin = buildFullName([next.lastNameLatin, next.firstNameLatin, next.middleNameLatin]);

  await prisma.$transaction(async (tx: any) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        ...next,
        hasNoLastName,
        hasNoFirstName,
        hasNoMiddleName,
        ...(input['birthDate'] !== undefined && { birthDate: parseDateOrNull(input['birthDate']) }),
        ...(input['phone'] !== undefined && { phone: normalizeUzbekPhone(input['phone']), phoneVerifiedAt: null }),
        ...(input['telegram'] !== undefined && { telegram: normalizeTelegramUsername(input['telegram']), telegramVerifiedAt: null }),
        ...(input['consentPersonalData'] !== undefined && {
          consentPersonalData: input['consentPersonalData'],
          consentPersonalDataAt: input['consentPersonalData'] ? new Date() : null,
        }),
        fullNameCyrillic,
        fullNameLatin,
        name: fullNameCyrillic ?? fullNameLatin ?? existing.name,
      },
    });

    await tx.userExtendedProfile.upsert({
      where: { userId },
      create: {
        userId,
        gender: enumOrNull(input['gender']),
        citizenshipCountryCode: nullableString(input['citizenshipCountryCode']),
        residenceCountryCode: nullableString(input['residenceCountryCode']),
        consentMailing: Boolean(input['consentMailing']),
        consentMailingAt: input['consentMailing'] ? new Date() : null,
      },
      update: {
        ...(input['gender'] !== undefined && { gender: enumOrNull(input['gender']) }),
        ...(input['citizenshipCountryCode'] !== undefined && { citizenshipCountryCode: nullableString(input['citizenshipCountryCode']) }),
        ...(input['residenceCountryCode'] !== undefined && { residenceCountryCode: nullableString(input['residenceCountryCode']) }),
        ...(input['consentMailing'] !== undefined && {
          consentMailing: input['consentMailing'],
          consentMailingAt: input['consentMailing'] ? new Date() : null,
        }),
      },
    });
  });
}

async function updateGeneralInfoSection(userId: string, input: Record<string, any>) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { extendedProfile: true },
  });
  if (!existing) throw new Error('NOT_FOUND');

  const nextResidenceCountry = input['residenceCountryCode'] !== undefined
    ? nullableString(input['residenceCountryCode'])
    : existing.extendedProfile?.residenceCountryCode;
  const isUzAddress = nextResidenceCountry === 'UZ';

  await prisma.$transaction(async (tx: any) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(input['nativeLanguage'] !== undefined && { nativeLanguage: nullableString(input['nativeLanguage']) }),
        ...(input['communicationLanguage'] !== undefined && { communicationLanguage: nullableString(input['communicationLanguage']) }),
        ...(input['consentClientRules'] !== undefined && {
          consentClientRules: input['consentClientRules'],
          consentClientRulesAt: input['consentClientRules'] ? new Date() : null,
        }),
        ...(input['settlementText'] !== undefined && { city: nullableString(input['settlementText']) }),
        ...(input['street'] !== undefined || input['house'] !== undefined
          ? { factualAddress: buildAddressString(input) }
          : {}),
      },
    });

    await tx.userExtendedProfile.upsert({
      where: { userId },
      create: {
        userId,
        residenceCountryCode: nextResidenceCountry,
        regionId: isUzAddress ? nullableString(input['regionId']) : null,
        districtId: isUzAddress ? nullableString(input['districtId']) : null,
        settlementId: isUzAddress ? nullableString(input['settlementId']) : null,
        regionText: isUzAddress ? null : nullableString(input['regionText']),
        districtText: isUzAddress ? null : nullableString(input['districtText']),
        settlementText: isUzAddress ? null : nullableString(input['settlementText']),
        street: nullableString(input['street']),
        house: nullableString(input['house']),
        apartment: nullableString(input['apartment']),
        postalCode: nullableString(input['postalCode']),
      },
      update: {
        ...(input['residenceCountryCode'] !== undefined && { residenceCountryCode: nextResidenceCountry }),
        regionId: isUzAddress ? nullableString(input['regionId']) : null,
        districtId: isUzAddress ? nullableString(input['districtId']) : null,
        settlementId: isUzAddress ? nullableString(input['settlementId']) : null,
        regionText: isUzAddress ? null : nullableString(input['regionText']),
        districtText: isUzAddress ? null : nullableString(input['districtText']),
        settlementText: isUzAddress ? null : nullableString(input['settlementText']),
        ...(input['street'] !== undefined && { street: nullableString(input['street']) }),
        ...(input['house'] !== undefined && { house: nullableString(input['house']) }),
        ...(input['apartment'] !== undefined && { apartment: nullableString(input['apartment']) }),
        ...(input['postalCode'] !== undefined && { postalCode: nullableString(input['postalCode']) }),
      },
    });
  });
}

async function updatePersonalDocumentsSection(userId: string, input: Record<string, any>) {
  const domestic = input['domesticDocument'] as Record<string, any> | undefined;
  const international = input['internationalPassport'] as Record<string, any> | undefined;
  const additionalDocuments = input['additionalDocuments'] as Array<Record<string, any>> | undefined;

  await prisma.$transaction(async (tx: any) => {
    if (domestic && hasAnyValue(domestic)) {
      await ensureAssetOwned(userId, domestic['scanAssetId']);
      const country = nullableString(domestic['citizenshipCountryCode']);
      await tx.userIdentityDocument.upsert({
        where: { userId },
        create: {
          userId,
          ...normalizeDomesticDocument(domestic, country),
        },
        update: normalizeDomesticDocument(domestic, country),
      });
    }

    if (international && hasAnyValue(international)) {
      await ensureAssetOwned(userId, international['scanAssetId']);
      await tx.userInternationalPassport.upsert({
        where: { userId },
        create: {
          userId,
          countryCode: nullableString(international['countryCode']),
          series: nullableString(international['series']),
          number: nullableString(international['number']),
          issueDate: parseDateOrNull(international['issueDate']),
          expiryDate: parseDateOrNull(international['expiryDate']),
          issuedBy: nullableString(international['issuedBy']),
          scanAssetId: nullableString(international['scanAssetId']),
        },
        update: {
          ...(international['countryCode'] !== undefined && { countryCode: nullableString(international['countryCode']) }),
          ...(international['series'] !== undefined && { series: nullableString(international['series']) }),
          ...(international['number'] !== undefined && { number: nullableString(international['number']) }),
          ...(international['issueDate'] !== undefined && { issueDate: parseDateOrNull(international['issueDate']) }),
          ...(international['expiryDate'] !== undefined && { expiryDate: parseDateOrNull(international['expiryDate']) }),
          ...(international['issuedBy'] !== undefined && { issuedBy: nullableString(international['issuedBy']) }),
          ...(international['scanAssetId'] !== undefined && { scanAssetId: nullableString(international['scanAssetId']) }),
        },
      });
    }

    if (Array.isArray(additionalDocuments)) {
      for (const item of additionalDocuments) await ensureAssetOwned(userId, item['assetId']);
      await tx.userAdditionalDocument.deleteMany({
        where: { userId, type: { notIn: additionalDocuments.map(item => item['type']) } },
      });
      for (const item of additionalDocuments) {
        await tx.userAdditionalDocument.upsert({
          where: { userId_type: { userId, type: item['type'] } },
          create: {
            userId,
            type: item['type'],
            assetId: item['assetId'],
            notes: nullableString(item['notes']),
          },
          update: {
            assetId: item['assetId'],
            notes: nullableString(item['notes']),
          },
        });
      }
    }
  });
}

async function updateContactDataSection(userId: string, input: Record<string, any>) {
  await prisma.userSocialLinks.upsert({
    where: { userId },
    create: {
      userId,
      maxUrl: nullableString(input['maxUrl']),
      maxAbsent: Boolean(input['maxAbsent']),
      vkUrl: nullableString(input['vkUrl']),
      vkAbsent: Boolean(input['vkAbsent']),
      telegramUrl: nullableString(input['telegramUrl']),
      telegramAbsent: Boolean(input['telegramAbsent']),
      instagramUrl: nullableString(input['instagramUrl']),
      instagramAbsent: Boolean(input['instagramAbsent']),
      facebookUrl: nullableString(input['facebookUrl']),
      facebookAbsent: Boolean(input['facebookAbsent']),
      xUrl: nullableString(input['xUrl']),
      xAbsent: Boolean(input['xAbsent']),
    },
    update: {
      maxUrl: nullableString(input['maxUrl']),
      maxAbsent: Boolean(input['maxAbsent']),
      vkUrl: nullableString(input['vkUrl']),
      vkAbsent: Boolean(input['vkAbsent']),
      telegramUrl: nullableString(input['telegramUrl']),
      telegramAbsent: Boolean(input['telegramAbsent']),
      instagramUrl: nullableString(input['instagramUrl']),
      instagramAbsent: Boolean(input['instagramAbsent']),
      facebookUrl: nullableString(input['facebookUrl']),
      facebookAbsent: Boolean(input['facebookAbsent']),
      xUrl: nullableString(input['xUrl']),
      xAbsent: Boolean(input['xAbsent']),
    },
  });
}

async function updateActivityInfoSection(userId: string, input: Record<string, any>) {
  await prisma.$transaction(async (tx: any) => {
    await tx.userExtendedProfile.upsert({
      where: { userId },
      create: {
        userId,
        activityStatus: enumOrNull(input['activityStatus']),
        studiesInRussia: Boolean(input['studiesInRussia']),
        organizationName: nullableString(input['organizationName']),
        facultyOrDepartment: nullableString(input['facultyOrDepartment']),
        classCourseYear: nullableString(input['classCourseYear']),
        positionTitle: nullableString(input['positionTitle']),
        achievementsText: nullableString(input['achievementsText']),
        englishLevel: enumOrNull(input['englishLevel']),
        russianLevel: enumOrNull(input['russianLevel']),
      },
      update: {
        ...(input['activityStatus'] !== undefined && { activityStatus: enumOrNull(input['activityStatus']) }),
        ...(input['studiesInRussia'] !== undefined && { studiesInRussia: input['studiesInRussia'] }),
        ...(input['organizationName'] !== undefined && { organizationName: nullableString(input['organizationName']) }),
        ...(input['facultyOrDepartment'] !== undefined && { facultyOrDepartment: nullableString(input['facultyOrDepartment']) }),
        ...(input['classCourseYear'] !== undefined && { classCourseYear: nullableString(input['classCourseYear']) }),
        ...(input['positionTitle'] !== undefined && { positionTitle: nullableString(input['positionTitle']) }),
        ...(input['achievementsText'] !== undefined && { achievementsText: nullableString(input['achievementsText']) }),
        ...(input['englishLevel'] !== undefined && { englishLevel: enumOrNull(input['englishLevel']) }),
        ...(input['russianLevel'] !== undefined && { russianLevel: enumOrNull(input['russianLevel']) }),
      },
    });

    if (Array.isArray(input['activityDirections'])) {
      await tx.userActivityDirection.deleteMany({ where: { userId } });
      for (const direction of [...new Set(input['activityDirections'])]) {
        await tx.userActivityDirection.create({ data: { userId, direction } });
      }
    }

    if (Array.isArray(input['additionalLanguages'])) {
      await tx.userAdditionalLanguage.deleteMany({ where: { userId } });
      for (const languageName of [...new Set(input['additionalLanguages'].map((value: string) => value.trim()).filter(Boolean))]) {
        await tx.userAdditionalLanguage.create({ data: { userId, languageName } });
      }
    }

    if (input['emergencyContact']) {
      const contact = input['emergencyContact'] as Record<string, any>;
      await tx.userEmergencyContact.upsert({
        where: { userId },
        create: {
          userId,
          fullName: nullableString(contact['fullName']),
          relationship: nullableString(contact['relationship']),
          phone: nullableString(contact['phone']),
        },
        update: {
          fullName: nullableString(contact['fullName']),
          relationship: nullableString(contact['relationship']),
          phone: nullableString(contact['phone']),
        },
      });
    }
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
  const extended = user.extendedProfile ?? {};
  switch (sectionKey) {
    case 'registration_data': {
      const hasAny = [
        user.lastNameCyrillic,
        user.firstNameCyrillic,
        user.middleNameCyrillic,
        user.lastNameLatin,
        user.firstNameLatin,
        user.middleNameLatin,
        user.birthDate,
        user.phone,
        user.telegram,
        extended.gender,
        extended.citizenshipCountryCode,
        extended.residenceCountryCode,
      ].some(hasValue) || user.consentPersonalData;
      if (!hasAny) return 'NOT_STARTED';
      return isRegistrationDataComplete(user) ? 'COMPLETED' : 'IN_PROGRESS';
    }
    case 'general_info': {
      const hasAny = [
        user.avatarAssetId,
        user.avatarUrl,
        user.nativeLanguage,
        user.communicationLanguage,
        extended.regionId,
        extended.regionText,
        extended.street,
        extended.house,
        extended.postalCode,
      ].some(hasValue) || user.consentClientRules;
      if (!hasAny) return 'NOT_STARTED';
      return isGeneralInfoComplete(user) ? 'COMPLETED' : 'IN_PROGRESS';
    }
    case 'personal_documents': {
      const hasAny = Boolean(user.identityDocument || user.internationalPassport || (Array.isArray(user.additionalDocuments) && user.additionalDocuments.length > 0) || (Array.isArray(user.mediaAssets) && user.mediaAssets.length > 0));
      if (!hasAny) return 'NOT_STARTED';
      return isDomesticDocumentComplete(user.identityDocument, extended.citizenshipCountryCode) && isInternationalPassportComplete(user.internationalPassport) ? 'COMPLETED' : 'IN_PROGRESS';
    }
    case 'contact_data':
      if (!user.socialLinks) return 'NOT_STARTED';
      return isSocialLinksComplete(user.socialLinks) ? 'COMPLETED' : 'IN_PROGRESS';
    case 'activity_info': {
      const hasAny = [
        extended.activityStatus,
        extended.organizationName,
        extended.englishLevel,
        extended.russianLevel,
        extended.achievementsText,
      ].some(hasValue) || (Array.isArray(user.activityDirections) && user.activityDirections.length > 0);
      if (!hasAny) return 'NOT_STARTED';
      return isActivityInfoComplete(user) ? 'COMPLETED' : 'IN_PROGRESS';
    }
  }
}

async function getProfileUserForStatus(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: profileInclude,
  });
}

async function getProfileUserForResponse(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      ...profileInclude,
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

const profileInclude = {
  avatarAsset: true,
  extendedProfile: {
    include: {
      region: true,
      district: true,
      settlement: true,
    },
  },
  identityDocument: true,
  internationalPassport: true,
  socialLinks: true,
  activityDirections: true,
  additionalLanguages: true,
  additionalDocuments: {
    include: {
      asset: {
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          publicUrl: true,
          createdAt: true,
          status: true,
        },
      },
    },
  },
  emergencyContact: true,
  mediaAssets: {
    where: {
      purpose: 'DOCUMENT',
      status: 'ACTIVE',
    },
    select: { id: true },
  },
} as const;

function isRegistrationDataComplete(user: ProfileUser) {
  const extended = user.extendedProfile ?? {};
  const lastNameOk = user.hasNoLastName || (hasValue(user.lastNameCyrillic) && hasValue(user.lastNameLatin));
  const firstNameOk = user.hasNoFirstName || (hasValue(user.firstNameCyrillic) && hasValue(user.firstNameLatin));
  const middleNameOk = user.hasNoMiddleName || (hasValue(user.middleNameCyrillic) && hasValue(user.middleNameLatin));
  return lastNameOk
    && firstNameOk
    && middleNameOk
    && hasValue(user.birthDate)
    && hasValue(extended.gender)
    && hasValue(extended.citizenshipCountryCode)
    && hasValue(extended.residenceCountryCode)
    && hasValue(user.phone)
    && user.consentPersonalData === true;
}

function isGeneralInfoComplete(user: ProfileUser) {
  const extended = user.extendedProfile ?? {};
  const addressOk = extended.residenceCountryCode === 'UZ'
    ? everyValue(extended.regionId, extended.districtId, extended.settlementId, extended.street, extended.house, extended.postalCode)
    : everyValue(extended.residenceCountryCode, extended.regionText, extended.settlementText, extended.street, extended.house, extended.postalCode);
  return Boolean(user.avatarAssetId || user.avatarUrl)
    && addressOk
    && everyValue(user.nativeLanguage, user.communicationLanguage)
    && user.consentClientRules === true;
}

function isActivityInfoComplete(user: ProfileUser) {
  const extended = user.extendedProfile ?? {};
  return everyValue(extended.activityStatus, extended.organizationName, extended.englishLevel, extended.russianLevel)
    && Array.isArray(user.activityDirections)
    && user.activityDirections.length > 0;
}

function normalizeDomesticDocument(input: Record<string, any>, country: string | null) {
  const base = {
    citizenshipCountryCode: country,
    documentType: enumOrNull(input['documentType']),
    documentSeries: nullableString(input['documentSeries']),
    documentNumber: nullableString(input['documentNumber']),
    issueDate: parseDateOrNull(input['issueDate']),
    issuedBy: nullableString(input['issuedBy']),
    issueCountryCode: nullableString(input['issueCountryCode']),
    expiryDate: parseDateOrNull(input['expiryDate']),
    placeOfBirth: nullableString(input['placeOfBirth']),
    pinfl: nullableString(input['pinfl']),
    passportSeries: nullableString(input['passportSeries']),
    passportNumber: nullableString(input['passportNumber']),
    subdivisionCode: nullableString(input['subdivisionCode']),
    snils: nullableString(input['snils']),
    hasSecondCitizenship: Boolean(input['hasSecondCitizenship']),
    secondCitizenshipCountryCode: nullableString(input['secondCitizenshipCountryCode']),
    scanAssetId: nullableString(input['scanAssetId']),
  };

  if (country === 'UZ') {
    return { ...base, passportSeries: null, passportNumber: null, subdivisionCode: null, snils: null };
  }
  if (country === 'RU') {
    return { ...base, documentSeries: null, documentNumber: null, pinfl: null, expiryDate: null };
  }
  return { ...base, pinfl: null, passportSeries: null, passportNumber: null, subdivisionCode: null, snils: null, expiryDate: null };
}

async function ensureAssetOwned(userId: string, assetId: unknown) {
  const id = nullableString(assetId);
  if (!id) return;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, ownerUserId: userId, purpose: 'DOCUMENT', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!asset) throw new Error('MEDIA_ASSET_NOT_FOUND');
}

function valueOrExisting(input: Record<string, any>, key: string, existing: string | null) {
  return input[key] !== undefined ? nullableString(input[key]) : existing;
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

function enumOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseDateOrNull(value: unknown) {
  const raw = nullableString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_DATE');
  return date;
}

function hasValue(value: unknown) {
  if (value instanceof Date) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function hasAnyValue(input: Record<string, any>) {
  return Object.values(input).some(hasValue);
}

function everyValue(...values: unknown[]) {
  return values.every(hasValue);
}

function buildAddressString(input: Record<string, any>) {
  const parts = [
    input['regionText'],
    input['districtText'],
    input['settlementText'],
    input['street'],
    input['house'],
    input['apartment'],
  ].map(nullableString).filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
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

function publicMediaAsset(asset: Record<string, any>) {
  return {
    id: asset.id,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    publicUrl: typeof asset.storageKey === 'string' ? buildPublicMediaUrl(asset.storageKey) : asset.publicUrl,
    createdAt: asset.createdAt,
    status: asset.status,
  };
}
