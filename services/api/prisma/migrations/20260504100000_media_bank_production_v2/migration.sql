CREATE TYPE "EventMediaImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');
CREATE TYPE "EventMediaImportItemStatus" AS ENUM ('IMPORTED', 'SKIPPED_DUPLICATE', 'SKIPPED_UNSUPPORTED_TYPE', 'SKIPPED_TOO_LARGE', 'FAILED');
CREATE TYPE "EventMediaCaptionSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TABLE "media_assets" ADD COLUMN "checksumSha256" TEXT;
ALTER TABLE "event_media" ADD COLUMN "displayNumber" INTEGER;
ALTER TABLE "event_media_settings" ADD COLUMN "nextMediaDisplayNumber" INTEGER NOT NULL DEFAULT 1;

WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "eventId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "event_media"
)
UPDATE "event_media" AS media
SET "displayNumber" = numbered.rn
FROM numbered
WHERE media."id" = numbered."id";

UPDATE "event_media_settings" AS settings
SET "nextMediaDisplayNumber" = COALESCE(numbers.next_number, 1)
FROM (
  SELECT "eventId", MAX("displayNumber") + 1 AS next_number
  FROM "event_media"
  GROUP BY "eventId"
) AS numbers
WHERE settings."eventId" = numbers."eventId";

CREATE UNIQUE INDEX "event_media_eventId_displayNumber_key" ON "event_media"("eventId", "displayNumber");
CREATE INDEX "media_assets_checksumSha256_idx" ON "media_assets"("checksumSha256");

CREATE TABLE "event_media_import_jobs" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "archiveAssetId" TEXT,
  "status" "EventMediaImportStatus" NOT NULL DEFAULT 'QUEUED',
  "originalFilename" TEXT NOT NULL,
  "totalEntries" INTEGER NOT NULL DEFAULT 0,
  "mediaEntries" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "optionsJson" JSONB,
  "reportJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_media_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_media_import_items" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "mediaId" TEXT,
  "archivePath" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "checksumSha256" TEXT,
  "status" "EventMediaImportItemStatus" NOT NULL,
  "reasonCode" TEXT,
  "reasonMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_media_import_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_media_caption_suggestions" (
  "id" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "status" "EventMediaCaptionSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "suggestedTitle" TEXT,
  "suggestedCaption" TEXT,
  "suggestedCredit" TEXT,
  "suggestedAltText" TEXT,
  "moderatorUserId" TEXT,
  "moderationReason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_media_caption_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_media_import_jobs_eventId_createdAt_idx" ON "event_media_import_jobs"("eventId", "createdAt");
CREATE INDEX "event_media_import_jobs_createdByUserId_idx" ON "event_media_import_jobs"("createdByUserId");
CREATE INDEX "event_media_import_jobs_status_idx" ON "event_media_import_jobs"("status");

CREATE INDEX "event_media_import_items_jobId_idx" ON "event_media_import_items"("jobId");
CREATE INDEX "event_media_import_items_eventId_idx" ON "event_media_import_items"("eventId");
CREATE INDEX "event_media_import_items_mediaId_idx" ON "event_media_import_items"("mediaId");
CREATE INDEX "event_media_import_items_checksumSha256_idx" ON "event_media_import_items"("checksumSha256");

CREATE INDEX "event_media_caption_suggestions_mediaId_idx" ON "event_media_caption_suggestions"("mediaId");
CREATE INDEX "event_media_caption_suggestions_eventId_status_idx" ON "event_media_caption_suggestions"("eventId", "status");
CREATE INDEX "event_media_caption_suggestions_authorUserId_idx" ON "event_media_caption_suggestions"("authorUserId");
CREATE UNIQUE INDEX "event_media_caption_suggestions_one_pending_per_user_media_idx"
  ON "event_media_caption_suggestions"("mediaId", "authorUserId")
  WHERE "status" = 'PENDING';

ALTER TABLE "event_media_import_jobs"
  ADD CONSTRAINT "event_media_import_jobs_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_import_jobs"
  ADD CONSTRAINT "event_media_import_jobs_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_import_jobs"
  ADD CONSTRAINT "event_media_import_jobs_archiveAssetId_fkey"
  FOREIGN KEY ("archiveAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_media_import_items"
  ADD CONSTRAINT "event_media_import_items_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "event_media_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_import_items"
  ADD CONSTRAINT "event_media_import_items_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_import_items"
  ADD CONSTRAINT "event_media_import_items_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "event_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_media_caption_suggestions"
  ADD CONSTRAINT "event_media_caption_suggestions_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "event_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_caption_suggestions"
  ADD CONSTRAINT "event_media_caption_suggestions_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_caption_suggestions"
  ADD CONSTRAINT "event_media_caption_suggestions_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_media_caption_suggestions"
  ADD CONSTRAINT "event_media_caption_suggestions_moderatorUserId_fkey"
  FOREIGN KEY ("moderatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
