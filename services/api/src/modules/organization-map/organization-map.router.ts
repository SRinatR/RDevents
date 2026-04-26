import { Router } from 'express';
import type { User } from '@prisma/client';
import { buildAuditRequestContext } from '../access-control/access-control.audit.js';
import {
  getGlobalOrganizationMap,
  getWorkspaceOrganizationMap,
} from './organization-map.service.js';

export const organizationMapRouter = Router();

function sendOrganizationMapError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const statusByCode: Record<string, number> = {
    FORBIDDEN: 403,
    WORKSPACE_NOT_FOUND: 404,
  };
  res.status(statusByCode[code] ?? 500).json({ error: code, code });
}

organizationMapRouter.get('/organization-map', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const map = await getGlobalOrganizationMap(actor, buildAuditRequestContext(req));
    res.json(map);
  } catch (error) {
    sendOrganizationMapError(res, error);
  }
});

organizationMapRouter.get('/workspaces/:workspaceId/organization-map', async (req, res) => {
  const actor = (req as any).user as User;

  try {
    const map = await getWorkspaceOrganizationMap(
      actor,
      String(req.params['workspaceId']),
      buildAuditRequestContext(req),
    );
    res.json(map);
  } catch (error) {
    sendOrganizationMapError(res, error);
  }
});
