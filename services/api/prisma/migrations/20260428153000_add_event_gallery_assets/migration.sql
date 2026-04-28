-- Event photobank: official and participant media with moderation states.

DO $$ BEGIN
  CREATE TYPE "EventGalleryAssetSource" AS ENUM ('OFFICIAL', 'PARTICIPANT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventGalleryAssetType" AS ENUM ('PHOTO', 'VIDEO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventGalleryAssetStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "event_gallery_assets" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "uploaderUserId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "source" "EventGalleryAssetSource" NOT NULL,
  "type" "EventGalleryAssetType" NOT NULL,
  "status" "EventGalleryAssetStatus" NOT NULL DEFAULT 'PENDING',
  "caption" TEXT,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageDriver" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_gallery_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_gallery_assets_eventId_status_createdAt_idx"
  ON "event_gallery_assets"("eventId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "event_gallery_assets_eventId_source_status_idx"
  ON "event_gallery_assets"("eventId", "source", "status");

CREATE INDEX IF NOT EXISTS "event_gallery_assets_eventId_type_status_idx"
  ON "event_gallery_assets"("eventId", "type", "status");

CREATE INDEX IF NOT EXISTS "event_gallery_assets_uploaderUserId_eventId_idx"
  ON "event_gallery_assets"("uploaderUserId", "eventId");

CREATE INDEX IF NOT EXISTS "event_gallery_assets_reviewerUserId_idx"
  ON "event_gallery_assets"("reviewerUserId");

DO $$ BEGIN
  ALTER TABLE "event_gallery_assets" ADD CONSTRAINT "event_gallery_assets_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_gallery_assets" ADD CONSTRAINT "event_gallery_assets_uploaderUserId_fkey"
    FOREIGN KEY ("uploaderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_gallery_assets" ADD CONSTRAINT "event_gallery_assets_reviewerUserId_fkey"
    FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
