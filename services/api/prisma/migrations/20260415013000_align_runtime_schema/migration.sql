-- Align the persisted schema with the Prisma schema and API code used at runtime.

DO $$
BEGIN
  CREATE TYPE "RegistrationMode" AS ENUM ('INDIVIDUAL', 'TEAM', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "EventMemberStatus" ADD VALUE IF NOT EXISTS 'RESERVE';
ALTER TYPE "EventMemberStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "lastNameCyrillic" TEXT,
  ADD COLUMN IF NOT EXISTS "firstNameCyrillic" TEXT,
  ADD COLUMN IF NOT EXISTS "middleNameCyrillic" TEXT,
  ADD COLUMN IF NOT EXISTS "lastNameLatin" TEXT,
  ADD COLUMN IF NOT EXISTS "firstNameLatin" TEXT,
  ADD COLUMN IF NOT EXISTS "middleNameLatin" TEXT,
  ADD COLUMN IF NOT EXISTS "fullNameCyrillic" TEXT,
  ADD COLUMN IF NOT EXISTS "fullNameLatin" TEXT;

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "registrationOpensAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "registrationMode" "RegistrationMode" NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS "volunteerApplicationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiredProfileFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "requiredEventFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "customRegistrationFields" JSONB;

ALTER TABLE "event_members"
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);

ALTER TABLE "event_teams"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

UPDATE "event_teams"
SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr("id", 1, 6)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "event_teams" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "event_teams_slug_key" ON "event_teams"("slug");

DO $$
BEGIN
  IF to_regclass('public.event_registration_form_submissions') IS NULL
     AND to_regclass('public.event_registration_answers') IS NOT NULL THEN
    ALTER TABLE "event_registration_answers" RENAME TO "event_registration_form_submissions";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "event_registration_form_submissions" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "answersJson" JSONB NOT NULL,
  "isComplete" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_registration_form_submissions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_registration_form_submissions'
      AND column_name = 'answers'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_registration_form_submissions'
      AND column_name = 'answersJson'
  ) THEN
    ALTER TABLE "event_registration_form_submissions" RENAME COLUMN "answers" TO "answersJson";
  END IF;
END $$;

ALTER TABLE "event_registration_form_submissions"
  ADD COLUMN IF NOT EXISTS "answersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "isComplete" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "event_registration_form_submissions_eventId_userId_key"
  ON "event_registration_form_submissions"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "event_registration_form_submissions_userId_idx"
  ON "event_registration_form_submissions"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registration_form_submissions_eventId_fkey'
  ) THEN
    ALTER TABLE "event_registration_form_submissions" ADD CONSTRAINT "event_registration_form_submissions_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registration_form_submissions_userId_fkey'
  ) THEN
    ALTER TABLE "event_registration_form_submissions" ADD CONSTRAINT "event_registration_form_submissions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
