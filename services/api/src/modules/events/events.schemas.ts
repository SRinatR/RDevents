import { z } from 'zod';

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
  sort: z.enum(['startsAt', 'registrationsCount', 'createdAt']).default('startsAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const createEventSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(3).max(200),
  shortDescription: z.string().min(10).max(500),
  fullDescription: z.string().min(20),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  category: z.string().min(1),
  location: z.string().min(1),
  capacity: z.coerce.number().int().min(1).default(100),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  registrationOpensAt: z.string().min(1).optional().or(z.literal('')),
  registrationDeadline: z.string().min(1).optional().or(z.literal('')),
  conditions: z.string().optional().or(z.literal('')),
  contactEmail: z.string().email().optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  isTeamBased: z.boolean().default(false),
  minTeamSize: z.coerce.number().int().min(1).default(1),
  maxTeamSize: z.coerce.number().int().min(1).default(1),
  allowSoloParticipation: z.boolean().default(true),
  teamJoinMode: z.enum(['OPEN', 'BY_CODE', 'BY_REQUEST']).default('OPEN'),
  requireAdminApprovalForTeams: z.boolean().default(false),
  requiredProfileFields: z.array(z.string()).default([]),
  requiredEventFields: z.array(z.string()).default([]),
});

export const registrationAnswersSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const updateEventSchema = createEventSchema.partial();

export type EventQuery = z.infer<typeof eventQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
