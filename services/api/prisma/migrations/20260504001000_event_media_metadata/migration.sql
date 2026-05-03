-- Persistent metadata for event media bulk imports.
-- Nullable/additive columns only: safe for existing production rows.

ALTER TABLE "event_media"
  ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "capturedAtSource" TEXT,
  ADD COLUMN IF NOT EXISTS "capturedTimezone" TEXT,
  ADD COLUMN IF NOT EXISTS "groupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "groupTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "downloadEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

ALTER TABLE "event_media_import_items"
  ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "capturedAtSource" TEXT,
  ADD COLUMN IF NOT EXISTS "groupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "groupTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "caption" TEXT,
  ADD COLUMN IF NOT EXISTS "credit" TEXT;

CREATE INDEX IF NOT EXISTS "event_media_eventId_groupKey_idx"
  ON "event_media" ("eventId", "groupKey");

CREATE INDEX IF NOT EXISTS "event_media_eventId_capturedAt_idx"
  ON "event_media" ("eventId", "capturedAt");

CREATE INDEX IF NOT EXISTS "event_media_import_items_jobId_capturedAt_idx"
  ON "event_media_import_items" ("jobId", "capturedAt");
