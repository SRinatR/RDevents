-- Persistent metadata for event media bulk imports.
-- Nullable/additive columns only: safe for existing production rows.
-- This migration may run before the optional import tables in older branches,
-- so import-item changes are guarded by to_regclass checks.

ALTER TABLE "event_media"
  ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "capturedAtSource" TEXT,
  ADD COLUMN IF NOT EXISTS "capturedTimezone" TEXT,
  ADD COLUMN IF NOT EXISTS "groupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "groupTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "downloadEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

DO $$
BEGIN
  IF to_regclass('public.event_media_import_items') IS NOT NULL THEN
    ALTER TABLE "event_media_import_items"
      ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "capturedAtSource" TEXT,
      ADD COLUMN IF NOT EXISTS "groupKey" TEXT,
      ADD COLUMN IF NOT EXISTS "groupTitle" TEXT,
      ADD COLUMN IF NOT EXISTS "title" TEXT,
      ADD COLUMN IF NOT EXISTS "caption" TEXT,
      ADD COLUMN IF NOT EXISTS "credit" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "event_media_eventId_groupKey_idx"
  ON "event_media" ("eventId", "groupKey");

CREATE INDEX IF NOT EXISTS "event_media_eventId_capturedAt_idx"
  ON "event_media" ("eventId", "capturedAt");

DO $$
BEGIN
  IF to_regclass('public.event_media_import_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "event_media_import_items_jobId_capturedAt_idx"
      ON "event_media_import_items" ("jobId", "capturedAt");
  END IF;
END $$;
