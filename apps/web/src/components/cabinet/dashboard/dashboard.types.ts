export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type RegistrationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'RESERVE' | 'WITHDRAWN';
export type TeamStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PENDING'
  | 'CHANGES_PENDING'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'ARCHIVED';
export type ParticipantRole = 'PARTICIPANT' | 'VOLUNTEER' | 'ADMIN' | 'CAPTAIN' | 'EVENT_ADMIN' | 'ORGANIZER';
export type TeamMemberRole = 'CAPTAIN' | 'MEMBER';
export type DeadlineType = 'REGISTRATION_DEADLINE' | 'EVENT_START' | 'EVENT_END' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSE' | 'TEAM_SUBMIT_DEADLINE' | 'DOCUMENT_UPLOAD_DEADLINE' | 'CHECK_IN' | 'CUSTOM';

export type QuickAction = 
  | 'OPEN_PROFILE_REQUIREMENTS'
  | 'COMPLETE_EVENT_FORM'
  | 'ACCEPT_TEAM_INVITATION'
  | 'CREATE_OR_JOIN_TEAM'
  | 'OPEN_TEAM'
  | 'EDIT_TEAM'
  | 'OPEN_CALENDAR'
  | 'OPEN_SUPPORT';

export interface TeamMemberData {
  userId: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  status: string;
  avatar?: string;
}

export interface TeamData {
  id: string;
  name: string;
  status: TeamStatus | string;
  isCaptain: boolean;
  membersCount: number;
  minMembers?: number;
  maxMembers?: number;
  members?: TeamMemberData[];
  pendingInvites?: number;
  canEdit: boolean;
  canManageMembers?: boolean;
  canSubmit?: boolean;
  requiresApprovalAfterEdit?: boolean;
  isPendingReview?: boolean;
  requiredActiveMembers?: number;
}

export interface RoleData {
  role: ParticipantRole;
  status: RegistrationStatus | string;
}

export interface DeadlineData {
  type: DeadlineType | string;
  at: string;
  label?: string;
}

export interface InvitationData {
  id: string;
  teamName: string;
  teamId: string;
  invitedBy: string;
  expiresAt: string | null;
}

export interface DashboardEventData {
  eventId: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  status: EventStatus | string;
  isTeamBased: boolean;
  myRoles: RoleData[];
  team: TeamData | null;
  missingProfileFields: string[];
  missingEventFields: string[];
  missingEventFieldsCalculated?: boolean;
  deadlines: DeadlineData[];
  quickActions: QuickAction[];
  invitations?: InvitationData[];
}

export interface DashboardResponse {
  activeEventId: string | null;
  events: DashboardEventData[];
}
