import { PROFILE_FIELD_REGISTRY, type ProfileFieldDefinition } from '@event-platform/shared';
import { describe, expect, it } from 'vitest';
import {
  buildMissingProfileFieldsFromSnapshot,
  getActiveProfileRequirementFields,
} from './profile-field-values.js';

describe('profile field requirement registry', () => {
  it('keeps requiredProfileFields limited to the shared registry', () => {
    const activeKeys = getActiveProfileRequirementFields([
      'phone',
      'consentPersonalData',
      'unknownField',
      'documentNumber',
      'phone',
    ]);

    expect(activeKeys).toEqual(['phone', 'documentNumber']);
  });

  it('calculates missing and filled state for every event-required profile field', () => {
    const requiredFields = PROFILE_FIELD_REGISTRY.filter((field) => field.allowEventRequirement);

    for (const field of requiredFields) {
      const emptyMissing = buildMissingProfileFieldsFromSnapshot({}, [field.key]);
      expect(emptyMissing.map((item) => item.key), `${field.key} should be missing when empty`)
        .toContain(field.key);

      const filledMissing = buildMissingProfileFieldsFromSnapshot(buildSnapshotWithValue(field), [field.key]);
      expect(filledMissing.map((item) => item.key), `${field.key} should be filled from ${field.storageScope}`)
        .not.toContain(field.key);
    }
  });
});

function buildSnapshotWithValue(field: ProfileFieldDefinition): Record<string, unknown> {
  const value = sampleValue(field);

  switch (field.storageScope) {
    case 'user':
    case 'extended_profile':
      return { [field.key]: value };
    case 'identity_document':
      return { identityDocument: { [field.key]: value } };
    case 'international_passport':
      return { internationalPassport: { [field.key]: value } };
    case 'social_links':
      return { socialLinks: { [field.key]: value } };
    case 'emergency_contact':
      return { emergencyContact: { fullName: 'Emergency Contact', phone: '+998901234567' } };
    case 'additional_language':
      return { additionalLanguages: ['English'] };
    case 'activity_direction':
      return { activityDirections: ['media'] };
    case 'additional_document':
      return { additionalDocuments: [{ title: 'Document', assetId: 'asset-1' }] };
  }
}

function sampleValue(field: ProfileFieldDefinition): unknown {
  switch (field.type) {
    case 'boolean':
      return false;
    case 'date':
      return new Date('2026-01-01T00:00:00.000Z');
    case 'url':
      return 'https://example.com/profile';
    case 'phone':
      return '+998901234567';
    default:
      return `${field.key}-value`;
  }
}
