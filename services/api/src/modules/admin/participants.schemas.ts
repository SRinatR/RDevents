import { z } from 'zod';

export const listParticipantsQuerySchema = z.object({
  search: z.string().optional(),
  eventId: z.string().optional(),
  role: z.enum(['ALL', 'PARTICIPANT', 'VOLUNTEER']).optional(),
  status: z.enum(['ALL', 'ACTIVE', 'PENDING', 'RESERVE', 'REJECTED', 'CANCELLED', 'REMOVED']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export type ListParticipantsQuery = z.infer<typeof listParticipantsQuerySchema>;

export interface ParticipantRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userCity?: string | null;
  eventId: string;
  eventTitle: string;
  role: 'PARTICIPANT' | 'VOLUNTEER';
  status: 'ACTIVE' | 'PENDING' | 'RESERVE' | 'REJECTED' | 'CANCELLED' | 'REMOVED';
  assignedAt: string;
}
