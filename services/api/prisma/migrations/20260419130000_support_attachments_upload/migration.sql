-- AlterTable: make messageId nullable (attachments uploaded before being bound to a message)
ALTER TABLE "support_attachments" ALTER COLUMN "messageId" DROP NOT NULL;

-- AddColumn: threadId for scoping, uploaderId for ownership
-- DEFAULT '' is used as a safe placeholder during the ALTER; immediately dropped.
-- This table is empty in all fresh installations of the support system.
ALTER TABLE "support_attachments"
  ADD COLUMN "threadId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "uploaderId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "support_attachments"
  ALTER COLUMN "threadId" DROP DEFAULT,
  ALTER COLUMN "uploaderId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "support_attachments_threadId_idx" ON "support_attachments"("threadId");
CREATE INDEX "support_attachments_uploaderId_idx" ON "support_attachments"("uploaderId");

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "support_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
