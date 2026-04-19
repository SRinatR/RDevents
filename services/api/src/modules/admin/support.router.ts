import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import {
  adminThreadQuerySchema,
  addMessageSchema,
  assignThreadSchema,
  updateThreadStatusSchema,
} from '../support/support.schemas.js';
import {
  listAdminThreads,
  getAdminThread,
  addAdminReply,
  takeThread,
  assignThread,
  updateThreadStatus,
  markAdminThreadRead,
} from '../support/support.service.js';

export const adminSupportRouter = Router();

// All admin support routes require platform admin role.
adminSupportRouter.use(requirePlatformAdmin);

// GET /api/admin/support/threads
adminSupportRouter.get('/threads', async (req, res) => {
  const parsed = adminThreadQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const result = await listAdminThreads(parsed.data);
  res.json(result);
});

// GET /api/admin/support/threads/:threadId
adminSupportRouter.get('/threads/:threadId', async (req, res) => {
  const thread = await getAdminThread(String(req.params['threadId']));
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json({ thread });
});

// POST /api/admin/support/threads/:threadId/reply
adminSupportRouter.post('/threads/:threadId/reply', async (req, res) => {
  const parsed = addMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const adminId = (req as AuthenticatedRequest).user!.id;
  const result = await addAdminReply(adminId, String(req.params['threadId']), parsed.data);

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

// POST /api/admin/support/threads/:threadId/take
adminSupportRouter.post('/threads/:threadId/take', async (req, res) => {
  const adminId = (req as AuthenticatedRequest).user!.id;
  const result = await takeThread(adminId, String(req.params['threadId']));

  if (result === null) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  if ('error' in result && result.error === 'THREAD_CLOSED') {
    res.status(409).json({ error: 'Thread is closed', code: 'THREAD_CLOSED' });
    return;
  }

  res.json(result);
});

// POST /api/admin/support/threads/:threadId/assign
adminSupportRouter.post('/threads/:threadId/assign', async (req, res) => {
  const parsed = assignThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const result = await assignThread(String(req.params['threadId']), parsed.data.adminUserId);

  if ('error' in result) {
    const errorMap: Record<string, [number, string]> = {
      THREAD_NOT_FOUND: [404, 'Thread not found'],
      ADMIN_NOT_FOUND: [404, 'Target admin user not found'],
      TARGET_NOT_ADMIN: [400, 'Target user is not a platform admin'],
    };
    const [status, message] = errorMap[result.error] ?? [500, 'Internal error'];
    res.status(status).json({ error: message, code: result.error });
    return;
  }

  res.json(result);
});

// POST /api/admin/support/threads/:threadId/status
adminSupportRouter.post('/threads/:threadId/status', async (req, res) => {
  const parsed = updateThreadStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const result = await updateThreadStatus(String(req.params['threadId']), parsed.data.status);
  if (!result) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  res.json(result);
});

// POST /api/admin/support/threads/:threadId/read
adminSupportRouter.post('/threads/:threadId/read', async (req, res) => {
  const adminId = (req as AuthenticatedRequest).user!.id;
  const result = await markAdminThreadRead(adminId, String(req.params['threadId']));
  if (!result) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  res.json(result);
});
