# Database Migration Strategy (Expand / Contract)

## Goal

Allow safe schema evolution in production with zero-downtime compatible releases.

## Phase 1 — Expand

- Add new tables/columns/indexes only.
- Keep old fields and old code path intact.
- Deploy backend that can read/write both old and new representation when needed.

## Phase 2 — Backfill

- Backfill existing data in controlled batches.
- Verify row counts and integrity checks.
- Monitor DB load and lock behavior.

## Phase 3 — Switch

- Move reads to new schema behind a feature flag.
- Then move writes to new schema.
- Keep compatibility fallbacks for at least one release cycle.

## Phase 4 — Contract

- Remove old path only after stable observation period.
- Drop deprecated columns/tables in a separate release.

## Required checklist for each migration PR

- Migration type: additive / destructive
- Expected lock profile
- Backfill strategy and estimated duration
- Compatibility plan across current and previous app version
- Rollback strategy

## Production rules

- Never combine destructive schema change and major behavior change in one release.
- Never run seed in production.
- Always verify backup and readiness checks before migration.
