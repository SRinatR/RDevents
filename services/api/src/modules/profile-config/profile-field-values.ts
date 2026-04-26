import {
  PROFILE_FIELD_REGISTRY,
  getFieldByKey,
  type ProfileFieldDefinition,
} from '@event-platform/shared';

export type MissingProfileField = {
  key: string;
  label: string;
  scope: 'PROFILE';
  action: 'PROFILE';
};

const IGNORED_OBJECT_KEYS = new Set(['id', 'userId', 'assetId', 'createdAt', 'updatedAt']);

export function getProfileFieldLabel(fieldKey: string, locale: 'ru' | 'en' = 'en'): string {
  const field = getFieldByKey(fieldKey);
  if (!field) return fieldKey;
  return locale === 'ru' ? field.labelRu : field.labelEn;
}

export function getActiveProfileRequirementFields(requiredFields: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const key of requiredFields) {
    const field = getFieldByKey(key);
    if (!field?.allowEventRequirement || seen.has(field.key)) continue;
    seen.add(field.key);
    result.push(field.key);
  }

  return result;
}

export function hasProfileFieldValue(profileSnapshot: Record<string, unknown>, fieldKey: string): boolean {
  const field = getFieldByKey(fieldKey);
  if (!field?.allowEventRequirement) return true;
  return hasMeaningfulValue(getProfileFieldValue(profileSnapshot, field));
}

export function buildMissingProfileFieldsFromSnapshot(
  profileSnapshot: Record<string, unknown>,
  requiredFields: string[],
  locale: 'ru' | 'en' = 'en'
): MissingProfileField[] {
  return getActiveProfileRequirementFields(requiredFields)
    .filter((fieldKey) => !hasProfileFieldValue(profileSnapshot, fieldKey))
    .map((fieldKey) => ({
      key: fieldKey,
      label: getProfileFieldLabel(fieldKey, locale),
      scope: 'PROFILE' as const,
      action: 'PROFILE' as const,
    }));
}

export function getProfileRequirementRegistry(): ProfileFieldDefinition[] {
  return PROFILE_FIELD_REGISTRY.filter((field) => field.allowEventRequirement);
}

function getProfileFieldValue(profileSnapshot: Record<string, unknown>, field: ProfileFieldDefinition): unknown {
  if (Object.prototype.hasOwnProperty.call(profileSnapshot, field.key)) {
    return profileSnapshot[field.key];
  }

  switch (field.storageScope) {
    case 'user':
    case 'extended_profile':
      return profileSnapshot[field.key];
    case 'identity_document':
      return getNestedValue(profileSnapshot.identityDocument, field.key);
    case 'international_passport':
      return getNestedValue(profileSnapshot.internationalPassport, field.key);
    case 'social_links':
      return getNestedValue(profileSnapshot.socialLinks, field.key);
    case 'emergency_contact':
      return field.key === 'emergencyContact'
        ? profileSnapshot.emergencyContact
        : getNestedValue(profileSnapshot.emergencyContact, field.key);
    case 'additional_language':
      return profileSnapshot.additionalLanguages;
    case 'activity_direction':
      return profileSnapshot.activityDirections;
    case 'additional_document':
      return profileSnapshot.additionalDocuments;
  }
}

function getNestedValue(container: unknown, key: string): unknown {
  if (!container || typeof container !== 'object') return undefined;
  return (container as Record<string, unknown>)[key];
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.length > 0 && value.some(hasMeaningfulValue);

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !IGNORED_OBJECT_KEYS.has(key))
      .some(([, nestedValue]) => hasMeaningfulValue(nestedValue));
  }

  return true;
}
