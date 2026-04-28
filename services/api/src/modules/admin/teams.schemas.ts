import { z } from 'zod';

export const listTeamsQuerySchema = z.object({
  search: z.string().optional(),
  eventId: z.string().optional(),
  status: z.enum(['ALL', 'DRAFT', 'ACTIVE', 'APPROVED', 'PENDING', 'CHANGES_PENDING', 'NEEDS_ATTENTION', 'REJECTED', 'SUBMITTED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const updateAdminTeamSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  maxSize: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'APPROVED', 'PENDING', 'CHANGES_PENDING', 'NEEDS_ATTENTION', 'REJECTED', 'SUBMITTED', 'ARCHIVED']).optional(),
  captainUserId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const adminTeamMemberSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(['CAPTAIN', 'MEMBER']).optional().default('MEMBER'),
  status: z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED', 'LEFT']).optional().default('ACTIVE'),
  reason: z.string().trim().max(500).optional(),
  forceMoveFromOtherTeam: z.boolean().optional().default(false),
  allowOverCapacity: z.boolean().optional().default(false),
}).refine((value) => Boolean(value.userId || value.email), {
  message: 'userId or email is required',
  path: ['userId'],
});

export const updateAdminTeamMemberSchema = z.object({
  role: z.enum(['CAPTAIN', 'MEMBER']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED', 'LEFT']).optional(),
}).refine((value) => value.role !== undefined || value.status !== undefined, {
  message: 'role or status is required',
});

export const transferAdminTeamCaptainSchema = z.object({
  userId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
  forceMoveFromOtherTeam: z.boolean().optional().default(false),
  allowOverCapacity: z.boolean().optional().default(false),
});

export const replaceAdminTeamMemberSchema = z.object({
  oldUserId: z.string().trim().min(1),
  newUserId: z.string().trim().min(1).optional(),
  newUserEmail: z.string().trim().email().optional(),
  reason: z.string().trim().min(1).max(500),
  forceMoveFromOtherTeam: z.boolean().optional().default(false),
  allowOverCapacity: z.boolean().optional().default(false),
}).refine((value) => Boolean(value.newUserId || value.newUserEmail), {
  message: 'newUserId or newUserEmail is required',
  path: ['newUserId'],
});

export const replaceAdminTeamRosterSchema = z.object({
  memberUserIds: z.array(z.string().trim().min(1)).min(1),
  captainUserId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'APPROVED', 'PENDING', 'CHANGES_PENDING', 'NEEDS_ATTENTION', 'REJECTED', 'SUBMITTED', 'ARCHIVED']).optional(),
  reason: z.string().trim().min(1).max(500),
  forceMoveFromOtherTeam: z.boolean().optional().default(false),
  allowOverCapacity: z.boolean().optional().default(false),
});

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
export type UpdateAdminTeamInput = z.infer<typeof updateAdminTeamSchema>;

export interface TeamRow {
  id: string;
  name: string;
  eventId: string;
  eventTitle: string;
  captainUserId: string | null;
  captainUserName: string | null;
  membersCount: number;
  status: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'PENDING' | 'CHANGES_PENDING' | 'NEEDS_ATTENTION' | 'REJECTED' | 'SUBMITTED' | 'ARCHIVED';
  createdAt: string;
}
