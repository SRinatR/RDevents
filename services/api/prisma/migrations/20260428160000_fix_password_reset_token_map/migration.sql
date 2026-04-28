-- Migration: fix_password_reset_token_map
-- Created: 2026-04-28

-- The PasswordResetToken model now has @@map("password_reset_tokens")
-- This migration ensures the schema aligns with Prisma expectations
-- No actual schema changes needed - already created in earlier migrations
