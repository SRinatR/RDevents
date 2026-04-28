import { describe, expect, it } from 'vitest';
import {
  getTeamStatusAfterReject,
  isInitialApprovalRequest,
  isTeamApprovedStatus,
  isTeamEditableByCaptain,
  isTeamLockedForUserActions,
} from './team-governance.js';

describe('team governance helpers', () => {
  it('treats ACTIVE as legacy approved state', () => {
    expect(isTeamApprovedStatus('ACTIVE')).toBe(true);
    expect(isTeamApprovedStatus('APPROVED')).toBe(true);
    expect(isTeamApprovedStatus('DRAFT')).toBe(false);
  });

  it('allows captain edits only in DRAFT and REJECTED for approval events', () => {
    expect(isTeamEditableByCaptain({ status: 'DRAFT', event: { requireAdminApprovalForTeams: true } })).toBe(true);
    expect(isTeamEditableByCaptain({ status: 'REJECTED', event: { requireAdminApprovalForTeams: true } })).toBe(true);
    expect(isTeamEditableByCaptain({ status: 'SUBMITTED', event: { requireAdminApprovalForTeams: true } })).toBe(false);
    expect(isTeamEditableByCaptain({ status: 'APPROVED', event: { requireAdminApprovalForTeams: true } })).toBe(false);
  });

  it('locks submitted and approved teams for user actions', () => {
    expect(isTeamLockedForUserActions({ status: 'SUBMITTED', event: { requireAdminApprovalForTeams: true } })).toBe(true);
    expect(isTeamLockedForUserActions({ status: 'APPROVED', event: { requireAdminApprovalForTeams: true } })).toBe(true);
    expect(isTeamLockedForUserActions({ status: 'NEEDS_ATTENTION', event: { requireAdminApprovalForTeams: true } })).toBe(true);
    expect(isTeamLockedForUserActions({ status: 'DRAFT', event: { requireAdminApprovalForTeams: true } })).toBe(false);
    expect(isTeamLockedForUserActions({ status: 'ACTIVE', event: { requireAdminApprovalForTeams: false } })).toBe(false);
  });

  it('detects initial approval even for legacy requests without explicit type', () => {
    expect(isInitialApprovalRequest({ type: 'INITIAL_APPROVAL' })).toBe(true);
    expect(isInitialApprovalRequest({}, 'SUBMITTED')).toBe(true);
    expect(isInitialApprovalRequest({}, 'PENDING')).toBe(true);
    expect(isInitialApprovalRequest({ type: 'DETAILS_UPDATE' }, 'SUBMITTED')).toBe(false);
  });

  it('returns REJECTED only for rejected initial approval', () => {
    expect(getTeamStatusAfterReject({ requestType: 'INITIAL_APPROVAL', requireAdminApprovalForTeams: true })).toBe('REJECTED');
    expect(getTeamStatusAfterReject({ requestType: 'DETAILS_UPDATE', requireAdminApprovalForTeams: true })).toBe('APPROVED');
    expect(getTeamStatusAfterReject({ requestType: 'DETAILS_UPDATE', requireAdminApprovalForTeams: false })).toBe('ACTIVE');
  });
});
