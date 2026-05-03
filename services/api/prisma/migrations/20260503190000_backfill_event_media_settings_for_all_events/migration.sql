INSERT INTO "event_media_settings" ("eventId")
SELECT "id"
FROM "events"
ON CONFLICT ("eventId") DO NOTHING;
