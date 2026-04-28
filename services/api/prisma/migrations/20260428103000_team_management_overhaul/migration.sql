ALTER TYPE "EventTeamStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "EventTeamStatus" ADD VALUE IF NOT EXISTS 'NEEDS_ATTENTION';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventTeamChangeRequestType') THEN
    CREATE TYPE "EventTeamChangeRequestType" AS ENUM (
      'INITIAL_APPROVAL',
      'MEMBER_REPLACEMENT',
      'MEMBER_ADD',
      'MEMBER_REMOVE',
      'CAPTAIN_TRANSFER',
      'DETAILS_UPDATE',
      'WITHDRAWAL_REQUEST',
      'ADMIN_CORRECTION'
    );
  END IF;
END $$;

ALTER TYPE "EventTeamChangeRequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "EventTeamChangeRequestStatus" ADD VALUE IF NOT EXISTS 'WAITING_INVITEE';
ALTER TYPE "EventTeamChangeRequestStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventTeamChangeRequestItemAction') THEN
    CREATE TYPE "EventTeamChangeRequestItemAction" AS ENUM (
      'ADD_MEMBER',
      'REMOVE_MEMBER',
      'REPLACE_MEMBER',
      'TRANSFER_CAPTAIN',
      'UPDATE_DETAILS'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventTeamChangeRequestItemStatus') THEN
    CREATE TYPE "EventTeamChangeRequestItemStatus" AS ENUM (
      'PENDING_INVITEE',
      'INVITEE_ACCEPTED',
      'INVITEE_DECLINED',
      'READY_FOR_ADMIN',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventTeamHistoryAction') THEN
    CREATE TYPE "EventTeamHistoryAction" AS ENUM (
      'TEAM_CREATED',
      'TEAM_SUBMITTED',
      'TEAM_APPROVED',
      'TEAM_REJECTED',
      'CHANGE_REQUEST_CREATED',
      'CHANGE_REQUEST_INVITEE_ACCEPTED',
      'CHANGE_REQUEST_INVITEE_DECLINED',
      'CHANGE_REQUEST_SUBMITTED',
      'CHANGE_REQUEST_APPROVED',
      'CHANGE_REQUEST_REJECTED',
      'CHANGE_REQUEST_CANCELLED',
      'MEMBER_ADDED',
      'MEMBER_REMOVED',
      'MEMBER_REPLACED',
      'MEMBER_WITHDRAWAL_REQUESTED',
      'CAPTAIN_TRANSFERRED',
      'TEAM_DETAILS_UPDATED',
      'ADMIN_TEAM_RENAMED',
      'ADMIN_TEAM_DESCRIPTION_UPDATED',
      'ADMIN_MEMBER_ADDED',
      'ADMIN_MEMBER_REMOVED',
      'ADMIN_MEMBER_REPLACED',
      'ADMIN_CAPTAIN_CHANGED',
      'ADMIN_ROSTER_REPLACED',
      'ADMIN_TEAM_APPROVED',
      'ADMIN_TEAM_REJECTED',
      'ADMIN_OVERRIDE_EVENT_PARTICIPANT_CREATED',
      'ADMIN_OPEN_REQUEST_CANCELLED'
    );
  END IF;
END $$;

ALTER TABLE "event_team_change_requests"
  ADD COLUMN IF NOT EXISTS "type" "EventTeamChangeRequestType" NOT NULL DEFAULT 'DETAILS_UPDATE',
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "proposedCaptainUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "beforeSnapshotJson" JSONB,
  ADD COLUMN IF NOT EXISTS "afterSnapshotJson" JSONB,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE "event_team_change_requests"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "proposedName" DROP NOT NULL;

UPDATE "event_team_change_requests" r
SET "type" = CASE
  WHEN t."status" IN ('SUBMITTED', 'PENDING') THEN 'INITIAL_APPROVAL'::"EventTeamChangeRequestType"
  ELSE 'DETAILS_UPDATE'::"EventTeamChangeRequestType"
END,
    "submittedAt" = COALESCE(r."submittedAt", r."createdAt")
FROM "event_teams" t
WHERE r."teamId" = t."id";

CREATE TABLE IF NOT EXISTS "event_team_change_request_items" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" "EventTeamChangeRequestItemAction" NOT NULL,
  "status" "EventTeamChangeRequestItemStatus" NOT NULL DEFAULT 'PENDING_INVITEE',
  "oldUserId" TEXT,
  "newUserId" TEXT,
  "inviteeEmail" TEXT,
  "oldRole" TEXT,
  "newRole" TEXT,
  "message" TEXT,
  "invitedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_team_change_request_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_team_change_request_items_requestId_idx" ON "event_team_change_request_items"("requestId");
CREATE INDEX IF NOT EXISTS "event_team_change_request_items_oldUserId_idx" ON "event_team_change_request_items"("oldUserId");
CREATE INDEX IF NOT EXISTS "event_team_change_request_items_newUserId_idx" ON "event_team_change_request_items"("newUserId");

ALTER TABLE "event_team_change_request_items"
  ADD CONSTRAINT "event_team_change_request_items_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "event_team_change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "event_team_history" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "requestId" TEXT,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "action" "EventTeamHistoryAction" NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "metaJson" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_team_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_team_history_eventId_teamId_idx" ON "event_team_history"("eventId", "teamId");
CREATE INDEX IF NOT EXISTS "event_team_history_requestId_idx" ON "event_team_history"("requestId");
CREATE INDEX IF NOT EXISTS "event_team_history_actorUserId_idx" ON "event_team_history"("actorUserId");
CREATE INDEX IF NOT EXISTS "event_team_history_targetUserId_idx" ON "event_team_history"("targetUserId");

ALTER TABLE "event_team_history"
  ADD CONSTRAINT "event_team_history_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_team_history"
  ADD CONSTRAINT "event_team_history_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "event_team_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "event_teams" t
SET "status" = 'APPROVED'::"EventTeamStatus"
FROM "events" e
WHERE t."eventId" = e."id"
  AND e."requireAdminApprovalForTeams" = TRUE
  AND t."status" = 'ACTIVE';
