-- AddRefreshSession
-- Add server-side refresh session table for secure token rotation with reuse detection.

CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on token hash so each token can only exist once
CREATE UNIQUE INDEX "refresh_sessions_tokenHash_key" ON "refresh_sessions"("tokenHash");

-- Index for finding active sessions per user
CREATE INDEX "refresh_sessions_userId_revokedAt_idx" ON "refresh_sessions"("userId", "revokedAt");

-- Index for cleanup job: finding expired sessions
CREATE INDEX "refresh_sessions_expiresAt_idx" ON "refresh_sessions"("expiresAt");

-- Self-referential FK for rotation chain
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_replacedById_fkey"
    FOREIGN KEY ("replacedById") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- FK to users table
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;