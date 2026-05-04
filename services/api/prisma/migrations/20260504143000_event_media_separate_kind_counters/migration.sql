-- Separate public numbering for photos and videos inside every event.
-- Photo #001 and Video #001 should both be possible in the same event.
-- The application may pass displayNumber, but this trigger is the source of truth
-- for new inserts and keeps numbering consistent for admin, participant, and ZIP imports.

ALTER TABLE "event_media_settings"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "nextImageDisplayNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "nextVideoDisplayNumber" INTEGER NOT NULL DEFAULT 1;

-- The old production_v2 migration created a unique index on (eventId, displayNumber).
-- That is incompatible with separate counters because Photo #001 and Video #001
-- intentionally share the same numeric displayNumber inside one event.
DROP INDEX IF EXISTS "event_media_eventId_displayNumber_key";
CREATE INDEX IF NOT EXISTS "event_media_eventId_displayNumber_idx" ON "event_media"("eventId", "displayNumber");

-- Ensure every event with media has a settings row before counter backfill.
INSERT INTO "event_media_settings" ("eventId", "createdAt", "updatedAt")
SELECT DISTINCT m."eventId", NOW(), NOW()
FROM "event_media" m
ON CONFLICT ("eventId") DO NOTHING;

-- Backfill existing media numbers per event and per media kind.
WITH numbered AS (
  SELECT
    m.id,
    ROW_NUMBER() OVER (
      PARTITION BY m."eventId", CASE WHEN a."mimeType" LIKE 'video/%' THEN 'video' ELSE 'image' END
      ORDER BY COALESCE(m."approvedAt", m."createdAt"), m."createdAt", m.id
    )::integer AS rn
  FROM "event_media" m
  JOIN "media_assets" a ON a.id = m."assetId"
  WHERE m."deletedAt" IS NULL
    AND a."mimeType" LIKE ANY (ARRAY['image/%', 'video/%'])
)
UPDATE "event_media" m
SET "displayNumber" = numbered.rn
FROM numbered
WHERE numbered.id = m.id;

WITH counters AS (
  SELECT
    m."eventId",
    COALESCE(MAX(m."displayNumber") FILTER (WHERE a."mimeType" LIKE 'image/%'), 0) + 1 AS next_image,
    COALESCE(MAX(m."displayNumber") FILTER (WHERE a."mimeType" LIKE 'video/%'), 0) + 1 AS next_video
  FROM "event_media" m
  JOIN "media_assets" a ON a.id = m."assetId"
  WHERE m."deletedAt" IS NULL
  GROUP BY m."eventId"
)
UPDATE "event_media_settings" s
SET
  "nextImageDisplayNumber" = GREATEST(1, counters.next_image),
  "nextVideoDisplayNumber" = GREATEST(1, counters.next_video),
  "updatedAt" = NOW()
FROM counters
WHERE counters."eventId" = s."eventId";

CREATE OR REPLACE FUNCTION assign_event_media_display_number_by_kind()
RETURNS trigger AS $$
DECLARE
  media_kind TEXT;
  next_number INTEGER;
BEGIN
  SELECT CASE WHEN ma."mimeType" LIKE 'video/%' THEN 'video' ELSE 'image' END
  INTO media_kind
  FROM "media_assets" ma
  WHERE ma.id = NEW."assetId";

  IF media_kind = 'video' THEN
    INSERT INTO "event_media_settings" (
      "eventId", "createdAt", "updatedAt", "nextMediaDisplayNumber", "nextImageDisplayNumber", "nextVideoDisplayNumber"
    ) VALUES (
      NEW."eventId", NOW(), NOW(), 1, 1, 2
    )
    ON CONFLICT ("eventId") DO UPDATE
    SET
      "nextVideoDisplayNumber" = COALESCE("event_media_settings"."nextVideoDisplayNumber", 1) + 1,
      "updatedAt" = NOW()
    RETURNING COALESCE("nextVideoDisplayNumber", 1) - 1 INTO next_number;
  ELSE
    INSERT INTO "event_media_settings" (
      "eventId", "createdAt", "updatedAt", "nextMediaDisplayNumber", "nextImageDisplayNumber", "nextVideoDisplayNumber"
    ) VALUES (
      NEW."eventId", NOW(), NOW(), 1, 2, 1
    )
    ON CONFLICT ("eventId") DO UPDATE
    SET
      "nextImageDisplayNumber" = COALESCE("event_media_settings"."nextImageDisplayNumber", 1) + 1,
      "updatedAt" = NOW()
    RETURNING COALESCE("nextImageDisplayNumber", 1) - 1 INTO next_number;
  END IF;

  NEW."displayNumber" = GREATEST(1, COALESCE(next_number, NEW."displayNumber", 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "event_media_kind_display_number_before_insert" ON "event_media";
CREATE TRIGGER "event_media_kind_display_number_before_insert"
BEFORE INSERT ON "event_media"
FOR EACH ROW
EXECUTE FUNCTION assign_event_media_display_number_by_kind();
