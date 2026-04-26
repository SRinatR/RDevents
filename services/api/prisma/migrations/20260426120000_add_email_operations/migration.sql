-- Migration: Add Email Operations
-- Created: 2026-04-26

DO $$ BEGIN
  CREATE TYPE "EmailMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailMessageSource" AS ENUM ('VERIFICATION', 'INVITATION', 'NOTIFICATION', 'BROADCAST', 'PASSWORD_RESET', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailTemplateStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailBroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIAL', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailAudienceKind" AS ENUM ('MAILING_CONSENT', 'VERIFIED_USERS', 'ACTIVE_USERS', 'PLATFORM_ADMINS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailWebhookProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "htmlBody" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "status" "EmailTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_broadcasts" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "htmlBody" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "audienceKind" "EmailAudienceKind" NOT NULL DEFAULT 'MAILING_CONSENT',
  "status" "EmailBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "errorText" TEXT,
  "templateId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "email_broadcasts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_broadcasts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_broadcasts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_messages" (
  "id" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "toUserId" TEXT,
  "subject" TEXT NOT NULL,
  "source" "EmailMessageSource" NOT NULL,
  "status" "EmailMessageStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "errorText" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "complainedAt" TIMESTAMP(3),
  "broadcastId" TEXT,
  "templateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_messages_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_messages_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "email_broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "email_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_webhook_events" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerEventId" TEXT,
  "providerMessageId" TEXT,
  "payloadJson" JSONB NOT NULL,
  "processingStatus" "EmailWebhookProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "relatedMessageId" TEXT,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "email_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_webhook_events_relatedMessageId_fkey" FOREIGN KEY ("relatedMessageId") REFERENCES "email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_key_key" ON "email_templates"("key");
CREATE INDEX IF NOT EXISTS "email_templates_status_idx" ON "email_templates"("status");
CREATE INDEX IF NOT EXISTS "email_templates_createdById_idx" ON "email_templates"("createdById");

CREATE INDEX IF NOT EXISTS "email_broadcasts_status_idx" ON "email_broadcasts"("status");
CREATE INDEX IF NOT EXISTS "email_broadcasts_audienceKind_idx" ON "email_broadcasts"("audienceKind");
CREATE INDEX IF NOT EXISTS "email_broadcasts_templateId_idx" ON "email_broadcasts"("templateId");
CREATE INDEX IF NOT EXISTS "email_broadcasts_createdById_idx" ON "email_broadcasts"("createdById");
CREATE INDEX IF NOT EXISTS "email_broadcasts_createdAt_idx" ON "email_broadcasts"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_providerMessageId_key" ON "email_messages"("providerMessageId");
CREATE INDEX IF NOT EXISTS "email_messages_toEmail_idx" ON "email_messages"("toEmail");
CREATE INDEX IF NOT EXISTS "email_messages_toUserId_idx" ON "email_messages"("toUserId");
CREATE INDEX IF NOT EXISTS "email_messages_source_idx" ON "email_messages"("source");
CREATE INDEX IF NOT EXISTS "email_messages_status_idx" ON "email_messages"("status");
CREATE INDEX IF NOT EXISTS "email_messages_sentAt_idx" ON "email_messages"("sentAt");
CREATE INDEX IF NOT EXISTS "email_messages_createdAt_idx" ON "email_messages"("createdAt");
CREATE INDEX IF NOT EXISTS "email_messages_broadcastId_idx" ON "email_messages"("broadcastId");

CREATE UNIQUE INDEX IF NOT EXISTS "email_webhook_events_providerEventId_key" ON "email_webhook_events"("providerEventId");
CREATE INDEX IF NOT EXISTS "email_webhook_events_eventType_idx" ON "email_webhook_events"("eventType");
CREATE INDEX IF NOT EXISTS "email_webhook_events_providerMessageId_idx" ON "email_webhook_events"("providerMessageId");
CREATE INDEX IF NOT EXISTS "email_webhook_events_processingStatus_idx" ON "email_webhook_events"("processingStatus");
CREATE INDEX IF NOT EXISTS "email_webhook_events_receivedAt_idx" ON "email_webhook_events"("receivedAt");
