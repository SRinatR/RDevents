ALTER TYPE "MediaAssetPurpose" ADD VALUE IF NOT EXISTS 'EVENT_MEDIA';

CREATE TYPE "EventMediaStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELETED');
CREATE TYPE "EventMediaSource" AS ENUM ('ADMIN', 'PARTICIPANT');

CREATE TABLE "event_media" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "uploaderUserId" TEXT NOT NULL,
  "source" "EventMediaSource" NOT NULL DEFAULT 'PARTICIPANT',
  "status" "EventMediaStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT,
  "caption" TEXT,
  "altText" TEXT,
  "credit" TEXT,
  "moderationNotes" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedByUserId" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "event_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_media_assetId_key" ON "event_media"("assetId");
CREATE INDEX "event_media_eventId_status_createdAt_idx" ON "event_media"("eventId", "status", "createdAt");
CREATE INDEX "event_media_uploaderUserId_status_idx" ON "event_media"("uploaderUserId", "status");

ALTER TABLE "event_media" ADD CONSTRAINT "event_media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
