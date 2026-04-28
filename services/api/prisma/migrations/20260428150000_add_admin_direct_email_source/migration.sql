-- Add ADMIN_DIRECT to EmailMessageSource enum
ALTER TYPE "EmailMessageSource" ADD VALUE IF NOT EXISTS 'ADMIN_DIRECT';
