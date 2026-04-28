-- Volunteer certificates stored on event member records.

ALTER TABLE "event_members"
  ADD COLUMN IF NOT EXISTS "volunteerCertificateOriginalFilename" TEXT,
  ADD COLUMN IF NOT EXISTS "volunteerCertificateMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "volunteerCertificateSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "volunteerCertificateStorageDriver" TEXT,
  ADD COLUMN IF NOT EXISTS "volunteerCertificateStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "volunteerCertificatePublicUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "volunteerCertificateUploadedAt" TIMESTAMP(3);
