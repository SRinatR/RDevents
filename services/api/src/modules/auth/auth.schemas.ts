import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
