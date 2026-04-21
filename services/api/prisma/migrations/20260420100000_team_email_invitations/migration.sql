ALTER TYPE "TeamJoinMode" ADD VALUE IF NOT EXISTS 'EMAIL_INVITE';

CREATE TYPE "TeamInvitationStatus" AS ENUM (
  'PENDING_ACCOUNT',
  'PENDING_RESPONSE',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
  'REMOVED'
);

CREATE TABLE "event_team_invitations" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "inviteeEmail" TEXT NOT NULL,
  "inviteeUserId" TEXT,
  "invitedByUserId" TEXT NOT NULL,
  "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING_ACCOUNT',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),

  CONSTRAINT "event_team_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_team_invitations_teamId_status_idx" ON "event_team_invitations"("teamId", "status");
CREATE INDEX "event_team_invitations_teamId_slotIndex_idx" ON "event_team_invitations"("teamId", "slotIndex");
CREATE INDEX "event_team_invitations_inviteeEmail_status_idx" ON "event_team_invitations"("inviteeEmail", "status");
CREATE INDEX "event_team_invitations_inviteeUserId_status_idx" ON "event_team_invitations"("inviteeUserId", "status");
CREATE INDEX "event_team_invitations_eventId_status_idx" ON "event_team_invitations"("eventId", "status");
CREATE UNIQUE INDEX "event_team_invitations_active_slot_unique"
  ON "event_team_invitations"("teamId", "slotIndex")
  WHERE "status" IN ('PENDING_ACCOUNT', 'PENDING_RESPONSE', 'ACCEPTED');

ALTER TABLE "event_team_invitations"
  ADD CONSTRAINT "event_team_invitations_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_team_invitations"
  ADD CONSTRAINT "event_team_invitations_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_team_invitations"
  ADD CONSTRAINT "event_team_invitations_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_team_invitations"
  ADD CONSTRAINT "event_team_invitations_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "events"
SET
  "isTeamBased" = TRUE,
  "minTeamSize" = 5,
  "maxTeamSize" = 5,
  "allowSoloParticipation" = FALSE,
  "requireParticipantApproval" = FALSE,
  "requireAdminApprovalForTeams" = TRUE,
  "teamJoinMode" = 'EMAIL_INVITE',
  "requiredProfileFields" = ARRAY[
    'lastNameCyrillic',
    'firstNameCyrillic',
    'middleNameCyrillic',
    'lastNameLatin',
    'firstNameLatin',
    'middleNameLatin',
    'birthDate',
    'phone',
    'telegram',
    'regionId',
    'districtId',
    'settlementId',
    'gender'
  ]::TEXT[]
WHERE "slug" = 'dom-gde-zhivet-rossiya';

UPDATE "event_teams"
SET "maxSize" = 5
WHERE "eventId" IN (
  SELECT "id" FROM "events" WHERE "slug" = 'dom-gde-zhivet-rossiya'
);
