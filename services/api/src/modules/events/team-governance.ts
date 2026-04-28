export const ACTIVE_EVENT_MEMBER_STATUSES = ['ACTIVE'] as const;
export const LIVE_TEAM_MEMBER_STATUSES = ['ACTIVE', 'PENDING'] as const;
export const TEAM_STATUSES_EDITABLE_BY_CAPTAIN = ['DRAFT', 'REJECTED'] as const;
export const TEAM_STATUSES_LOCKED_FOR_USERS = ['SUBMITTED', 'APPROVED', 'CHANGES_PENDING', 'NEEDS_ATTENTION', 'ARCHIVED'] as const;
export const OPEN_CHANGE_REQUEST_STATUSES = ['DRAFT', 'WAITING_INVITEE', 'PENDING'] as const;

export function isApprovalTeam(event: { requireAdminApprovalForTeams: boolean }) {
  return Boolean(event.requireAdminApprovalForTeams);
}

export function isTeamApprovedStatus(status: string) {
  return status === 'APPROVED' || status === 'ACTIVE';
}

export function isTeamEditableByCaptain(team: {
  status: string;
  event: { requireAdminApprovalForTeams: boolean };
}) {
  if (!isApprovalTeam(team.event)) return team.status !== 'ARCHIVED';
  return TEAM_STATUSES_EDITABLE_BY_CAPTAIN.includes(team.status as any);
}

export function isTeamLockedForUserActions(team: {
  status: string;
  event: { requireAdminApprovalForTeams: boolean };
}) {
  if (team.status === 'ARCHIVED') return true;
  if (!isApprovalTeam(team.event)) return false;
  return TEAM_STATUSES_LOCKED_FOR_USERS.includes(team.status as any);
}

export function isOpenChangeRequestStatus(status: string) {
  return OPEN_CHANGE_REQUEST_STATUSES.includes(status as any);
}

export function isInitialApprovalRequest(request: { type?: string | null }, teamStatus?: string | null) {
  if (request.type) return request.type === 'INITIAL_APPROVAL';
  return teamStatus === 'SUBMITTED' || teamStatus === 'PENDING';
}

export function getTeamStatusAfterReject(input: {
  requestType?: string | null;
  requireAdminApprovalForTeams: boolean;
}) {
  if (input.requestType === 'INITIAL_APPROVAL') return 'REJECTED';
  return input.requireAdminApprovalForTeams ? 'APPROVED' : 'ACTIVE';
}
