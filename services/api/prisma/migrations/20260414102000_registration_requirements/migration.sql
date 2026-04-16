-- Make the platform account profile truly minimal and add optional profile fields.
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "telegram" TEXT;
ALTER TABLE "users" ADD COLUMN "birthDate" TIMESTAMP(3);

-- Registration gates are configured per event.
ALTER TABLE "events" ADD COLUMN "registrationOpensAt" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "requiredProfileFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "events" ADD COLUMN "requiredEventFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Event-specific answers stay out of the global user profile.
CREATE TABLE "event_registration_answers" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registration_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_registration_answers_eventId_userId_key" ON "event_registration_answers"("eventId", "userId");
CREATE INDEX "event_registration_answers_userId_idx" ON "event_registration_answers"("userId");

ALTER TABLE "event_registration_answers" ADD CONSTRAINT "event_registration_answers_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_registration_answers" ADD CONSTRAINT "event_registration_answers_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
