# Production readiness staging checklist

This checklist is the production merge gate for `codex/protect-production-data-from-cleanup`.

Do not merge or deploy this branch to production until the staging deploy and rollback drills below pass.

## Goal

Prove on staging that the safety system can recover:

- application code;
- PostgreSQL data;
- uploads and media files;
- critical event data;
- team data;
- applications and registrations;
- super admin access;
- public API and web availability.

## Staging prerequisites

Staging should be as close to production as practical:

- Docker Compose;
- PostgreSQL service;
- API service;
- Web service;
- `report-worker`;
- `email-broadcast-worker`;
- uploads Docker volume matching `api_uploads`;
- at least one event;
- at least one participant;
- at least one team;
- at least one uploaded file;
- a super admin user.

Recommended environment:

```bash
export REQUIRED_PRODUCTION_EVENT_SLUG=dom-gde-zhivet-rossiya
export REQUIRED_EVENT_ID=<staging_event_id>
export REQUIRED_SUPER_ADMIN_EMAIL=rinat200355@gmail.com
export MIN_EVENT_APPLICATIONS=1
export MIN_EVENT_TEAMS=1
```

## Static validation

Run locally or in CI:

```bash
bash -n ops/*.sh
bash ops/ci-validate-production-safety.sh
corepack pnpm --filter @event-platform/api prisma format
corepack pnpm --filter @event-platform/api prisma validate
corepack pnpm --filter @event-platform/api prisma generate
corepack pnpm --filter @event-platform/api run lint
corepack pnpm --filter @event-platform/api run typecheck
corepack pnpm --filter @event-platform/api run build
corepack pnpm --filter @event-platform/web run build
git diff --check
```

Acceptance:

- all commands pass;
- CI runs Node 24 and passes;
- no Prisma, TypeScript, build, bash syntax, or safety validation errors.

## Staging deploy drill

Run a normal staging deploy using `ops/deploy-production.sh`.

Expected flow:

1. Build images.
2. Capture image IDs.
3. Capture previous release SHA.
4. Create predeploy backup package.
5. Run DB restore-test.
6. Run Prisma migrations.
7. Skip mock cleanup.
8. Recreate services.
9. Verify service health.
10. Verify running image IDs.
11. Install ops scripts into `/opt/rdevents/ops`.
12. Install and enable scheduled backup timer.
13. Run local release verification.
14. Run public release verification.
15. Run business health check.
16. Update release registry.
17. Mark deploy success.

Verify services:

```bash
docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps
```

Expected services:

- `postgres` healthy;
- `api` healthy;
- `web` healthy;
- `report-worker` healthy;
- `email-broadcast-worker` healthy.

Verify release registry:

```bash
cat /opt/rdevents/runtime/releases.json | jq
```

Expected:

- `current` is the new release SHA;
- `previous` is set if this is not the first deploy;
- current release has `apiImageId`, `webImageId`, `reportWorkerImageId`, and `emailBroadcastWorkerImageId`.

Verify backup package:

```bash
ls -lh /opt/rdevents/backups/releases/<release_sha>/*/
cat /opt/rdevents/backups/releases/<release_sha>/<timestamp>/deploy-manifest.json | jq
gzip -t /opt/rdevents/backups/releases/<release_sha>/<timestamp>/db.sql.gz
tar -tzf /opt/rdevents/backups/releases/<release_sha>/<timestamp>/uploads.tar.gz >/dev/null
```

Expected files:

- `db.sql.gz`;
- `uploads.tar.gz`;
- `env.sha256`;
- `backup-checks.json`;
- `deploy-manifest.json`;
- `business-baseline-before.json`;
- `business-baseline-before.log`;
- `restore-test.log`.

Manifest acceptance:

- `releaseSha` is set;
- `previousReleaseSha` is set if previous release exists;
- `dbBackup` and `uploadsBackup` point to existing files;
- `dbBackupGzipOk = true`;
- `uploadsBackupTarOk = true`;
- `restoreTestStatus = PASSED`;
- `migrationStarted = true`;
- `migrationFinished = true`;
- deploy status is successful;
- business health baselines exist.

## Manual DB restore-test drill

```bash
/opt/rdevents/ops/test-db-backup-restore.sh \
  /opt/rdevents/backups/releases/<release_sha>/<timestamp>/db.sql.gz \
  /tmp/restore-test-manual.log
```

Acceptance:

- temporary DB is created;
- backup restores with `ON_ERROR_STOP=1`;
- key tables are checked;
- required event exists exactly once;
- temporary DB is dropped;
- script exits 0.

Negative test:

```bash
cp /opt/rdevents/backups/releases/<release_sha>/<timestamp>/db.sql.gz /tmp/corrupt-db.sql.gz
printf 'corrupt' >> /tmp/corrupt-db.sql.gz
/opt/rdevents/ops/test-db-backup-restore.sh /tmp/corrupt-db.sql.gz /tmp/restore-test-corrupt.log
```

Acceptance:

- script fails;
- temp DB is cleaned up;
- production DB is untouched.

## Code-only rollback drill

Precondition: staging has at least two releases in `/opt/rdevents/runtime/releases.json`.

```bash
cat /opt/rdevents/runtime/releases.json | jq
/opt/rdevents/ops/rollback-production.sh \
  --mode code \
  --to-release <previous_release_sha>
```

Verify image IDs:

```bash
docker inspect $(docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps -q api) --format '{{.Image}}'
docker inspect $(docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps -q web) --format '{{.Image}}'
```

Verify release endpoints:

```bash
curl -fsS https://api.rdevents.uz/release.json
curl -fsS https://rdevents.uz/release.json
curl -fsS https://api.rdevents.uz/version
curl -fsS https://rdevents.uz/version.txt
```

Acceptance:

- code rollback changes actual running Docker images;
- release endpoints show old SHA;
- business health passes;
- no DB restore happens.

## Code and DB rollback drill

Use the manifest for the failed or newest release. Rollback should use `previousReleaseSha` from that manifest.

```bash
/opt/rdevents/ops/rollback-production.sh \
  --mode code-db \
  --manifest /opt/rdevents/backups/releases/<failed_or_new_release>/<timestamp>/deploy-manifest.json
```

Verify emergency backup:

```bash
ls -lh /opt/rdevents/backups/emergency-before-rollback-*/
```

Verify restored DB data:

```bash
docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml exec -T postgres sh -lc '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
select id, slug, title, status, \"deletedAt\"
from events
where slug = '\''dom-gde-zhivet-rossiya'\'';
"
'

/opt/rdevents/ops/check-production-business-health.sh
```

Acceptance:

- DB is restored from backup;
- emergency backup exists;
- services recover;
- previous release code runs;
- required event exists;
- applications and teams are not unexpectedly zero;
- super admin exists and is active.

## Full rollback with uploads drill

Record current uploads state:

```bash
docker volume ls | grep api_uploads
docker run --rm \
  -v <actual_api_uploads_volume>:/data:ro \
  alpine sh -lc 'find /data -type f | sort | head -20'
```

Run full rollback:

```bash
/opt/rdevents/ops/rollback-production.sh \
  --mode full \
  --manifest /opt/rdevents/backups/releases/<release_sha>/<timestamp>/deploy-manifest.json
```

Verify uploads:

```bash
docker run --rm \
  -v <actual_api_uploads_volume>:/data:ro \
  alpine sh -lc 'find /data -type f | sort | head -20'

tar -tzf /opt/rdevents/backups/emergency-before-uploads-rollback-*/uploads.tar.gz >/dev/null
curl -I <cover_or_media_url>
```

Acceptance:

- DB is restored;
- uploads restore into Docker volume;
- previous code runs;
- emergency uploads backup exists;
- uploaded files are accessible;
- business health passes.

## Scheduled backup validation

```bash
systemctl is-enabled rdevents-backup.timer
systemctl is-active rdevents-backup.timer
systemctl status rdevents-backup.timer
systemctl start rdevents-backup.service
journalctl -u rdevents-backup.service -n 100 --no-pager
find /opt/rdevents/backups -maxdepth 5 -type f -name 'db.sql.gz' | sort | tail
/opt/rdevents/ops/check-backup-health.sh
```

Acceptance:

- timer is enabled;
- timer is active;
- manual scheduled backup creates a package;
- backup health passes;
- logs are readable.

## Production server prerequisites

Before production deploy:

```bash
command -v docker
command -v jq
command -v curl
command -v flock
command -v gzip
command -v tar
command -v systemctl

docker volume ls | grep api_uploads
docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps
/opt/rdevents/ops/check-production-business-health.sh
```

Install missing base tools:

```bash
apt update
apt install -y jq curl gzip tar util-linux
```

## Production merge gate

Do not merge to production until all are true:

- CI is green.
- Staging normal deploy succeeded.
- Staging backup package was created and validated.
- Staging restore-test passed.
- Staging code-only rollback succeeded.
- Staging code and DB rollback succeeded.
- Staging full rollback with uploads succeeded.
- Staging deploy rerun release-registry regression drill succeeded. See [production-deploy-rerun-registry-regression.md](production-deploy-rerun-registry-regression.md).
- Scheduled backup timer succeeded on staging.
- Business health passed after deploy and rollback.
- Production cleanup is absent from deploy.
- `dom-gde-zhivet-rossiya` is protected from cleanup.
- `rinat200355@gmail.com` remains `SUPER_ADMIN` and active.
- Rollback runbook has exact commands.
- The team knows which manifest to use during rollback.

## Production deploy reminders

Create one extra manual DB backup immediately before production deploy:

```bash
cd /opt/rdevents/app

docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml exec -T postgres sh -lc '
pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"
' | gzip > "/opt/rdevents/backups/manual-before-safety-release-$(date +%Y%m%d-%H%M%S).sql.gz"

gzip -t /opt/rdevents/backups/manual-before-safety-release-*.sql.gz
```

After deploy:

```bash
/opt/rdevents/ops/check-production-business-health.sh
curl -fsS https://api.rdevents.uz/api/events
```

Verify super admin:

```bash
docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml exec -T postgres sh -lc '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
select email, role, \"isActive\", \"deletedAt\", \"protectedFromCleanup\"
from users
where email = '\''rinat200355@gmail.com'\'';
"
'
```

Verify protected event:

```bash
docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml exec -T postgres sh -lc '
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
select slug, status, \"deletedAt\", \"isSeedData\", \"protectedFromCleanup\"
from events
where slug = '\''dom-gde-zhivet-rossiya'\'';
"
'
```

Expected:

- user role is `SUPER_ADMIN`;
- user `isActive = true`;
- user `deletedAt = null`;
- user `protectedFromCleanup = true`;
- event `deletedAt = null`;
- event `protectedFromCleanup = true`.

## Emergency rollback commands

Code only:

```bash
/opt/rdevents/ops/rollback-production.sh \
  --mode code \
  --to-release <previous_release_sha>
```

Code and DB:

```bash
/opt/rdevents/ops/rollback-production.sh \
  --mode code-db \
  --manifest <manifest_path>
```

Code, DB, and uploads:

```bash
/opt/rdevents/ops/rollback-production.sh \
  --mode full \
  --manifest <manifest_path>
```

Find manifests and releases:

```bash
find /opt/rdevents/backups/releases -name deploy-manifest.json | sort
cat /opt/rdevents/runtime/releases.json | jq
```

After rollback:

```bash
docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps
/opt/rdevents/ops/check-production-business-health.sh
curl -fsS https://api.rdevents.uz/health
curl -fsS https://api.rdevents.uz/api/events
curl -fsS https://rdevents.uz/ru/events
```
