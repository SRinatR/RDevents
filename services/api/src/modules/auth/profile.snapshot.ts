import { buildPublicMediaUrl } from '../../common/storage.js';
import { prisma } from '../../db/prisma.js';

export async function getProfileSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      avatarAsset: true,
      extendedProfile: true,
      identityDocument: true,
      internationalPassport: true,
      socialLinks: true,
      activityDirections: true,
      additionalLanguages: true,
      additionalDocuments: { include: { asset: true } },
      emergencyContact: true,
    },
  });

  if (!user) return null;
  return buildProfileSnapshot(user as any);
}

export function buildProfileSnapshot(user: Record<string, any>) {
  const extended = user.extendedProfile ?? {};
  const identityDocument = user.identityDocument ?? {};
  const internationalPassport = user.internationalPassport ?? {};
  const socialLinks = user.socialLinks ?? {};
  const avatarUrl = user.avatarAsset?.storageKey
    ? buildPublicMediaUrl(user.avatarAsset.storageKey)
    : (user.avatarAsset?.publicUrl ?? user.avatarUrl ?? null);

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.fullNameCyrillic ?? user.fullNameLatin,
    bio: user.bio,
    city: user.city,
    factualAddress: user.factualAddress,
    phone: user.phone,
    telegram: user.telegram,
    nativeLanguage: user.nativeLanguage,
    communicationLanguage: user.communicationLanguage,
    birthDate: user.birthDate,
    avatarUrl: avatarUrl ?? user.avatarAssetId,
    avatarAssetId: user.avatarAssetId,
    consentPersonalData: user.consentPersonalData,
    consentClientRules: user.consentClientRules,
    lastNameCyrillic: user.lastNameCyrillic,
    firstNameCyrillic: user.firstNameCyrillic,
    middleNameCyrillic: user.middleNameCyrillic,
    lastNameLatin: user.lastNameLatin,
    firstNameLatin: user.firstNameLatin,
    middleNameLatin: user.middleNameLatin,
    hasNoLastName: user.hasNoLastName,
    hasNoFirstName: user.hasNoFirstName,
    hasNoMiddleName: user.hasNoMiddleName,
    gender: extended.gender,
    citizenshipCountryCode: extended.citizenshipCountryCode,
    residenceCountryCode: extended.residenceCountryCode,
    regionId: extended.regionId,
    districtId: extended.districtId,
    settlementId: extended.settlementId,
    regionText: extended.regionText,
    districtText: extended.districtText,
    settlementText: extended.settlementText,
    street: extended.street,
    house: extended.house,
    apartment: extended.apartment,
    postalCode: extended.postalCode,
    consentMailing: extended.consentMailing,
    activityStatus: extended.activityStatus,
    studiesInRussia: extended.studiesInRussia,
    organizationName: extended.organizationName,
    facultyOrDepartment: extended.facultyOrDepartment,
    classCourseYear: extended.classCourseYear,
    positionTitle: extended.positionTitle,
    achievementsText: extended.achievementsText,
    englishLevel: extended.englishLevel,
    russianLevel: extended.russianLevel,
    activityDirections: Array.isArray(user.activityDirections) ? user.activityDirections.map((item: any) => item.direction) : [],
    additionalLanguages: Array.isArray(user.additionalLanguages) ? user.additionalLanguages.map((item: any) => item.languageName) : [],
    emergencyContact: user.emergencyContact ?? null,
    identityDocument,
    internationalPassport,
    socialLinks,
    domesticDocumentComplete: isDomesticDocumentComplete(identityDocument, extended.citizenshipCountryCode),
    internationalPassportComplete: isInternationalPassportComplete(internationalPassport),
    personalDocumentsComplete: isDomesticDocumentComplete(identityDocument, extended.citizenshipCountryCode) && isInternationalPassportComplete(internationalPassport),
    contactDataComplete: isSocialLinksComplete(socialLinks),
  };
}

export function isDomesticDocumentComplete(document: Record<string, any> | null | undefined, citizenshipCountryCode?: string | null) {
  if (!document) return false;
  const country = document.citizenshipCountryCode ?? citizenshipCountryCode;
  if (country === 'UZ') {
    return everyValue(document.documentType, document.documentSeries, document.documentNumber, document.pinfl, document.issueDate, document.issuedBy, document.scanAssetId);
  }
  if (country === 'RU') {
    return everyValue(document.passportSeries, document.passportNumber, document.issueDate, document.issuedBy, document.subdivisionCode, document.placeOfBirth, document.snils, document.scanAssetId);
  }
  return everyValue(document.documentType, document.documentNumber, document.issueDate, document.issuedBy, document.placeOfBirth, document.scanAssetId);
}

export function isInternationalPassportComplete(passport: Record<string, any> | null | undefined) {
  if (!passport) return false;
  return everyValue(passport.countryCode, passport.number, passport.issueDate, passport.expiryDate, passport.issuedBy, passport.scanAssetId);
}

export function isSocialLinksComplete(links: Record<string, any> | null | undefined) {
  if (!links) return false;
  return ['max', 'vk', 'telegram', 'instagram', 'facebook', 'x'].every((key) => {
    const url = links[`${key}Url`];
    const absent = links[`${key}Absent`];
    return (hasText(url) && !absent) || (!hasText(url) && absent === true);
  });
}

function everyValue(...values: unknown[]) {
  return values.every(hasText);
}

function hasText(value: unknown) {
  if (value instanceof Date) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
