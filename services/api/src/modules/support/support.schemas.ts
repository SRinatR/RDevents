import { z } from 'zod';

export const createThreadSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

export const addMessageSchema = z.object({
  body: z.string().max(10000).default(''),
  attachmentIds: z.array(z.string()).max(5).default([]),
}).refine(
  (data) => data.body.trim().length > 0 || data.attachmentIds.length > 0,
  { message: 'Message body or at least one attachment is required' },
);

export const assignThreadSchema = z.object({
  adminUserId: z.string().min(1),
});

export const updateThreadStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'CLOSED']),
});

export const threadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'CLOSED']).optional(),
});

export const adminThreadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'CLOSED']).optional(),
  assignedAdminId: z.string().optional(),
  unassigned: z.coerce.boolean().optional(),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type AddMessageInput = z.infer<typeof addMessageSchema>;
export type ThreadQuery = z.infer<typeof threadQuerySchema>;
export type AdminThreadQuery = z.infer<typeof adminThreadQuerySchema>;
