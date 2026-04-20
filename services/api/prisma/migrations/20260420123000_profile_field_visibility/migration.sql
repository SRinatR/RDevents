CREATE TABLE "profile_field_visibility_settings" (
  "key" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "isVisibleInCabinet" BOOLEAN NOT NULL DEFAULT true,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "profile_field_visibility_settings_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "profile_field_visibility_settings_sectionKey_idx" ON "profile_field_visibility_settings"("sectionKey");

ALTER TABLE "profile_field_visibility_settings"
ADD CONSTRAINT "profile_field_visibility_settings_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
