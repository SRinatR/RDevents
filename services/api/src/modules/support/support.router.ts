import { Router } from 'express';
import { requireAuth } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import {
  threadQuerySchema,
  createThreadSchema,
  addMessageSchema,
} from './support.schemas.js';
import {
  listUserThreads,
  createThread,
  getUserThread,
  addUserMessage,
  markUserThreadRead,
} from './support.service.js';

export const supportRouter = Router();

supportRouter.use(requireAuth);

// GET /api/support/threads
supportRouter.get('/threads', async (req, res) => {
  const parsed = threadQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const userId = (req as AuthenticatedRequest).user!.id;
  const result = await listUserThreads(userId, parsed.data);
  res.json(result);
});

// POST /api/support/threads
supportRouter.post('/threads', async (req, res) => {
  const parsed = createThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const userId = (req as AuthenticatedRequest).user!.id;
  const thread = await createThread(userId, parsed.data);
  res.status(201).json({ thread });
});

// GET /api/support/threads/:threadId
supportRouter.get('/threads/:threadId', async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const thread = await getUserThread(userId, String(req.params['threadId']));
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json({ thread });
});

// POST /api/support/threads/:threadId/messages
supportRouter.post('/threads/:threadId/messages', async (req, res) => {
  const parsed = addMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const userId = (req as AuthenticatedRequest).user!.id;
  const result = await addUserMessage(userId, String(req.params['threadId']), parsed.data);

  if (result === null) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  if ('error' in result && result.error === 'THREAD_CLOSED') {
    res.status(409).json({ error: 'Thread is closed', code: 'THREAD_CLOSED' });
    return;
  }

  res.status(201).json(result);
});

// POST /api/support/threads/:threadId/read
supportRouter.post('/threads/:threadId/read', async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = await markUserThreadRead(userId, String(req.params['threadId']));
  if (!result) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json(result);
});
