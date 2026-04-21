-- Migration: create_password_reset_tokens_table
-- Created: 2026-04-21

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedIp" TEXT,
    "requestedUa" TEXT,
    "consumedIp" TEXT,
    "consumedUa" TEXT,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_tokenHash_key" UNIQUE("tokenHash")
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");
