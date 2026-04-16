CREATE TABLE "registration_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeSentAt" TIMESTAMP(3) NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "completionTokenHash" TEXT,
    "completionTokenExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_verifications_email_key" ON "registration_verifications"("email");
CREATE INDEX "registration_verifications_codeExpiresAt_idx" ON "registration_verifications"("codeExpiresAt");
CREATE INDEX "registration_verifications_completionTokenExpiresAt_idx" ON "registration_verifications"("completionTokenExpiresAt");
