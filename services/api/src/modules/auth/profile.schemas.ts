import { z } from 'zod';

const optionalString = (max = 255) => z.string().max(max).optional().or(z.literal(''));
const optionalCountryCode = optionalString(8);
const optionalDate = z.string().optional().or(z.literal(''));

const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
const documentTypeSchema = z.enum(['PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT', 'OTHER']);
const activityStatusSchema = z.enum(['SCHOOL_STUDENT', 'COLLEGE_STUDENT', 'UNIVERSITY_STUDENT', 'EMPLOYED', 'UNEMPLOYED']);
const languageLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE']);
const activityDirectionSchema = z.enum([
  'SCIENCE_EDUCATION',
  'PUBLIC_ADMINISTRATION_LAW',
  'MEDIA',
  'CREATIVE_INDUSTRIES',
  'ENTREPRENEURSHIP',
  'SPORT_HEALTHCARE',
  'AGRICULTURE_AGROTECH',
  'DIGITALIZATION_IT',
  'TOURISM_HOSPITALITY',
  'ECOLOGY',
  'CIVIL_SOCIETY',
  'ARCHITECTURE_CONSTRUCTION',
  'ECONOMICS_FINANCE',
  'INDUSTRY_TECHNOLOGY_ENGINEERING',
  'OTHER',
]);
const additionalDocumentTypeSchema = z.enum(['SCHOOL_PROOF', 'STUDENT_PROOF', 'BIRTH_CERTIFICATE']);

export const profileRegistrationDataSectionSchema = z.object({
  lastNameCyrillic: optionalString(100),
  firstNameCyrillic: optionalString(100),
  middleNameCyrillic: optionalString(100),
  lastNameLatin: optionalString(100),
  firstNameLatin: optionalString(100),
  middleNameLatin: optionalString(100),
  hasNoLastName: z.boolean().optional(),
  hasNoFirstName: z.boolean().optional(),
  hasNoMiddleName: z.boolean().optional(),
  birthDate: optionalDate,
  gender: genderSchema.optional().or(z.literal('')),
  citizenshipCountryCode: optionalCountryCode,
  residenceCountryCode: optionalCountryCode,
  phone: z.string().max(32).optional().or(z.literal('')),
  telegram: z.string().max(64).optional().or(z.literal('')),
  consentPersonalData: z.boolean().optional(),
  consentMailing: z.boolean().optional(),
});

export const profileGeneralInfoSectionSchema = z.object({
  residenceCountryCode: optionalCountryCode,
  regionId: optionalString(64),
  districtId: optionalString(64),
  settlementId: optionalString(64),
  regionText: optionalString(120),
  districtText: optionalString(120),
  settlementText: optionalString(120),
  street: optionalString(255),
  house: optionalString(32),
  apartment: optionalString(32),
  postalCode: optionalString(32),
  nativeLanguage: optionalString(100),
  communicationLanguage: optionalString(100),
  consentClientRules: z.boolean().optional(),
});

const domesticDocumentSchema = z.object({
  citizenshipCountryCode: optionalCountryCode,
  documentType: documentTypeSchema.optional().or(z.literal('')),
  documentSeries: optionalString(32),
  documentNumber: optionalString(64),
  issueDate: optionalDate,
  issuedBy: optionalString(255),
  issueCountryCode: optionalCountryCode,
  expiryDate: optionalDate,
  placeOfBirth: optionalString(255),
  pinfl: optionalString(32),
  passportSeries: optionalString(16),
  passportNumber: optionalString(32),
  subdivisionCode: optionalString(32),
  snils: optionalString(32),
  hasSecondCitizenship: z.boolean().optional(),
  secondCitizenshipCountryCode: optionalCountryCode,
  scanAssetId: optionalString(128),
}).partial();

const internationalPassportSchema = z.object({
  countryCode: optionalCountryCode,
  series: optionalString(32),
  number: optionalString(64),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  issuedBy: optionalString(255),
  scanAssetId: optionalString(128),
}).partial();

export const profilePersonalDocumentsSectionSchema = z.object({
  domesticDocument: domesticDocumentSchema.optional(),
  internationalPassport: internationalPassportSchema.optional(),
  additionalDocuments: z.array(z.object({
    type: additionalDocumentTypeSchema,
    assetId: z.string().min(1),
    notes: optionalString(255),
  })).max(10).optional(),
});

const socialUrl = z.string().url().optional().or(z.literal(''));
export const profileContactDataSectionSchema = z.object({
  maxUrl: socialUrl,
  maxAbsent: z.boolean().optional(),
  vkUrl: socialUrl,
  vkAbsent: z.boolean().optional(),
  telegramUrl: socialUrl,
  telegramAbsent: z.boolean().optional(),
  instagramUrl: socialUrl,
  instagramAbsent: z.boolean().optional(),
  facebookUrl: socialUrl,
  facebookAbsent: z.boolean().optional(),
  xUrl: socialUrl,
  xAbsent: z.boolean().optional(),
}).superRefine((value, ctx) => {
  for (const key of ['max', 'vk', 'telegram', 'instagram', 'facebook', 'x'] as const) {
    const url = value[`${key}Url` as keyof typeof value] as string | undefined;
    const absent = Boolean(value[`${key}Absent` as keyof typeof value]);
    const hasUrl = typeof url === 'string' && url.trim().length > 0;
    if (hasUrl && absent) {
      ctx.addIssue({ code: 'custom', path: [`${key}Absent`], message: 'Choose either URL or absent flag' });
    }
    if (!hasUrl && !absent) {
      ctx.addIssue({ code: 'custom', path: [`${key}Url`], message: 'URL or absent flag is required' });
    }
  }
});

export const profileActivityInfoSectionSchema = z.object({
  activityStatus: activityStatusSchema.optional().or(z.literal('')),
  studiesInRussia: z.boolean().optional(),
  organizationName: optionalString(255),
  facultyOrDepartment: optionalString(255),
  classCourseYear: optionalString(64),
  positionTitle: optionalString(255),
  activityDirections: z.array(activityDirectionSchema).max(20).optional(),
  achievementsText: optionalString(4000),
  englishLevel: languageLevelSchema.optional().or(z.literal('')),
  russianLevel: languageLevelSchema.optional().or(z.literal('')),
  additionalLanguages: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  emergencyContact: z.object({
    fullName: optionalString(160),
    relationship: optionalString(80),
    phone: optionalString(32),
  }).optional(),
});

export const profileSectionSchemaMap = {
  registration_data: profileRegistrationDataSectionSchema,
  general_info: profileGeneralInfoSectionSchema,
  personal_documents: profilePersonalDocumentsSectionSchema,
  contact_data: profileContactDataSectionSchema,
  activity_info: profileActivityInfoSectionSchema,
} as const;

export type ProfileRegistrationDataSectionInput = z.infer<typeof profileRegistrationDataSectionSchema>;
export type ProfileGeneralInfoSectionInput = z.infer<typeof profileGeneralInfoSectionSchema>;
export type ProfilePersonalDocumentsSectionInput = z.infer<typeof profilePersonalDocumentsSectionSchema>;
export type ProfileContactDataSectionInput = z.infer<typeof profileContactDataSectionSchema>;
export type ProfileActivityInfoSectionInput = z.infer<typeof profileActivityInfoSectionSchema>;
