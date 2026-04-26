-- Additive RBAC v2 workspace and event staff model.
-- This migration intentionally leaves EventMember.EVENT_ADMIN intact for rollback.

DO $$ BEGIN
  CREATE TYPE "OrganizerWorkspaceKind" AS ENUM ('ROOT_ORGANIZATION', 'DEPARTMENT', 'SUBDEPARTMENT', 'WORKING_GROUP', 'EXTERNAL_PARTNER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizerWorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizerMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_MANAGER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizerMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventStaffRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'PR_MANAGER', 'CHECKIN_OPERATOR', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventStaffGrantStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventStaffGrantSource" AS ENUM ('DIRECT', 'WORKSPACE_POLICY', 'SYSTEM', 'LEGACY_EVENT_ADMIN_MIGRATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventStaffAccessStatus" AS ENUM ('ACTIVE', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceEventAccessPolicyStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM (
    'WORKSPACE_CREATED',
    'WORKSPACE_UPDATED',
    'WORKSPACE_ARCHIVED',
    'WORKSPACE_RESTORED',
    'WORKSPACE_PARENT_CHANGED',
    'WORKSPACE_MEMBER_ADDED',
    'WORKSPACE_MEMBER_UPDATED',
    'WORKSPACE_MEMBER_REMOVED',
    'WORKSPACE_ACCESS_POLICY_CREATED',
    'WORKSPACE_ACCESS_POLICY_UPDATED',
    'WORKSPACE_ACCESS_POLICY_REVOKED',
    'EVENT_STAFF_GRANT_CREATED',
    'EVENT_STAFF_GRANT_UPDATED',
    'EVENT_STAFF_GRANT_REVOKED',
    'EVENT_STAFF_ACCESS_RECALCULATED',
    'EVENT_OWNER_TRANSFERRED',
    'ORGANIZATION_MAP_VIEWED',
    'LEGACY_EVENT_ADMIN_MIGRATED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "organizer_workspaces" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "kind" "OrganizerWorkspaceKind" NOT NULL DEFAULT 'DEPARTMENT',
  "status" "OrganizerWorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
  "parentId" TEXT,
  "createdById" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "organizer_workspaces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organizer_workspaces_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organizer_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "organizer_workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "organizer_workspace_members" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizerMemberRole" NOT NULL,
  "status" "OrganizerMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedByUserId" TEXT,
  "invitedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organizer_workspace_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organizer_workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "organizer_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organizer_workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organizer_workspace_members_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "organizerWorkspaceId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_organizerWorkspaceId_fkey'
  ) THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_organizerWorkspaceId_fkey"
      FOREIGN KEY ("organizerWorkspaceId") REFERENCES "organizer_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "workspace_event_access_policies" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "EventStaffRole" NOT NULL,
  "status" "WorkspaceEventAccessPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
  "includePastEvents" BOOLEAN NOT NULL DEFAULT false,
  "includeCurrentEvents" BOOLEAN NOT NULL DEFAULT false,
  "includeFutureEvents" BOOLEAN NOT NULL DEFAULT false,
  "includeCancelledEvents" BOOLEAN NOT NULL DEFAULT false,
  "autoApplyToNewEvents" BOOLEAN NOT NULL DEFAULT false,
  "fullWorkspaceAccess" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "revokedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "workspace_event_access_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_event_access_policies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "organizer_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_event_access_policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_event_access_policies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "workspace_event_access_policies_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "event_staff_grants" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "EventStaffRole" NOT NULL,
  "status" "EventStaffGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "EventStaffGrantSource" NOT NULL DEFAULT 'DIRECT',
  "policyId" TEXT,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "event_staff_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_staff_grants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_staff_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_staff_grants_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "event_staff_grants_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "workspace_event_access_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "event_staff_accesses" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "EventStaffAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isOwner" BOOLEAN NOT NULL DEFAULT false,
  "recalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "event_staff_accesses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_staff_accesses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_staff_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" "AuditAction" NOT NULL,
  "workspaceId" TEXT,
  "eventId" TEXT,
  "targetUserId" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "meta" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizer_workspaces_slug_key" ON "organizer_workspaces"("slug");
CREATE INDEX IF NOT EXISTS "organizer_workspaces_parentId_idx" ON "organizer_workspaces"("parentId");
CREATE INDEX IF NOT EXISTS "organizer_workspaces_kind_status_idx" ON "organizer_workspaces"("kind", "status");
CREATE INDEX IF NOT EXISTS "organizer_workspaces_status_idx" ON "organizer_workspaces"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "organizer_workspace_members_workspaceId_userId_key" ON "organizer_workspace_members"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "organizer_workspace_members_userId_status_idx" ON "organizer_workspace_members"("userId", "status");
CREATE INDEX IF NOT EXISTS "organizer_workspace_members_workspaceId_role_status_idx" ON "organizer_workspace_members"("workspaceId", "role", "status");

CREATE INDEX IF NOT EXISTS "events_organizerWorkspaceId_idx" ON "events"("organizerWorkspaceId");

CREATE INDEX IF NOT EXISTS "workspace_event_access_policies_workspaceId_status_idx" ON "workspace_event_access_policies"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "workspace_event_access_policies_userId_status_idx" ON "workspace_event_access_policies"("userId", "status");
CREATE INDEX IF NOT EXISTS "workspace_event_access_policies_workspaceId_userId_status_idx" ON "workspace_event_access_policies"("workspaceId", "userId", "status");

CREATE INDEX IF NOT EXISTS "event_staff_grants_eventId_status_idx" ON "event_staff_grants"("eventId", "status");
CREATE INDEX IF NOT EXISTS "event_staff_grants_userId_status_idx" ON "event_staff_grants"("userId", "status");
CREATE INDEX IF NOT EXISTS "event_staff_grants_eventId_userId_status_idx" ON "event_staff_grants"("eventId", "userId", "status");
CREATE INDEX IF NOT EXISTS "event_staff_grants_policyId_status_idx" ON "event_staff_grants"("policyId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "event_staff_accesses_eventId_userId_key" ON "event_staff_accesses"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "event_staff_accesses_userId_status_idx" ON "event_staff_accesses"("userId", "status");
CREATE INDEX IF NOT EXISTS "event_staff_accesses_eventId_status_idx" ON "event_staff_accesses"("eventId", "status");

CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX IF NOT EXISTS "audit_logs_workspaceId_idx" ON "audit_logs"("workspaceId");
CREATE INDEX IF NOT EXISTS "audit_logs_eventId_idx" ON "audit_logs"("eventId");
CREATE INDEX IF NOT EXISTS "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
