-- P0: make email identity case-insensitive.
-- This migration intentionally fails if case-only duplicate users exist.
-- Do not auto-merge users in SQL.

CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(trim(email::text)) AS normalized_email, COUNT(*) AS count
      FROM users
      GROUP BY lower(trim(email::text))
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot migrate users.email to citext: duplicate users exist by lower(trim(email)). Resolve duplicates manually first.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(trim(email::text)) AS normalized_email, COUNT(*) AS count
      FROM registration_verifications
      GROUP BY lower(trim(email::text))
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot migrate registration_verifications.email to citext: duplicate verification rows exist by lower(trim(email)). Resolve duplicates manually first.';
  END IF;
END $$;

UPDATE users
SET email = lower(trim(email::text))
WHERE email::text <> lower(trim(email::text));

UPDATE user_accounts
SET "providerEmail" = lower(trim("providerEmail"::text))
WHERE "providerEmail" IS NOT NULL
  AND "providerEmail"::text <> lower(trim("providerEmail"::text));

UPDATE registration_verifications
SET email = lower(trim(email::text))
WHERE email::text <> lower(trim(email::text));

UPDATE email_messages
SET "toEmail" = lower(trim("toEmail"::text))
WHERE "toEmail"::text <> lower(trim("toEmail"::text));

UPDATE email_broadcast_recipients
SET
  email = lower(trim(email::text)),
  "normalizedEmail" = lower(trim("normalizedEmail"::text))
WHERE email::text <> lower(trim(email::text))
   OR "normalizedEmail"::text <> lower(trim("normalizedEmail"::text));

UPDATE email_suppressions
SET "normalizedEmail" = lower(trim("normalizedEmail"::text))
WHERE "normalizedEmail"::text <> lower(trim("normalizedEmail"::text));

ALTER TABLE users
  ALTER COLUMN email TYPE citext USING lower(trim(email::text))::citext;

ALTER TABLE registration_verifications
  ALTER COLUMN email TYPE citext USING lower(trim(email::text))::citext;

ALTER TABLE user_accounts
  ALTER COLUMN "providerEmail" TYPE citext USING lower(trim("providerEmail"::text))::citext;

ALTER TABLE email_messages
  ALTER COLUMN "toEmail" TYPE citext USING lower(trim("toEmail"::text))::citext;

ALTER TABLE email_broadcast_recipients
  ALTER COLUMN email TYPE citext USING lower(trim(email::text))::citext,
  ALTER COLUMN "normalizedEmail" TYPE citext USING lower(trim("normalizedEmail"::text))::citext;

ALTER TABLE email_suppressions
  ALTER COLUMN "normalizedEmail" TYPE citext USING lower(trim("normalizedEmail"::text))::citext;

REINDEX TABLE users;
REINDEX TABLE registration_verifications;
REINDEX TABLE user_accounts;
REINDEX TABLE email_messages;
REINDEX TABLE email_broadcast_recipients;
REINDEX TABLE email_suppressions;
