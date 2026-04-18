import { z } from 'zod';

export const listTeamsQuerySchema = z.object({
  search: z.string().optional(),
  eventId: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'PENDING', 'REJECTED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;

export interface TeamRow {
  id: string;
  name: string;
  eventId: string;
  eventTitle: string;
  captainUserId: string | null;
  captainUserName: string | null;
  membersCount: number;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'ARCHIVED';
  createdAt: string;
}
