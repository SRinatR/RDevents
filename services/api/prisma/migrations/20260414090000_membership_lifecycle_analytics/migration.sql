-- Extend event membership lifecycle timestamps.
ALTER TABLE "event_members"
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "removedAt" TIMESTAMP(3);

-- Track the MVP domain actions that happen outside simple page views.
ALTER TYPE "AnalyticsEventType" ADD VALUE 'TEAM_CREATED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'TEAM_JOIN_REQUESTED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'TEAM_MEMBER_APPROVED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'VOLUNTEER_APPLICATION_SUBMITTED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'VOLUNTEER_APPLICATION_APPROVED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'VOLUNTEER_APPLICATION_REJECTED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'EVENT_ADMIN_ASSIGNED';
