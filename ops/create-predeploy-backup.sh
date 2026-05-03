#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
MIN_DB_BACKUP_BYTES="${MIN_DB_BACKUP_BYTES:-50000}"
REQUIRED_PRODUCTION_EVENT_SLUG="${REQUIRED_PRODUCTION_EVENT_SLUG:-dom-gde-zhivet-rossiya}"
REQUIRED_SUPER_ADMIN_EMAIL="${REQUIRED_SUPER_ADMIN_EMAIL:-rinat200355@gmail.com}"
ENABLE_PROVIDER_SNAPSHOT="${ENABLE_PROVIDER_SNAPSHOT:-false}"
PROVIDER_SNAPSHOT_COMMAND="${PROVIDER_SNAPSHOT_COMMAND:-}"

TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="$DEPLOY_ROOT/backups/releases/$RELEASE_SHA/$TS"
mkdir -p "$BACKUP_DIR"
ln -sfn "$BACKUP_DIR" "$DEPLOY_ROOT/backups/releases/$RELEASE_SHA/latest"

compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

UPLOAD_PATHS=("$DEPLOY_ROOT/uploads" "$APP_DIR/services/api/uploads" "$APP_DIR/public/uploads")
EXISTING_UPLOADS=()
for p in "${UPLOAD_PATHS[@]}"; do [ -d "$p" ] && EXISTING_UPLOADS+=("$p"); done

sha256sum "$ENV_FILE" > "$BACKUP_DIR/env.sha256"
compose ps --format json > "$BACKUP_DIR/docker-images.json" || true
[ -f "$APP_DIR/.release-commit" ] && cp "$APP_DIR/.release-commit" "$BACKUP_DIR/app-release-before.txt" || echo "unknown" > "$BACKUP_DIR/app-release-before.txt"

compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_DIR/db.sql.gz"
gzip -t "$BACKUP_DIR/db.sql.gz"
size=$(stat -c%s "$BACKUP_DIR/db.sql.gz")
[ "$size" -ge "$MIN_DB_BACKUP_BYTES" ] || { echo "ERROR: DB backup too small: $size"; exit 1; }

if [ "${#EXISTING_UPLOADS[@]}" -gt 0 ]; then
  tar -czf "$BACKUP_DIR/uploads.tar.gz" "${EXISTING_UPLOADS[@]}"
  tar -tzf "$BACKUP_DIR/uploads.tar.gz" >/dev/null
else
  echo "No uploads directories found" > "$BACKUP_DIR/uploads-warning.txt"
  tar -czf "$BACKUP_DIR/uploads.tar.gz" --files-from /dev/null
fi

snapshot_id=""
if [ "$ENABLE_PROVIDER_SNAPSHOT" = "true" ]; then
  [ -n "$PROVIDER_SNAPSHOT_COMMAND" ] || { echo "ERROR: PROVIDER_SNAPSHOT_COMMAND required"; exit 1; }
  snapshot_id="$(bash -lc "$PROVIDER_SNAPSHOT_COMMAND")"
  echo "$snapshot_id" > "$BACKUP_DIR/provider-snapshot-id.txt"
fi

compose exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select json_build_object('"'"'eventsCount'"'"', (select count(*) from events), '"'"'usersCount'"'"', (select count(*) from users), '"'"'eventMembersCount'"'"', (select count(*) from event_members), '"'"'eventTeamsCount'"'"', (select count(*) from event_teams), '"'"'analyticsEventsCount'"'"', (select count(*) from analytics_events));"' > "$BACKUP_DIR/business-baseline-before.json"

cat > "$BACKUP_DIR/deploy-manifest.json" <<JSON
{
  "releaseSha": "$RELEASE_SHA",
  "timestamp": "$(date -u +%FT%TZ)",
  "environment": "production",
  "dbBackup": "$BACKUP_DIR/db.sql.gz",
  "uploadsBackup": "$BACKUP_DIR/uploads.tar.gz",
  "envSha256": "$(cut -d' ' -f1 "$BACKUP_DIR/env.sha256")",
  "providerSnapshotId": ${snapshot_id:+"$snapshot_id"},
  "migrationStarted": false,
  "migrationFinished": false,
  "deployStatus": "BACKUP_CREATED"
}
JSON
[ -z "$snapshot_id" ] && sed -i 's/"providerSnapshotId": ,/"providerSnapshotId": null,/' "$BACKUP_DIR/deploy-manifest.json"

echo "$BACKUP_DIR"
