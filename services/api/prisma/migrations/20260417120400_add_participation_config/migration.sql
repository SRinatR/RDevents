-- CreateParticipantLimitModeenum
CREATE TYPE "ParticipantLimitMode" AS ENUM ('UNLIMITED', 'GOAL_LIMIT', 'STRICT_LIMIT');

-- CreateParticipantCountVisibilityenum
CREATE TYPE "ParticipantCountVisibility" AS ENUM ('PUBLIC', 'HIDDEN');

-- AddIndividualParticipationConfig
ALTER TABLE "events" ADD COLUMN "requireParticipantApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "participantLimitMode" "ParticipantLimitMode" NOT NULL DEFAULT 'UNLIMITED';
ALTER TABLE "events" ADD COLUMN "participantTarget" INTEGER;
ALTER TABLE "events" ADD COLUMN "participantCountVisibility" "ParticipantCountVisibility" NOT NULL DEFAULT 'PUBLIC';
