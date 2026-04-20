CREATE TABLE "password_reset_verifications" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeSentAt" TIMESTAMP(3) NOT NULL,
  "codeExpiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verifiedAt" TIMESTAMP(3),
  "resetTokenHash" TEXT,
  "resetTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_verifications_email_key" ON "password_reset_verifications"("email");
CREATE INDEX "password_reset_verifications_codeExpiresAt_idx" ON "password_reset_verifications"("codeExpiresAt");
CREATE INDEX "password_reset_verifications_resetTokenExpiresAt_idx" ON "password_reset_verifications"("resetTokenExpiresAt");
