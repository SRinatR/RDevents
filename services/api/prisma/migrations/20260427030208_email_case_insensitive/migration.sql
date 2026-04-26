-- Email case-insensitive migration
-- Problem: User@site.com and user@site.com were treated as different accounts
-- Fix: Normalize all emails to lowercase on storage, enforce uniqueness at DB level

-- Step 1: Normalize existing emails in users table
UPDATE "users"
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- Step 2: Normalize provider emails in user_accounts
UPDATE "user_accounts"
SET "providerEmail" = lower(trim("providerEmail"))
WHERE "providerEmail" IS NOT NULL
  AND "providerEmail" <> lower(trim("providerEmail"));

-- Step 3: Normalize emails in registration_verifications
UPDATE "registration_verifications"
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- Step 4: Normalize emails in event_team_invitations
UPDATE "event_team_invitation"
SET "inviteeEmail" = lower(trim("inviteeEmail"))
WHERE "inviteeEmail" <> lower(trim("inviteeEmail"));

-- Step 5: Normalize emails in email_suppressions
UPDATE "email_suppression"
SET "normalizedEmail" = lower(trim("normalizedEmail"))
WHERE "normalizedEmail" <> lower(trim("normalizedEmail"));

-- Step 6: Normalize emails in email_messages (for broadcast sends)
UPDATE "email_message"
SET "toEmail" = lower(trim("toEmail"))
WHERE "toEmail" <> lower(trim("toEmail"));

-- Step 7: Add unique index on lower(email) to prevent future mixed-case duplicates
-- This protects against race conditions where two different-case emails
-- could be inserted between the app-level check and the insert
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique"
ON "users" (lower(email));
