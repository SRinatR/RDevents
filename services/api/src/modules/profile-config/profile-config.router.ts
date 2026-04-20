import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
import { profileFieldVisibilityBulkPatchSchema, profileFieldVisibilityPatchSchema } from './profile-config.schemas.js';
import {
  ProfileFieldConfigError,
  bulkUpdateFieldVisibility,
  listAdminProfileFields,
  updateFieldVisibility,
} from './profile-config.service.js';

export const profileConfigRouter = Router();

profileConfigRouter.use(requirePlatformAdmin);

profileConfigRouter.get('/', async (_req, res) => {
  const fields = await listAdminProfileFields();
  res.json({ fields });
});

profileConfigRouter.patch('/:key', async (req, res) => {
  const parsed = profileFieldVisibilityPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    await updateFieldVisibility(String(req.params.key), parsed.data.isVisibleInCabinet, (req as any).user?.id);
    res.json({ ok: true });
  } catch (error: any) {
    if (error instanceof ProfileFieldConfigError) {
      const status = error.code === 'PROFILE_FIELD_IN_USE' ? 409 : 400;
      res.status(status).json({ error: error.message, code: error.code, details: error.details });
      return;
    }
    throw error;
  }
});

profileConfigRouter.patch('/', async (req, res) => {
  const parsed = profileFieldVisibilityBulkPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  try {
    await bulkUpdateFieldVisibility(parsed.data.items, (req as any).user?.id);
    res.json({ ok: true });
  } catch (error: any) {
    if (error instanceof ProfileFieldConfigError) {
      const status = error.code === 'PROFILE_FIELD_IN_USE' ? 409 : 400;
      res.status(status).json({ error: error.message, code: error.code, details: error.details });
      return;
    }
    throw error;
  }
});
