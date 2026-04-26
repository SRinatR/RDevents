-- Migration: Email Operations Center P0
-- Keeps existing email tables and extends them with recipient snapshots, consent, suppression, and queue state.

DO $$ BEGIN
  CREATE TYPE "EmailBroadcastType" AS ENUM ('MARKETING', 'EVENT_ANNOUNCEMENT', 'EVENT_REMINDER', 'SYSTEM_NOTIFICATION', 'ADMIN_TEST', 'TRANSACTIONAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailSendMode" AS ENUM ('DRAFT', 'SEND_NOW', 'SCHEDULED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailRecipientStatus" AS ENUM (
    'MATCHED',
    'QUEUED',
    'SENDING',
    'SENT',
    'DELIVERED',
    'OPENED',
    'CLICKED',
    'FAILED',
    'BOUNCED',
    'COMPLAINED',
    'SKIPPED_NO_CONSENT',
    'SKIPPED_NO_EMAIL',
    'SKIPPED_EMAIL_NOT_VERIFIED',
    'SKIPPED_UNSUBSCRIBED',
    'SKIPPED_BLOCKED',
    'SKIPPED_DUPLICATE_EMAIL',
    'SKIPPED_SUPPRESSED',
    'SKIPPED_INVALID_EMAIL',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailConsentChannel" AS ENUM ('EMAIL', 'TELEGRAM', 'SMS', 'PUSH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailConsentTopic" AS ENUM ('MARKETING', 'EVENT_ANNOUNCEMENTS', 'EVENT_REMINDERS', 'PLATFORM_NEWS', 'PARTNER_NEWS', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailAudienceSource" AS ENUM ('STATIC_FILTER', 'SAVED_SEGMENT', 'EVENT_PARTICIPANTS', 'EVENT_TEAMS', 'UPLOADED_CSV', 'MANUAL_SELECTION', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailBroadcastEventType" AS ENUM (
    'CREATED',
    'UPDATED',
    'AUDIENCE_ESTIMATED',
    'RECIPIENT_SNAPSHOT_CREATED',
    'SCHEDULED',
    'QUEUED',
    'SENDING_STARTED',
    'RECIPIENT_QUEUED',
    'RECIPIENT_SENT',
    'RECIPIENT_FAILED',
    'RECIPIENT_SKIPPED',
    'DELIVERED',
    'OPENED',
    'CLICKED',
    'BOUNCED',
    'COMPLAINED',
    'UNSUBSCRIBED',
    'CANCELLED',
    'FINISHED',
    'TEST_SENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "EmailMessageSource" ADD VALUE IF NOT EXISTS 'ADMIN_TEST';
ALTER TYPE "EmailBroadcastStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "EmailBroadcastStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE IF NOT EXISTS "email_audiences" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "source" "EmailAudienceSource" NOT NULL,
  "filterJson" JSONB NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_audiences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_audiences_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_communication_consents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "EmailConsentChannel" NOT NULL,
  "topic" "EmailConsentTopic" NOT NULL,
  "status" "EmailConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "optedInAt" TIMESTAMP(3),
  "optedOutAt" TIMESTAMP(3),
  "lastChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_communication_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_communication_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "provider" TEXT,
  "providerEventId" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "type" "EmailBroadcastType" NOT NULL DEFAULT 'MARKETING';
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "audienceSource" "EmailAudienceSource" NOT NULL DEFAULT 'STATIC_FILTER';
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "audienceFilterJson" JSONB;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "savedAudienceId" TEXT;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "sendMode" "EmailSendMode" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Asia/Tashkent';
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "totalMatched" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "totalEligible" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "totalSkipped" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "queuedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "deliveredCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "openedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "clickedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "bouncedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "complainedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "unsubscribedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_broadcasts" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

DO $$ BEGIN
  ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_savedAudienceId_fkey" FOREIGN KEY ("savedAudienceId") REFERENCES "email_audiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "email_broadcast_recipients" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "name" TEXT,
  "status" "EmailRecipientStatus" NOT NULL DEFAULT 'MATCHED',
  "skipReason" TEXT,
  "failureReason" TEXT,
  "consentSnapshotJson" JSONB,
  "variablesSnapshotJson" JSONB,
  "audienceReasonJson" JSONB,
  "emailMessageId" TEXT,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "queuedAt" TIMESTAMP(3),
  "sendingAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "complainedAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_broadcast_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "email_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "email_broadcast_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_broadcast_recipients_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_broadcast_events" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "recipientId" TEXT,
  "type" "EmailBroadcastEventType" NOT NULL,
  "actorUserId" TEXT,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_broadcast_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_broadcast_events_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "email_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "email_broadcast_events_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "email_broadcast_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_broadcast_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_communication_consents_userId_channel_topic_key" ON "user_communication_consents"("userId", "channel", "topic");
CREATE INDEX IF NOT EXISTS "user_communication_consents_channel_topic_status_idx" ON "user_communication_consents"("channel", "topic", "status");
CREATE INDEX IF NOT EXISTS "user_communication_consents_userId_idx" ON "user_communication_consents"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_normalizedEmail_key" ON "email_suppressions"("normalizedEmail");
CREATE INDEX IF NOT EXISTS "email_suppressions_reason_idx" ON "email_suppressions"("reason");

CREATE UNIQUE INDEX IF NOT EXISTS "email_broadcast_recipients_broadcastId_normalizedEmail_key" ON "email_broadcast_recipients"("broadcastId", "normalizedEmail");
CREATE INDEX IF NOT EXISTS "email_broadcast_recipients_broadcastId_idx" ON "email_broadcast_recipients"("broadcastId");
CREATE INDEX IF NOT EXISTS "email_broadcast_recipients_status_idx" ON "email_broadcast_recipients"("status");
CREATE INDEX IF NOT EXISTS "email_broadcast_recipients_userId_idx" ON "email_broadcast_recipients"("userId");
CREATE INDEX IF NOT EXISTS "email_broadcast_recipients_normalizedEmail_idx" ON "email_broadcast_recipients"("normalizedEmail");
CREATE INDEX IF NOT EXISTS "email_broadcast_recipients_providerMessageId_idx" ON "email_broadcast_recipients"("providerMessageId");

CREATE INDEX IF NOT EXISTS "email_broadcast_events_broadcastId_idx" ON "email_broadcast_events"("broadcastId");
CREATE INDEX IF NOT EXISTS "email_broadcast_events_recipientId_idx" ON "email_broadcast_events"("recipientId");
CREATE INDEX IF NOT EXISTS "email_broadcast_events_type_idx" ON "email_broadcast_events"("type");
CREATE INDEX IF NOT EXISTS "email_broadcast_events_createdAt_idx" ON "email_broadcast_events"("createdAt");

CREATE INDEX IF NOT EXISTS "email_broadcasts_type_idx" ON "email_broadcasts"("type");
CREATE INDEX IF NOT EXISTS "email_broadcasts_audienceSource_idx" ON "email_broadcasts"("audienceSource");
CREATE INDEX IF NOT EXISTS "email_broadcasts_scheduledAt_idx" ON "email_broadcasts"("scheduledAt");
CREATE INDEX IF NOT EXISTS "email_broadcasts_savedAudienceId_idx" ON "email_broadcasts"("savedAudienceId");

CREATE INDEX IF NOT EXISTS "email_audiences_source_idx" ON "email_audiences"("source");
CREATE INDEX IF NOT EXISTS "email_audiences_isActive_idx" ON "email_audiences"("isActive");

INSERT INTO "user_communication_consents" (
  "id",
  "userId",
  "channel",
  "topic",
  "status",
  "source",
  "optedInAt",
  "lastChangedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('legacy-email-marketing-', md5("userId")),
  "userId",
  'EMAIL'::"EmailConsentChannel",
  'MARKETING'::"EmailConsentTopic",
  'OPTED_IN'::"EmailConsentStatus",
  'legacy:user_extended_profiles.consentMailing',
  COALESCE("consentMailingAt", CURRENT_TIMESTAMP),
  COALESCE("consentMailingAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "user_extended_profiles"
WHERE "consentMailing" IS TRUE
ON CONFLICT ("userId", "channel", "topic") DO NOTHING;
