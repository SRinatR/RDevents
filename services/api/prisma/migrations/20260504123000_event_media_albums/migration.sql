-- Albums for event media bank.
-- One media item can belong to one album inside the same event.
-- Additive and nullable so existing media keeps working.

CREATE TABLE IF NOT EXISTS "event_media_albums" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "coverMediaId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "event_media_albums_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "event_media_albums_coverMediaId_fkey"
    FOREIGN KEY ("coverMediaId") REFERENCES "event_media"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "event_media_albums_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "event_media"
  ADD COLUMN IF NOT EXISTS "albumId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_media_albumId_fkey'
  ) THEN
    ALTER TABLE "event_media"
      ADD CONSTRAINT "event_media_albumId_fkey"
      FOREIGN KEY ("albumId") REFERENCES "event_media_albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "event_media_albums_eventId_deletedAt_sortOrder_idx"
  ON "event_media_albums" ("eventId", "deletedAt", "sortOrder", "createdAt");

CREATE INDEX IF NOT EXISTS "event_media_albumId_idx"
  ON "event_media" ("albumId");

CREATE INDEX IF NOT EXISTS "event_media_eventId_albumId_idx"
  ON "event_media" ("eventId", "albumId");
