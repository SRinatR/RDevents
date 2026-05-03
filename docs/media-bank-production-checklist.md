# Media Bank Production Checklist

Use this checklist before enabling or deploying the RDevents media bank in production.

## Public Gallery

- Open a published event with media bank enabled.
- Confirm approved images and videos are visible in the public gallery.
- Confirm pending, rejected, deleted, and inactive-asset media are not visible.
- Confirm ordering is stable by `approvedAt desc`, `createdAt desc`, then `id desc`.
- Confirm `showCredit=false` hides `credit` in `GET /api/events/:eventId/media`.
- Confirm `showUploaderName=false` hides `uploader` in `GET /api/events/:eventId/media`.
- Confirm `/api/events/media/highlights` applies the same event-level privacy settings.
- Confirm highlights include only published, non-deleted events with media bank enabled.

## Participant Upload

- Log in as an approved participant and upload an allowed image.
- Log in as an approved participant and upload an allowed video.
- Confirm moderation-enabled uploads enter `PENDING`.
- Confirm moderation-disabled uploads enter `APPROVED`.
- Confirm participant title/caption fields follow `allowParticipantTitle` and `allowParticipantCaption`.
- Confirm unsupported files return `EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED`.
- Confirm oversized files return `EVENT_MEDIA_FILE_TOO_LARGE`.
- Confirm missing files return `EVENT_MEDIA_FILE_REQUIRED`.
- Confirm non-participants receive `EVENT_MEDIA_UPLOAD_FORBIDDEN`.

## Admin Moderation

- Open the admin media workspace for an event.
- Confirm pending, approved, rejected, deleted, image, video, and search filters work.
- Approve a pending item and verify it appears in public gallery and highlights.
- Reject a pending item and confirm a rejection reason is required.
- Restore or move items between moderation states and check action history.
- Delete an item and confirm it disappears from public views.
- Upload organizer media and confirm it is approved immediately when media bank is enabled.
- Check `GET /api/admin/events/:id/media/summary` counts all media for that event regardless of list filters.

## Disabled Media Bank

- Set `enabled=false`.
- Confirm public event gallery returns no media and exposes settings with `enabled=false`.
- Confirm highlights do not include media from the disabled event.
- Confirm participant upload returns `EVENT_MEDIA_BANK_DISABLED`.
- Confirm organizer upload returns `EVENT_MEDIA_BANK_DISABLED`.
- Re-enable the media bank and confirm previously approved media is visible again.

## Allowed Types

- Set `allowedTypes=["image"]` and confirm image upload works.
- Confirm video upload returns `EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED`.
- Set `allowedTypes=["video"]` and confirm video upload works.
- Confirm image upload returns `EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED`.
- Confirm `allowedTypes=[]` returns `EVENT_MEDIA_ALLOWED_TYPES_REQUIRED`.
- Confirm invalid-only values such as `["pdf","doc"]` return `EVENT_MEDIA_ALLOWED_TYPES_REQUIRED`.

## Migration

- Run Prisma deploy migrations in staging before production.
- Confirm every existing event has one `event_media_settings` row.
- Confirm `allowedTypes` is never empty after backfill.
- Confirm defaults match product expectations: media bank enabled, participant upload enabled, moderation enabled, credit visible, uploader hidden.
- Run smoke checks against one old event and one newly created event.

## Rollback Notes

- If public privacy is wrong, disable the media bank globally or per affected event before investigating.
- If upload errors spike, set `participantUploadEnabled=false` for affected events.
- If moderation behaves incorrectly, keep public gallery enabled but disable participant upload and rely on organizer upload only.
- If migration fails, stop deploy, restore the database from the latest verified backup, and rerun migration in staging with the same data shape.
- Keep media files in storage during rollback; database rows can be restored or replayed, but deleted originals are harder to recover.
