import { z } from 'zod';

export const eventStaffRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MANAGER',
  'PR_MANAGER',
  'CHECKIN_OPERATOR',
  'VIEWER',
]);

export const createWorkspaceEventAccessPolicySchema = z.object({
  userId: z.string().min(1),
  role: eventStaffRoleSchema,
  includePastEvents: z.boolean().default(false),
  includeCurrentEvents: z.boolean().default(false),
  includeFutureEvents: z.boolean().default(false),
  includeCancelledEvents: z.boolean().default(false),
  autoApplyToNewEvents: z.boolean().default(false),
  fullWorkspaceAccess: z.boolean().default(false),
});

export const createDirectEventStaffGrantSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: eventStaffRoleSchema.default('ADMIN'),
  reason: z.string().max(500).optional().nullable(),
}).refine(value => value.userId || value.email, {
  message: 'userId or email is required',
  path: ['userId'],
});

export const updateEventStaffGrantSchema = z.object({
  role: eventStaffRoleSchema.optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'REMOVED']).optional(),
  reason: z.string().max(500).optional().nullable(),
});

export type CreateWorkspaceEventAccessPolicyBody = z.infer<typeof createWorkspaceEventAccessPolicySchema>;
export type CreateDirectEventStaffGrantBody = z.infer<typeof createDirectEventStaffGrantSchema>;
