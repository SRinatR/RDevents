-- Phone and Telegram verification require real OTP/bot flows.
-- Clear timestamps that could have been created by the previous UI-only confirmation button.

UPDATE "users"
SET
  "phoneVerifiedAt" = NULL,
  "telegramVerifiedAt" = NULL;

DELETE FROM "user_profile_section_states"
WHERE "sectionKey" IN ('consents', 'activity');
