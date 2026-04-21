import { z } from 'zod';

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const verifyPasswordResetTokenSchema = z.object({
  token: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type VerifyPasswordResetTokenInput = z.infer<typeof verifyPasswordResetTokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
