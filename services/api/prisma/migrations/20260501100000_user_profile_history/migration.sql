CREATE TABLE IF NOT EXISTS "user_profile_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "sectionKey" TEXT,
  "assetId" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_profile_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_profile_history_userId_createdAt_idx"
  ON "user_profile_history"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "user_profile_history_actorUserId_idx"
  ON "user_profile_history"("actorUserId");

CREATE INDEX IF NOT EXISTS "user_profile_history_assetId_idx"
  ON "user_profile_history"("assetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_history_userId_fkey'
  ) THEN
    ALTER TABLE "user_profile_history"
      ADD CONSTRAINT "user_profile_history_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_history_actorUserId_fkey'
  ) THEN
    ALTER TABLE "user_profile_history"
      ADD CONSTRAINT "user_profile_history_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_history_assetId_fkey'
  ) THEN
    ALTER TABLE "user_profile_history"
      ADD CONSTRAINT "user_profile_history_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
