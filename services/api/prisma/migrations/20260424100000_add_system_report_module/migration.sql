-- Migration: Add System Report Module
-- Created: 2026-04-24

-- System Report Templates
CREATE TABLE IF NOT EXISTS "system_report_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_report_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_templates_createdById_idx" ON "system_report_templates"("createdById");

-- System Report Generations
CREATE TABLE IF NOT EXISTS "system_report_generations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "format" TEXT NOT NULL DEFAULT 'txt',
    "outputPath" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "system_report_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "system_report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "system_report_generations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_generations_templateId_idx" ON "system_report_generations"("templateId");
CREATE INDEX IF NOT EXISTS "system_report_generations_createdById_idx" ON "system_report_generations"("createdById");
CREATE INDEX IF NOT EXISTS "system_report_generations_status_idx" ON "system_report_generations"("status");

-- System Report Section Logs
CREATE TABLE IF NOT EXISTS "system_report_section_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_report_section_logs_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "system_report_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_section_logs_generationId_idx" ON "system_report_section_logs"("generationId");

-- System Report Attachments
CREATE TABLE IF NOT EXISTS "system_report_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sectionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_report_attachments_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "system_report_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_attachments_generationId_idx" ON "system_report_attachments"("generationId");

-- Add missing createdById column to system_report_generations (if not exists from above)
ALTER TABLE "system_report_generations" ADD COLUMN IF NOT EXISTS "createdById" TEXT NOT NULL DEFAULT 'system';
