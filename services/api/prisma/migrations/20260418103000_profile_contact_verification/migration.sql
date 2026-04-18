-- Persist contact verification state for profile contacts.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "telegramVerifiedAt" TIMESTAMP(3);
