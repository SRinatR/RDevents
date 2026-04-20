import { prisma } from '../../db/prisma.js';
import { logger } from '../../common/logger.js';
import {
  PROFILE_FIELD_REGISTRY,
  PROFILE_FIELD_REGISTRY_BY_KEY,
  type ProfileSectionKey,
} from '@event-platform/shared';

export class ProfileFieldConfigError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message);
  }
}

export async function getFieldVisibilityMap() {
  const settings = await prisma.profileFieldVisibilitySetting.findMany();
  const byKey = new Map(settings.map((item) => [item.key, item.isVisibleInCabinet]));
  return new Map(PROFILE_FIELD_REGISTRY.map((field) => [field.key, byKey.get(field.key) ?? field.defaultVisibleInCabinet]));
}

export async function getVisibleFieldKeysBySection() {
  const visibility = await getFieldVisibilityMap();
  return PROFILE_FIELD_REGISTRY.reduce<Record<string, string[]>>((acc, field) => {
    if (!visibility.get(field.key)) return acc;
    if (!acc[field.sectionKey]) acc[field.sectionKey] = [];
    acc[field.sectionKey].push(field.key);
    return acc;
  }, {} as Record<ProfileSectionKey, string[]>);
}

export async function listAdminProfileFields() {
  const visibility = await getFieldVisibilityMap();
  const events = await prisma.event.findMany({ select: { id: true, title: true, requiredProfileFields: true } });

  return PROFILE_FIELD_REGISTRY.map((field) => {
    const usedInEvents = events
      .filter((event) => event.requiredProfileFields.includes(field.key))
      .map((event) => ({ id: event.id, title: event.title }));

    return {
      key: field.key,
      sectionKey: field.sectionKey,
      label: { ru: field.labelRu, en: field.labelEn },
      type: field.type,
      isVisibleInCabinet: visibility.get(field.key) ?? field.defaultVisibleInCabinet,
      allowEventRequirement: field.allowEventRequirement,
      usedInEventsCount: usedInEvents.length,
      usedInEvents,
    };
  });
}

async function setFieldVisibility(key: string, isVisibleInCabinet: boolean, updatedByUserId?: string) {
  const registry = PROFILE_FIELD_REGISTRY_BY_KEY.get(key);
  if (!registry) throw new ProfileFieldConfigError('Profile field not found', 'PROFILE_FIELD_NOT_FOUND', { field: key });

  const usedInEvents = await prisma.event.findMany({
    where: { requiredProfileFields: { has: key } },
    select: { id: true, title: true },
  });

  if (!isVisibleInCabinet && usedInEvents.length > 0) {
    logger.warn('Profile field hide rejected because field is used in event requirements', {
      module: 'profile_config',
      action: 'profile_field_hide_rejected',
      userId: updatedByUserId,
      meta: { field: key, eventIds: usedInEvents.map((item) => item.id) },
    });
    throw new ProfileFieldConfigError('Profile field is used in event requirements', 'PROFILE_FIELD_IN_USE', {
      field: key,
      eventIds: usedInEvents.map((item) => item.id),
      eventTitles: usedInEvents.map((item) => item.title),
    });
  }

  const current = await prisma.profileFieldVisibilitySetting.findUnique({ where: { key } });
  const oldVisibility = current?.isVisibleInCabinet ?? registry.defaultVisibleInCabinet;
  const updated = await prisma.profileFieldVisibilitySetting.upsert({
    where: { key },
    create: { key, sectionKey: registry.sectionKey, isVisibleInCabinet, updatedByUserId },
    update: { sectionKey: registry.sectionKey, isVisibleInCabinet, updatedByUserId },
  });

  logger.info('Profile field visibility updated', {
    module: 'profile_config',
    action: 'profile_field_visibility_updated',
    userId: updatedByUserId,
    meta: { field: key, oldVisibility, newVisibility: isVisibleInCabinet },
  });

  return updated;
}

export async function updateFieldVisibility(key: string, isVisibleInCabinet: boolean, updatedByUserId?: string) {
  return setFieldVisibility(key, isVisibleInCabinet, updatedByUserId);
}

export async function bulkUpdateFieldVisibility(items: Array<{ key: string; isVisibleInCabinet: boolean }>, updatedByUserId?: string) {
  try {
    return await prisma.$transaction(async () => {
      const updates = [];
      for (const item of items) {
        updates.push(await setFieldVisibility(item.key, item.isVisibleInCabinet, updatedByUserId));
      }
      return updates;
    });
  } catch (error: any) {
    if (error instanceof ProfileFieldConfigError) throw error;
    throw new ProfileFieldConfigError('Bulk update failed', 'PROFILE_FIELD_BULK_UPDATE_FAILED');
  }
}

export async function validateEventRequiredProfileFields(requiredProfileFields: string[]) {
  const visibility = await getFieldVisibilityMap();

  for (const key of requiredProfileFields) {
    const field = PROFILE_FIELD_REGISTRY_BY_KEY.get(key);
    if (!field) {
      throw new ProfileFieldConfigError('Profile field not found', 'PROFILE_FIELD_NOT_FOUND', { field: key });
    }
    if (!field.allowEventRequirement) {
      throw new ProfileFieldConfigError('Profile field cannot be required by events', 'PROFILE_FIELD_CANNOT_BE_REQUIRED', { field: key });
    }
    if (!visibility.get(key)) {
      throw new ProfileFieldConfigError('Profile field is hidden', 'PROFILE_FIELD_HIDDEN', { field: key });
    }
  }
}

export async function assertProfileSectionPatchAllowed(sectionKey: string, payload: Record<string, unknown>) {
  const visibility = await getFieldVisibilityMap();
  const sectionFields = PROFILE_FIELD_REGISTRY.filter((field) => field.sectionKey === sectionKey);
  if (sectionFields.length === 0) {
    throw new ProfileFieldConfigError('Invalid profile section for field registry', 'PROFILE_FIELD_INVALID_SECTION', { sectionKey });
  }

  const payloadKeys = Object.keys(payload);
  const hiddenKeys = payloadKeys.filter((key) => {
    if (key === 'domesticDocument' || key === 'internationalPassport' || key === 'additionalDocuments') return false;
    if (key === 'emergencyContact') return !visibility.get('emergencyContact');
    const def = PROFILE_FIELD_REGISTRY_BY_KEY.get(key);
    if (!def) return false;
    if (def.sectionKey !== sectionKey) return false;
    return !visibility.get(key);
  });

  if (hiddenKeys.length > 0) {
    throw new ProfileFieldConfigError('Profile field is hidden', 'PROFILE_FIELD_HIDDEN', { fields: hiddenKeys });
  }
}
