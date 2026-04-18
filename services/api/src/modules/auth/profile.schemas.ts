import { z } from 'zod';

export const profileBasicSectionSchema = z.object({
  lastNameCyrillic: z.string().max(100).optional().or(z.literal('')),
  firstNameCyrillic: z.string().max(100).optional().or(z.literal('')),
  middleNameCyrillic: z.string().max(100).optional().or(z.literal('')),
  lastNameLatin: z.string().max(100).optional().or(z.literal('')),
  firstNameLatin: z.string().max(100).optional().or(z.literal('')),
  middleNameLatin: z.string().max(100).optional().or(z.literal('')),
  birthDate: z.string().datetime().optional().or(z.literal('')),
});

export const profileContactsSectionSchema = z.object({
  phone: z.string().max(20).optional().or(z.literal('')),
  telegram: z.string().max(64).optional().or(z.literal('')),
});

export const profileAddressSectionSchema = z.object({
  city: z.string().max(100).optional().or(z.literal('')),
  factualAddress: z.string().max(255).optional().or(z.literal('')),
});

export const profileLanguagesSectionSchema = z.object({
  nativeLanguage: z.string().max(100).optional().or(z.literal('')),
  communicationLanguage: z.string().max(100).optional().or(z.literal('')),
});

export const profileSectionSchemaMap = {
  basic: profileBasicSectionSchema,
  photo: z.object({}).strict(),
  contacts: profileContactsSectionSchema,
  address: profileAddressSectionSchema,
  languages: profileLanguagesSectionSchema,
  documents: z.object({}).strict(),
} as const;

export type ProfileBasicSectionInput = z.infer<typeof profileBasicSectionSchema>;
export type ProfileContactsSectionInput = z.infer<typeof profileContactsSectionSchema>;
export type ProfileAddressSectionInput = z.infer<typeof profileAddressSectionSchema>;
export type ProfileLanguagesSectionInput = z.infer<typeof profileLanguagesSectionSchema>;
