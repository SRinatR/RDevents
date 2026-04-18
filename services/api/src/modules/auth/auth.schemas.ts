import { z } from 'zod';

export const startRegistrationSchema = z.object({
  email: z.string().email(),
});

export const verifyRegistrationCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().regex(/^\d{6}$/, 'Verification code must contain 6 digits'),
});

export const completeRegistrationSchema = z.object({
  email: z.string().email(),
  registrationToken: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional().or(z.literal('')),
  bio: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  factualAddress: z.string().max(255).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  telegram: z.string().max(64).optional(),
  phoneVerifiedAt: z.string().datetime().optional().or(z.literal('')),
  telegramVerifiedAt: z.string().datetime().optional().or(z.literal('')),
  nativeLanguage: z.string().max(100).optional().or(z.literal('')),
  communicationLanguage: z.string().max(100).optional().or(z.literal('')),
  consentPersonalData: z.boolean().optional(),
  consentClientRules: z.boolean().optional(),
  birthDate: z.string().datetime().optional().or(z.literal('')),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  // Cyrillic name fields
  lastNameCyrillic: z.string().max(100).optional().or(z.literal('')),
  firstNameCyrillic: z.string().max(100).optional().or(z.literal('')),
  middleNameCyrillic: z.string().max(100).optional().or(z.literal('')),
  // Latin name fields
  lastNameLatin: z.string().max(100).optional().or(z.literal('')),
  firstNameLatin: z.string().max(100).optional().or(z.literal('')),
  middleNameLatin: z.string().max(100).optional().or(z.literal('')),
});

export const socialAuthSchema = z.object({
  // For dev mock flow — pass provider data directly
  providerAccountId: z.string(),
  providerEmail: z.string().email().optional(),
  providerUsername: z.string().optional(),
  providerAvatarUrl: z.string().optional(),
  // For production OAuth — pass code from provider
  code: z.string().optional(),
});

export type StartRegistrationInput = z.infer<typeof startRegistrationSchema>;
export type VerifyRegistrationCodeInput = z.infer<typeof verifyRegistrationCodeSchema>;
export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
