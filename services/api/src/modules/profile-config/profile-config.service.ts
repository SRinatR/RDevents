import { prisma } from '../../db/prisma.js';
import { logger } from '../../common/logger.js';

const PROFILE_FIELD_REGISTRY: Array<{
  key: string;
  sectionKey: string;
  type: string;
  labelRu: string;
  labelEn: string;
  defaultVisibleInCabinet: boolean;
  allowEventRequirement: boolean;
  isCompositeRequirement: boolean;
  storageScope: string;
}> = [
  { key: 'lastNameCyrillic', sectionKey: 'registration_data', type: 'text', labelRu: 'Фамилия (кириллица)', labelEn: 'Last Name (Cyrillic)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'user' },
  { key: 'firstNameCyrillic', sectionKey: 'registration_data', type: 'text', labelRu: 'Имя (кириллица)', labelEn: 'First Name (Cyrillic)', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'user' },
  { key: 'birthDate', sectionKey: 'registration_data', type: 'date', labelRu: 'Дата рождения', labelEn: 'Date of Birth', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'user' },
  { key: 'phone', sectionKey: 'registration_data', type: 'phone', labelRu: 'Телефон', labelEn: 'Phone', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'user' },
  { key: 'telegram', sectionKey: 'registration_data', type: 'text', labelRu: 'Telegram', labelEn: 'Telegram', defaultVisibleInCabinet: true, allowEventRequirement: true, isCompositeRequirement: false, storageScope: 'user' },
];

function getFieldByKey(key: string) {
  return PROFILE_FIELD_REGISTRY.find((f) => f.key === key);
}

export interface ProfileFieldVisibilityRecord {
  key: string;
  sectionKey: string;
  label: { ru: string; en: string };
  type: string;
  isVisibleInCabinet: boolean;
  allowEventRequirement: boolean;
  isCompositeRequirement: boolean;
  usedInEventsCount: number;
  usedInEvents?: Array<{ id: string; title: string }>;
}

export async function getAllProfileFieldsWithVisibility(): Promise<ProfileFieldVisibilityRecord[]> {
  const visibilitySettings = await prisma.profileFieldVisibilitySetting.findMany({
    select: {
      key: true,
      sectionKey: true,
      isVisibleInCabinet: true,
    },
  });

  const settingsMap = new Map(
    visibilitySettings.map((s) => [s.key, { sectionKey: s.sectionKey, isVisibleInCabinet: s.isVisibleInCabinet }])
  );

  const events = await prisma.event.findMany({
    where: {
      status: { not: 'CANCELLED' },
      requiredProfileFields: { isEmpty: false },
    },
    select: {
      id: true,
      title: true,
      requiredProfileFields: true,
    },
  });

  const fieldToEventsMap = new Map<string, Array<{ id: string; title: string }>>();
  for (const event of events) {
    for (const field of event.requiredProfileFields) {
      const existing = fieldToEventsMap.get(field) ?? [];
      existing.push({ id: event.id, title: event.title });
      fieldToEventsMap.set(field, existing);
    }
  }

  return PROFILE_FIELD_REGISTRY.map((field) => {
    const setting = settingsMap.get(field.key);
    const visibility = setting?.isVisibleInCabinet ?? field.defaultVisibleInCabinet;
    const sectionKey = setting?.sectionKey ?? field.sectionKey;
    const usedInEvents = fieldToEventsMap.get(field.key);

    return {
      key: field.key,
      sectionKey,
      label: {
        ru: field.labelRu,
        en: field.labelEn,
      },
      type: field.type,
      isVisibleInCabinet: visibility,
      allowEventRequirement: field.allowEventRequirement,
      isCompositeRequirement: field.isCompositeRequirement,
      usedInEventsCount: usedInEvents?.length ?? 0,
      ...(usedInEvents && usedInEvents.length > 0 ? { usedInEvents } : {}),
    };
  });
}

export async function getVisibleProfileFieldsForUser(): Promise<Set<string>> {
  const visibilitySettings = await prisma.profileFieldVisibilitySetting.findMany({
    where: { isVisibleInCabinet: true },
    select: { key: true },
  });

  const visibleKeys = new Set(visibilitySettings.map((s) => s.key));

  return new Set(
    PROFILE_FIELD_REGISTRY
      .filter((f) => {
        if (visibleKeys.has(f.key)) return true;
        if (!visibleKeys.has(f.key) && visibleKeys.size > 0) return false;
        return f.defaultVisibleInCabinet;
      })
      .map((f) => f.key)
  );
}

export async function updateFieldVisibility(
  fieldKey: string,
  isVisible: boolean,
  updatedByUserId: string
): Promise<{ success: boolean; error?: string; usedInEvents?: Array<{ id: string; title: string }> }> {
  const field = getFieldByKey(fieldKey);
  if (!field) {
    return { success: false, error: 'PROFILE_FIELD_NOT_FOUND' };
  }

  if (!isVisible && field.allowEventRequirement) {
    const eventsUsingField = await prisma.event.findMany({
      where: {
        status: { not: 'CANCELLED' },
        requiredProfileFields: { has: fieldKey },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (eventsUsingField.length > 0) {
      return {
        success: false,
        error: 'PROFILE_FIELD_IN_USE',
        usedInEvents: eventsUsingField,
      };
    }
  }

  await prisma.profileFieldVisibilitySetting.upsert({
    where: { key: fieldKey },
    update: {
      isVisibleInCabinet: isVisible,
      sectionKey: field.sectionKey,
      updatedByUserId,
      updatedAt: new Date(),
    },
    create: {
      key: fieldKey,
      sectionKey: field.sectionKey,
      isVisibleInCabinet: isVisible,
      updatedByUserId,
    },
  });

  logger.info('Profile field visibility updated', {
    module: 'profile-config',
    action: 'PROFILE_FIELD_VISIBILITY_UPDATED',
    userId: updatedByUserId,
    meta: {
      fieldKey,
      isVisible,
    },
  });

  return { success: true };
}

export async function bulkUpdateFieldVisibility(
  updates: Array<{ key: string; isVisibleInCabinet: boolean }>,
  updatedByUserId: string
): Promise<{ success: boolean; errors: Array<{ key: string; error: string; usedInEvents?: Array<{ id: string; title: string }> }> }> {
  const errors: Array<{ key: string; error: string; usedInEvents?: Array<{ id: string; title: string }> }> = [];

  for (const update of updates) {
    const result = await updateFieldVisibility(update.key, update.isVisibleInCabinet, updatedByUserId);
    if (!result.success) {
      errors.push({
        key: update.key,
        error: result.error!,
        usedInEvents: result.usedInEvents,
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, errors: [] };
}

export function isFieldVisibleForUser(fieldKey: string, visibilitySettings: Map<string, boolean>): boolean {
  const field = getFieldByKey(fieldKey);
  if (!field) return false;

  if (visibilitySettings.has(fieldKey)) {
    return visibilitySettings.get(fieldKey)!;
  }

  return field.defaultVisibleInCabinet;
}
