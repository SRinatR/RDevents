CREATE TYPE "EmailRecipientKind" AS ENUM ('USER','EVENT_MEMBER','TEAM_MEMBER','PREFILL_CONTACT','MANUAL_EMAIL');

ALTER TABLE "email_broadcast_recipients"
  ADD COLUMN "recipientKind" "EmailRecipientKind" NOT NULL DEFAULT 'USER',
  ADD COLUMN "eventMemberId" TEXT,
  ADD COLUMN "teamMemberId" TEXT,
  ADD COLUMN "prefillContactId" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "skipReasonCode" TEXT;
