import { describe, expect, it } from 'vitest';
import { unionPermissionsForRoles } from './access-control.permissions.js';

describe('unionPermissionsForRoles', () => {
  it('gives owners full sensitive permissions', () => {
    const permissions = unionPermissionsForRoles(['OWNER']);

    expect(permissions).toContain('event.transferOwnership');
    expect(permissions).toContain('participants.readPii');
    expect(permissions).toContain('exports.pii');
    expect(permissions).toContain('documents.download');
  });

  it('keeps PR access away from PII and document exports', () => {
    const permissions = unionPermissionsForRoles(['PR_MANAGER']);

    expect(permissions).toEqual(expect.arrayContaining([
      'event.read',
      'event.updatePublicContent',
      'event.manageMedia',
      'analytics.readPublic',
    ]));
    expect(permissions).not.toContain('participants.readPii');
    expect(permissions).not.toContain('exports.pii');
    expect(permissions).not.toContain('documents.read');
  });

  it('keeps checkin operators minimal', () => {
    const permissions = unionPermissionsForRoles(['CHECKIN_OPERATOR']);

    expect(permissions).toEqual(expect.arrayContaining([
      'event.read',
      'participants.readLimited',
      'checkin.read',
      'checkin.write',
    ]));
    expect(permissions).not.toContain('documents.read');
    expect(permissions).not.toContain('participants.readPii');
  });

  it('unions multiple grants without duplicates', () => {
    const permissions = unionPermissionsForRoles(['PR_MANAGER', 'CHECKIN_OPERATOR', 'PR_MANAGER']);

    expect(permissions).toContain('event.manageMedia');
    expect(permissions).toContain('checkin.write');
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});
