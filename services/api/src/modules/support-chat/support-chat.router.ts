import { Router } from 'express';
import { requireAuth } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import { sendSupportChatMessageSchema } from './support-chat.schemas.js';
import { getOrCreateUserSupportChat, sendUserSupportChatMessage } from './support-chat.service.js';

export const supportChatRouter = Router();

supportChatRouter.use(requireAuth);

supportChatRouter.get('/thread', async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const thread = await getOrCreateUserSupportChat(userId);
  res.json({ thread });
});

supportChatRouter.post('/thread/messages', async (req, res) => {
  const parsed = sendSupportChatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = await sendUserSupportChatMessage(userId, parsed.data);
  res.status(201).json(result);
});
