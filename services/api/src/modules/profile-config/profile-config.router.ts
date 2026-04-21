import { Router } from 'express';
import { authenticate, requireRole, type AuthenticatedRequest } from '../../common/middleware.js';
import { UserRole } from '@prisma/client';
import {
  updateProfileFieldVisibilitySchema,
  bulkUpdateProfileFieldVisibilitySchema,
} from './profile-config.schemas.js';
import {
  getAllProfileFieldsWithVisibility,
  updateFieldVisibility,
  bulkUpdateFieldVisibility,
} from './profile-config.service.js';

export const profileConfigRouter = Router();

profileConfigRouter.get('/', async (_req, res) => {
  const fields = await getAllProfileFieldsWithVisibility();
  res.json({ data: fields });
});

profileConfigRouter.patch(
  '/:key',
  authenticate,
  requireRole(UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const { key } = req.params;
    const parsed = updateProfileFieldVisibilitySchema.safeParse({
      key,
      ...req.body,
    });

    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const result = await updateFieldVisibility(
      parsed.data.key,
      parsed.data.isVisibleInCabinet,
      req.user!.id
    );

    if (!result.success) {
      if (result.error === 'PROFILE_FIELD_NOT_FOUND') {
        res.status(404).json({ error: 'Field not found', code: 'PROFILE_FIELD_NOT_FOUND' });
        return;
      }
      if (result.error === 'PROFILE_FIELD_IN_USE' && result.usedInEvents) {
        res.status(409).json({
          error: 'Cannot hide field that is required by events',
          code: 'PROFILE_FIELD_IN_USE',
          usedInEvents: result.usedInEvents,
        });
        return;
      }
      res.status(400).json({ error: result.error });
      return;
    }

    const fields = await getAllProfileFieldsWithVisibility();
    const updatedField = fields.find((f) => f.key === key);
    res.json({ data: updatedField });
  }
);

profileConfigRouter.patch(
  '/',
  authenticate,
  requireRole(UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const parsed = bulkUpdateProfileFieldVisibilitySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const result = await bulkUpdateFieldVisibility(parsed.data.fields, req.user!.id);

    if (!result.success) {
      res.status(409).json({
        error: 'Some fields could not be updated',
        code: 'PROFILE_FIELD_BULK_UPDATE_FAILED',
        errors: result.errors,
      });
      return;
    }

    const fields = await getAllProfileFieldsWithVisibility();
    res.json({ data: fields });
  }
);
