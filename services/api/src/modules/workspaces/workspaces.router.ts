import { Router } from 'express';
import type { User } from '@prisma/client';
import { buildAuditRequestContext } from '../access-control/access-control.audit.js';
import {
  archiveWorkspace,
  createWorkspace,
  getWorkspace,
  listWorkspaceMembers,
  listWorkspaces,
  restoreWorkspace,
  updateWorkspace,
  updateWorkspaceMember,
  upsertWorkspaceMember,
} from './workspaces.service.js';
import {
  createWorkspaceSchema,
  updateWorkspaceMemberSchema,
  updateWorkspaceSchema,
  upsertWorkspaceMemberSchema,
} from './workspaces.schemas.js';

export const workspacesRouter = Router();

function sendWorkspaceError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const statusByCode: Record<string, number> = {
    FORBIDDEN: 403,
    WORKSPACE_NOT_FOUND: 404,
    PARENT_WORKSPACE_NOT_FOUND: 404,
    USER_NOT_FOUND: 404,
    MEMBER_NOT_FOUND: 404,
    WORKSPACE_PARENT_CYCLE: 409,
    WORKSPACE_ARCHIVE_BLOCKED: 409,
  };

  res.status(statusByCode[code] ?? 500).json({
    error: code,
    code,
    blockers: (error as any)?.blockers,
  });
}

workspacesRouter.get('/', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const workspaces = await listWorkspaces(actor);
    res.json({ workspaces });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.post('/', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const workspace = await createWorkspace(actor, {
      ...parsed.data,
      audit: buildAuditRequestContext(req),
    });
    res.status(201).json({ workspace });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.get('/:workspaceId', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const workspace = await getWorkspace(actor, String(req.params['workspaceId']));
    res.json({ workspace });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.patch('/:workspaceId', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const workspace = await updateWorkspace(actor, String(req.params['workspaceId']), {
      ...parsed.data,
      audit: buildAuditRequestContext(req),
    });
    res.json({ workspace });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.post('/:workspaceId/archive', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const workspace = await archiveWorkspace(
      actor,
      String(req.params['workspaceId']),
      req.body?.force === true || req.query['force'] === 'true',
      buildAuditRequestContext(req),
    );
    res.json({ workspace });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.post('/:workspaceId/restore', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const workspace = await restoreWorkspace(actor, String(req.params['workspaceId']), buildAuditRequestContext(req));
    res.json({ workspace });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.get('/:workspaceId/members', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const members = await listWorkspaceMembers(actor, String(req.params['workspaceId']));
    res.json({ members });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.post('/:workspaceId/members', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = upsertWorkspaceMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const member = await upsertWorkspaceMember(
      actor,
      String(req.params['workspaceId']),
      parsed.data,
      buildAuditRequestContext(req),
    );
    res.status(201).json({ member });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.patch('/:workspaceId/members/:memberId', async (req, res) => {
  const actor = (req as any).user as User;
  const parsed = updateWorkspaceMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const member = await updateWorkspaceMember(
      actor,
      String(req.params['workspaceId']),
      String(req.params['memberId']),
      parsed.data,
      buildAuditRequestContext(req),
    );
    res.json({ member });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});

workspacesRouter.delete('/:workspaceId/members/:memberId', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const member = await updateWorkspaceMember(
      actor,
      String(req.params['workspaceId']),
      String(req.params['memberId']),
      { status: 'REMOVED' },
      buildAuditRequestContext(req),
    );
    res.json({ member });
  } catch (error) {
    sendWorkspaceError(res, error);
  }
});
