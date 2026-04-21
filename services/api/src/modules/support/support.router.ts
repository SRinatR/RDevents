import { Router } from 'express';
import { requireAuth } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import { supportUpload, validateSupportFile, SupportUploadError } from '../../common/upload.js';
import {
  threadQuerySchema,
  createThreadSchema,
  addMessageSchema,
} from './support.schemas.js';
import {
  listUserThreads,
  createThread,
  deleteEmptyThread,
  deleteUserThread,
  getUserThread,
  addUserMessage,
  markUserThreadRead,
  uploadSupportAttachments,
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

// DELETE /api/support/threads/:threadId/empty  — cleanup if upload/send failed after create
supportRouter.delete('/threads/:threadId/empty', async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = await deleteEmptyThread(userId, String(req.params['threadId']));
  if (!result) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json(result);
});

// DELETE /api/support/threads/:threadId
supportRouter.delete('/threads/:threadId', async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.id;
  const result = await deleteUserThread(userId, String(req.params['threadId']));
  if (!result) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json(result);
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
  if ('error' in result) {
    if (result.error === 'THREAD_CLOSED') {
      res.status(409).json({ error: 'Thread is closed', code: 'THREAD_CLOSED' });
      return;
    }
    if (result.error === 'INVALID_ATTACHMENTS') {
      res.status(400).json({ error: 'One or more attachment IDs are invalid or already used', code: 'INVALID_ATTACHMENTS' });
      return;
    }
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

// POST /api/support/threads/:threadId/attachments
supportRouter.post(
  '/threads/:threadId/attachments',
  supportUpload.array('files', 5),
  async (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const threadId = String(req.params['threadId']);
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'At least one file is required' });
      return;
    }

    try {
      for (const file of files) {
        validateSupportFile(file);
      }
    } catch (err) {
      if (err instanceof SupportUploadError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const result = await uploadSupportAttachments(userId, threadId, files, 'USER');
    if (!result) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    res.status(201).json(result);
  },
);
