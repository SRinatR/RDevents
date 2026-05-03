# Production deployment plan: media bank after PR #172

Date: 2026-05-03  
Repository: `RDevents`  
Merged change reference: PR #172 (`2ada719979365cdcad1a032762d79150f8ecc3fc`)

## 1) Validation status in this environment

### Runtime gate (BLOCKER)
- `node -v` => `v22.21.1` (project requires `>=24.0.0`).
- Because of that, Node 24+ validation is **not yet satisfied**.

### Executed checks
- `corepack enable` ✅
- `corepack pnpm install --frozen-lockfile` ✅ (with engine warning due to Node 22)
- `corepack pnpm db:generate` ✅
- `corepack pnpm typecheck` ✅
- `corepack pnpm lint` ✅
- `corepack pnpm build` ✅
- `corepack pnpm test` ❌

### Failing test suites (captured)
- `services/api/src/modules/admin/team-override.service.test.ts`
- `services/api/src/modules/events/registration-gates.integration.test.ts`
- aggregate: 3 failed test files, 33 failed tests, 14 passed files, 102 passed tests.

These failures are consistent with the previously documented Prisma integration instability and must be tracked separately before production go-live if they are unrelated to media-bank functionality.

## 2) Required pre-production actions (must-do)

1. Re-run full validation on **Node v24.x.x** (or newer) and attach logs:
   - `node -v`
   - `corepack enable`
   - `corepack pnpm install --frozen-lockfile`
   - `corepack pnpm db:generate`
   - `corepack pnpm typecheck`
   - `corepack pnpm lint`
   - `corepack pnpm build`
   - `corepack pnpm test`
2. Resolve failing Prisma integration tests **or** produce explicit written exception package:
   - full failure log,
   - exact failing suites/tests,
   - rationale of non-impact on media bank,
   - linked follow-up task/issue.
3. Confirm deployment source branch (`main` vs `production`) and ensure PR #172 commit is in actual deploy branch.

## 3) Migration readiness checks

Verify both migrations are present in deployment artifact:
- `services/api/prisma/migrations/20260503170000_event_media_history_settings`
- `services/api/prisma/migrations/20260503190000_backfill_event_media_settings_for_all_events`

Backfill migration SQL (already merged):

```sql
INSERT INTO "event_media_settings" ("eventId")
SELECT "id"
FROM "events"
ON CONFLICT ("eventId") DO NOTHING;
```

## 4) Staging DB procedure

1. Apply migrations:
   - `corepack pnpm --filter @event-platform/api prisma migrate deploy`
2. Validate counts:
   - `SELECT COUNT(*) FROM events;`
   - `SELECT COUNT(*) FROM event_media_settings;`
3. Validate no missing settings rows:

```sql
SELECT e.id
FROM events e
LEFT JOIN event_media_settings s ON s."eventId" = e.id
WHERE s."eventId" IS NULL;
```

Expected result: `0 rows`.

## 5) Production DB safety gate

Before production migration:

```bash
pg_dump "$DATABASE_URL" > backup_before_media_bank_$(date +%Y%m%d_%H%M%S).sql
ls -lh backup_before_media_bank_*.sql
```

No backup => no migration.

## 6) Deployment order

1. Deploy API code/image.
2. Run Prisma migrations:
   - `corepack pnpm --filter @event-platform/api prisma migrate deploy`
3. Verify API health:
   - `GET /health`
   - `GET /ready`
4. Deploy Web.
5. Smoke-check main user journeys (public event page, login, participant cabinet media page, admin media page).

## 7) Post-deploy SQL invariant

```sql
SELECT e.id
FROM events e
LEFT JOIN event_media_settings s ON s."eventId" = e.id
WHERE s."eventId" IS NULL;
```

Expected: `0 rows`.

## 8) Release decision for current state

Current repository state is **not deploy-ready** solely because the Node runtime in this environment is `v22.21.1` and mandatory Node 24+ validation cannot be confirmed here.

All other local gates (`install`, `db:generate`, `typecheck`, `lint`, `build`) are green with Node engine warnings; tests remain red on known Prisma integration suites and require explicit disposition.
