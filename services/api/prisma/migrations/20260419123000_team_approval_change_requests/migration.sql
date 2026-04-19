ALTER TYPE "EventTeamStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "EventTeamStatus" ADD VALUE IF NOT EXISTS 'CHANGES_PENDING';

CREATE TYPE "EventTeamChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "event_team_change_requests" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "decidedByUserId" TEXT,
  "status" "EventTeamChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "proposedName" TEXT NOT NULL,
  "proposedDescription" TEXT,
  "proposedMemberUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),

  CONSTRAINT "event_team_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_team_change_requests_teamId_status_idx" ON "event_team_change_requests"("teamId", "status");
CREATE INDEX "event_team_change_requests_requestedByUserId_idx" ON "event_team_change_requests"("requestedByUserId");

ALTER TABLE "event_team_change_requests"
  ADD CONSTRAINT "event_team_change_requests_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_team_change_requests"
  ADD CONSTRAINT "event_team_change_requests_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_team_change_requests"
  ADD CONSTRAINT "event_team_change_requests_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "events"
SET
  "requireParticipantApproval" = TRUE,
  "requireAdminApprovalForTeams" = TRUE,
  "teamJoinMode" = 'BY_CODE',
  "minTeamSize" = 3,
  "maxTeamSize" = 8,
  "allowSoloParticipation" = FALSE
WHERE "slug" = 'dom-gde-zhivet-rossiya';

UPDATE "event_teams"
SET "maxSize" = 8
WHERE "eventId" IN (
  SELECT "id" FROM "events" WHERE "slug" = 'dom-gde-zhivet-rossiya'
);
