-- Migration: add_password_reset_and_profile_fields
-- Created: 2026-04-21

-- Add SUBMITTED status to EventTeamStatus enum
ALTER TYPE "EventTeamStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';

-- Create PasswordResetToken table
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedIp" TEXT,
    "requestedUa" TEXT,
    "consumedIp" TEXT,
    "consumedUa" TEXT,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_tokenHash_key" UNIQUE("tokenHash"),
    CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- Create ProfileFieldVisibilitySetting table
CREATE TABLE IF NOT EXISTS "profile_field_visibility_settings" (
    "key" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "isVisibleInCabinet" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_field_visibility_settings_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "profile_field_visibility_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "profile_field_visibility_settings_sectionKey_idx" ON "profile_field_visibility_settings"("sectionKey");

-- Create UserPreference table
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_preferences_userId_key_key" UNIQUE("userId", "key"),
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_preferences_userId_idx" ON "user_preferences"("userId");

-- Create EventMilestoneType enum
DO $$ BEGIN
    CREATE TYPE "EventMilestoneType" AS ENUM('REGISTRATION_OPEN', 'REGISTRATION_CLOSE', 'TEAM_SUBMIT_DEADLINE', 'DOCUMENT_UPLOAD_DEADLINE', 'CHECK_IN', 'EVENT_START', 'EVENT_END', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create EventMilestone table
CREATE TABLE IF NOT EXISTS "event_milestones" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "EventMilestoneType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occursAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_milestones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_milestones_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "event_milestones_eventId_occursAt_idx" ON "event_milestones"("eventId", "occursAt");

-- Create ExportPreset table
CREATE TABLE IF NOT EXISTS "export_presets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_presets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "export_presets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "export_presets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "export_presets_eventId_idx" ON "export_presets"("eventId");

-- Add relations to existing tables
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedProfileFieldVisibilityId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdExportPresetId" TEXT;

-- Add relation to Event table
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "milestonesCount" INTEGER NOT NULL DEFAULT 0;
