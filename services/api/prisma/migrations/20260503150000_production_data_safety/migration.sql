ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSeedData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "protectedFromCleanup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "isSeedData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "protectedFromCleanup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "restoredByUserId" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "restoredFromBackup" TEXT;

ALTER TABLE "event_members" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "event_members" ADD COLUMN IF NOT EXISTS "statusChangedByUserId" TEXT;
ALTER TABLE "event_members" ADD COLUMN IF NOT EXISTS "statusReason" TEXT;

ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "createdByAdminId" TEXT;
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3);
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "restoredByUserId" TEXT;
ALTER TABLE "event_teams" ADD COLUMN IF NOT EXISTS "restoredFromBackup" TEXT;

ALTER TABLE "event_team_members" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
ALTER TABLE "event_team_members" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "event_team_members" SET "createdAt" = COALESCE("joinedAt", now()), "updatedAt" = now() WHERE "createdAt" IS NULL OR "updatedAt" IS NULL;
ALTER TABLE "event_team_members" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "event_team_members" ALTER COLUMN "createdAt" SET DEFAULT now();
ALTER TABLE "event_team_members" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "maintenance_job_runs" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "releaseSha" TEXT,
  "environment" TEXT,
  "command" TEXT,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "metaJson" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX IF NOT EXISTS "users_isSeedData_protectedFromCleanup_idx" ON "users"("isSeedData", "protectedFromCleanup");
CREATE INDEX IF NOT EXISTS "events_deletedAt_idx" ON "events"("deletedAt");
CREATE INDEX IF NOT EXISTS "events_isSeedData_protectedFromCleanup_idx" ON "events"("isSeedData", "protectedFromCleanup");
CREATE INDEX IF NOT EXISTS "event_members_statusChangedAt_idx" ON "event_members"("statusChangedAt");
CREATE INDEX IF NOT EXISTS "event_members_statusChangedByUserId_idx" ON "event_members"("statusChangedByUserId");
CREATE INDEX IF NOT EXISTS "event_teams_deletedAt_idx" ON "event_teams"("deletedAt");
CREATE INDEX IF NOT EXISTS "event_teams_source_idx" ON "event_teams"("source");
CREATE INDEX IF NOT EXISTS "event_team_members_updatedAt_idx" ON "event_team_members"("updatedAt");
CREATE INDEX IF NOT EXISTS "maintenance_job_runs_type_startedAt_idx" ON "maintenance_job_runs"("type", "startedAt");
CREATE INDEX IF NOT EXISTS "maintenance_job_runs_status_idx" ON "maintenance_job_runs"("status");

ALTER TABLE "users" ADD CONSTRAINT "users_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_restoredByUserId_fkey" FOREIGN KEY ("restoredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_statusChangedByUserId_fkey" FOREIGN KEY ("statusChangedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_restoredByUserId_fkey" FOREIGN KEY ("restoredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_job_runs" ADD CONSTRAINT "maintenance_job_runs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "events" SET "isSeedData"=false, "protectedFromCleanup"=true WHERE "slug"='dom-gde-zhivet-rossiya';
UPDATE "users" SET "protectedFromCleanup"=true, "isSeedData"=false WHERE "email"='rinat200355@gmail.com';
