DO $$
BEGIN
  CREATE TYPE "EventMediaHistoryAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'UPDATED', 'DELETED', 'RESTORED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "event_media_history" (
  "id" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" "EventMediaHistoryAction" NOT NULL,
  "fromStatus" "EventMediaStatus",
  "toStatus" "EventMediaStatus",
  "reason" TEXT,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_media_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_media_settings" (
  "eventId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "participantUploadEnabled" BOOLEAN NOT NULL DEFAULT true,
  "moderationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "showUploaderName" BOOLEAN NOT NULL DEFAULT false,
  "showCredit" BOOLEAN NOT NULL DEFAULT true,
  "allowParticipantTitle" BOOLEAN NOT NULL DEFAULT true,
  "allowParticipantCaption" BOOLEAN NOT NULL DEFAULT true,
  "maxFileSizeMb" INTEGER NOT NULL DEFAULT 25,
  "allowedTypes" TEXT[] NOT NULL DEFAULT ARRAY['image', 'video']::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_media_settings_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "event_media_history_mediaId_createdAt_idx" ON "event_media_history"("mediaId", "createdAt");
CREATE INDEX "event_media_history_actorUserId_idx" ON "event_media_history"("actorUserId");

ALTER TABLE "event_media_history"
  ADD CONSTRAINT "event_media_history_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "event_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_history"
  ADD CONSTRAINT "event_media_history_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_media_settings"
  ADD CONSTRAINT "event_media_settings_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "event_media_settings" ("eventId")
SELECT DISTINCT "eventId"
FROM "event_media"
ON CONFLICT ("eventId") DO NOTHING;

INSERT INTO "event_media_history" ("id", "mediaId", "actorUserId", "action", "fromStatus", "toStatus", "reason", "createdAt")
SELECT CONCAT('emh_submitted_', "id"), "id", "uploaderUserId", 'SUBMITTED'::"EventMediaHistoryAction", NULL, 'PENDING'::"EventMediaStatus", NULL, "createdAt"
FROM "event_media"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "event_media_history" ("id", "mediaId", "actorUserId", "action", "fromStatus", "toStatus", "reason", "createdAt")
SELECT CONCAT('emh_approved_', "id"), "id", "approvedByUserId", 'APPROVED'::"EventMediaHistoryAction", 'PENDING'::"EventMediaStatus", 'APPROVED'::"EventMediaStatus", "moderationNotes", COALESCE("approvedAt", "updatedAt")
FROM "event_media"
WHERE "status" = 'APPROVED'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "event_media_history" ("id", "mediaId", "actorUserId", "action", "fromStatus", "toStatus", "reason", "createdAt")
SELECT CONCAT('emh_rejected_', "id"), "id", "rejectedByUserId", 'REJECTED'::"EventMediaHistoryAction", 'PENDING'::"EventMediaStatus", 'REJECTED'::"EventMediaStatus", "moderationNotes", COALESCE("rejectedAt", "updatedAt")
FROM "event_media"
WHERE "status" = 'REJECTED'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "event_media_history" ("id", "mediaId", "actorUserId", "action", "fromStatus", "toStatus", "reason", "createdAt")
SELECT CONCAT('emh_deleted_', "id"), "id", NULL, 'DELETED'::"EventMediaHistoryAction", NULL, 'DELETED'::"EventMediaStatus", "moderationNotes", COALESCE("deletedAt", "updatedAt")
FROM "event_media"
WHERE "status" = 'DELETED'
ON CONFLICT ("id") DO NOTHING;
