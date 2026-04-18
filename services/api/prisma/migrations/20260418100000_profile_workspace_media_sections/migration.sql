-- Profile workspace media, consent, and section state support.

DO $$
BEGIN
  CREATE TYPE "ProfileSectionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MediaAssetPurpose" AS ENUM ('AVATAR', 'DOCUMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MediaAssetStatus" AS ENUM ('ACTIVE', 'DELETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "factualAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "nativeLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "communicationLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "consentPersonalData" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consentPersonalDataAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consentClientRules" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consentClientRulesAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "avatarAssetId" TEXT;

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "purpose" "MediaAssetPurpose" NOT NULL,
  "status" "MediaAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageDriver" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_profile_section_states" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "status" "ProfileSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_profile_section_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_assets_ownerUserId_purpose_status_idx"
  ON "media_assets"("ownerUserId", "purpose", "status");

CREATE INDEX IF NOT EXISTS "user_profile_section_states_userId_idx"
  ON "user_profile_section_states"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "user_profile_section_states_userId_sectionKey_key"
  ON "user_profile_section_states"("userId", "sectionKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_avatarAssetId_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_avatarAssetId_fkey"
      FOREIGN KEY ("avatarAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_section_states_userId_fkey'
  ) THEN
    ALTER TABLE "user_profile_section_states" ADD CONSTRAINT "user_profile_section_states_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
