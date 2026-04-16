-- Remove FK constraint from registration_verifications to users
-- This FK was incorrect because RegistrationVerification is used BEFORE user creation

ALTER TABLE "registration_verifications" 
DROP CONSTRAINT IF EXISTS "registration_verifications_email_fkey";
