import { z } from 'zod';

export const organizerWorkspaceKindSchema = z.enum([
  'ROOT_ORGANIZATION',
  'DEPARTMENT',
  'SUBDEPARTMENT',
  'WORKING_GROUP',
  'EXTERNAL_PARTNER',
]);

export const organizerWorkspaceStatusSchema = z.enum(['ACTIVE', 'ARCHIVED', 'DISABLED']);

export const organizerMemberRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MANAGER',
  'PR_MANAGER',
  'CHECKIN_MANAGER',
  'VIEWER',
]);

export const organizerMemberStatusSchema = z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED']);

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional().nullable(),
  kind: organizerWorkspaceKindSchema.default('DEPARTMENT'),
  parentId: z.string().min(1).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial().extend({
  status: organizerWorkspaceStatusSchema.optional(),
});

export const upsertWorkspaceMemberSchema = z.object({
  userId: z.string().min(1),
  role: organizerMemberRoleSchema,
  status: organizerMemberStatusSchema.default('ACTIVE'),
});

export const updateWorkspaceMemberSchema = z.object({
  role: organizerMemberRoleSchema.optional(),
  status: organizerMemberStatusSchema.optional(),
});

export type CreateWorkspaceBody = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceBody = z.infer<typeof updateWorkspaceSchema>;
