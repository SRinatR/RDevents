CREATE TABLE "support_chat_threads" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_chat_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_chat_messages" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderType" "SupportSenderType" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_chat_threads_userId_key" ON "support_chat_threads"("userId");
CREATE INDEX "support_chat_threads_updatedAt_idx" ON "support_chat_threads"("updatedAt");
CREATE INDEX "support_chat_messages_threadId_createdAt_idx" ON "support_chat_messages"("threadId", "createdAt");

ALTER TABLE "support_chat_threads"
  ADD CONSTRAINT "support_chat_threads_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_chat_messages"
  ADD CONSTRAINT "support_chat_messages_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "support_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_chat_messages"
  ADD CONSTRAINT "support_chat_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
