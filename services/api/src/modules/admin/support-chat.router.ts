import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import { adminSupportChatListQuerySchema, sendSupportChatMessageSchema } from '../support-chat/support-chat.schemas.js';
import { getAdminSupportChatThread, listAdminSupportChats, sendAdminSupportChatMessage } from '../support-chat/support-chat.service.js';

export const adminSupportChatRouter = Router();

adminSupportChatRouter.use(requirePlatformAdmin);

adminSupportChatRouter.get('/threads', async (req, res) => {
  const parsed = adminSupportChatListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }
  const result = await listAdminSupportChats(parsed.data);
  res.json(result);
});

adminSupportChatRouter.get('/threads/:threadId', async (req, res) => {
  const thread = await getAdminSupportChatThread(String(req.params['threadId']));
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json({ thread });
});

adminSupportChatRouter.post('/threads/:threadId/messages', async (req, res) => {
  const parsed = sendSupportChatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const adminId = (req as AuthenticatedRequest).user!.id;
  const result = await sendAdminSupportChatMessage(adminId, String(req.params['threadId']), parsed.data);
  if (!result) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.status(201).json(result);
});
