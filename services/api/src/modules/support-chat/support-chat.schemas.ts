import { z } from 'zod';

export const sendSupportChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const adminSupportChatListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
});

export type SendSupportChatMessageInput = z.infer<typeof sendSupportChatMessageSchema>;
export type AdminSupportChatListQuery = z.infer<typeof adminSupportChatListQuerySchema>;
