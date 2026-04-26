-- Migration: Add System Report Module
-- Created: 2026-04-24
-- Updated: 2026-04-24 to match Prisma schema

-- System Report Templates
CREATE TABLE IF NOT EXISTS "system_report_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_report_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_templates_createdById_idx" ON "system_report_templates"("createdById");
CREATE INDEX IF NOT EXISTS "system_report_templates_slug_idx" ON "system_report_templates"("slug");

-- System Report Runs (renamed from generations)
CREATE TABLE IF NOT EXISTS "system_report_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "configJson" JSONB NOT NULL,
    "summaryJson" JSONB,
    "errorText" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_report_runs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "system_report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "system_report_runs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_runs_templateId_idx" ON "system_report_runs"("templateId");
CREATE INDEX IF NOT EXISTS "system_report_runs_requestedByUserId_idx" ON "system_report_runs"("requestedByUserId");
CREATE INDEX IF NOT EXISTS "system_report_runs_status_idx" ON "system_report_runs"("status");
CREATE INDEX IF NOT EXISTS "system_report_runs_createdAt_idx" ON "system_report_runs"("createdAt");

-- System Report Events (renamed from section_logs)
CREATE TABLE IF NOT EXISTS "system_report_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_report_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "system_report_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_events_runId_idx" ON "system_report_events"("runId");
CREATE INDEX IF NOT EXISTS "system_report_events_level_idx" ON "system_report_events"("level");
CREATE INDEX IF NOT EXISTS "system_report_events_createdAt_idx" ON "system_report_events"("createdAt");

-- System Report Artifacts (renamed from attachments)
CREATE TABLE IF NOT EXISTS "system_report_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_report_artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "system_report_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_report_artifacts_runId_idx" ON "system_report_artifacts"("runId");
