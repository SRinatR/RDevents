import type { EventStaffRole, OrganizerMemberRole } from '@prisma/client';

export type EventPermission =
  | 'event.read'
  | 'event.update'
  | 'event.updatePublicContent'
  | 'event.manageMedia'
  | 'event.publish'
  | 'event.cancel'
  | 'event.manageStaff'
  | 'event.transferOwnership'
  | 'participants.read'
  | 'participants.readLimited'
  | 'participants.readPii'
  | 'participants.manage'
  | 'teams.read'
  | 'teams.manage'
  | 'volunteers.read'
  | 'volunteers.manage'
  | 'analytics.read'
  | 'analytics.readBasic'
  | 'analytics.readPublic'
  | 'exports.basic'
  | 'exports.pii'
  | 'documents.read'
  | 'documents.download'
  | 'checkin.read'
  | 'checkin.write';

export const EVENT_ROLE_PERMISSIONS: Record<EventStaffRole, EventPermission[]> = {
  OWNER: [
    'event.read',
    'event.update',
    'event.updatePublicContent',
    'event.manageMedia',
    'event.publish',
    'event.cancel',
    'event.manageStaff',
    'event.transferOwnership',
    'participants.read',
    'participants.readLimited',
    'participants.readPii',
    'participants.manage',
    'teams.read',
    'teams.manage',
    'volunteers.read',
    'volunteers.manage',
    'analytics.read',
    'exports.basic',
    'exports.pii',
    'documents.read',
    'documents.download',
    'checkin.read',
    'checkin.write',
  ],
  ADMIN: [
    'event.read',
    'event.update',
    'event.updatePublicContent',
    'event.manageMedia',
    'event.publish',
    'event.cancel',
    'event.manageStaff',
    'participants.read',
    'participants.readLimited',
    'participants.readPii',
    'participants.manage',
    'teams.read',
    'teams.manage',
    'volunteers.read',
    'volunteers.manage',
    'analytics.read',
    'exports.basic',
    'checkin.read',
    'checkin.write',
  ],
  MANAGER: [
    'event.read',
    'event.update',
    'participants.read',
    'participants.manage',
    'teams.read',
    'teams.manage',
    'volunteers.read',
    'volunteers.manage',
    'analytics.readBasic',
    'exports.basic',
    'checkin.read',
    'checkin.write',
  ],
  PR_MANAGER: [
    'event.read',
    'event.updatePublicContent',
    'event.manageMedia',
    'analytics.readPublic',
  ],
  CHECKIN_OPERATOR: [
    'event.read',
    'participants.readLimited',
    'checkin.read',
    'checkin.write',
  ],
  VIEWER: [
    'event.read',
    'analytics.readBasic',
  ],
};

export function unionPermissionsForRoles(roles: Array<EventStaffRole | string>): EventPermission[] {
  const permissions = new Set<EventPermission>();

  for (const role of roles) {
    for (const permission of EVENT_ROLE_PERMISSIONS[role as EventStaffRole] ?? []) {
      permissions.add(permission);
    }
  }

  return [...permissions].sort();
}

export type WorkspacePermission =
  | 'workspace.read'
  | 'workspace.create'
  | 'workspace.update'
  | 'workspace.archive'
  | 'workspace.restore'
  | 'workspace.children.create'
  | 'workspace.members.read'
  | 'workspace.members.manage'
  | 'workspace.policies.read'
  | 'workspace.policies.manage'
  | 'workspace.events.create'
  | 'workspace.events.read'
  | 'workspace.events.manage'
  | 'workspace.organizationMap.read';

export const WORKSPACE_ROLE_PERMISSIONS: Record<OrganizerMemberRole, WorkspacePermission[]> = {
  OWNER: [
    'workspace.read',
    'workspace.update',
    'workspace.archive',
    'workspace.restore',
    'workspace.children.create',
    'workspace.members.read',
    'workspace.members.manage',
    'workspace.policies.read',
    'workspace.policies.manage',
    'workspace.events.create',
    'workspace.events.read',
    'workspace.events.manage',
    'workspace.organizationMap.read',
  ],
  ADMIN: [
    'workspace.read',
    'workspace.members.read',
    'workspace.policies.read',
    'workspace.policies.manage',
    'workspace.events.create',
    'workspace.events.read',
    'workspace.events.manage',
    'workspace.organizationMap.read',
  ],
  MANAGER: [
    'workspace.read',
    'workspace.events.create',
    'workspace.events.read',
    'workspace.events.manage',
  ],
  PR_MANAGER: [
    'workspace.read',
    'workspace.events.read',
    'workspace.organizationMap.read',
  ],
  CHECKIN_MANAGER: [
    'workspace.read',
    'workspace.events.read',
  ],
  VIEWER: [
    'workspace.read',
    'workspace.events.read',
    'workspace.organizationMap.read',
  ],
};
