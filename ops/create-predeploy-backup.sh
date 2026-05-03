#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
PREVIOUS_RELEASE_SHA="${PREVIOUS_RELEASE_SHA:-}"
MIN_DB_BACKUP_BYTES="${MIN_DB_BACKUP_BYTES:-50000}"

API_IMAGE_ID_BEFORE="${API_IMAGE_ID_BEFORE:-}"
WEB_IMAGE_ID_BEFORE="${WEB_IMAGE_ID_BEFORE:-}"
REPORT_WORKER_IMAGE_ID_BEFORE="${REPORT_WORKER_IMAGE_ID_BEFORE:-}"
EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE="${EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE:-}"
API_IMAGE_ID_AFTER="${API_IMAGE_ID_AFTER:-}"
WEB_IMAGE_ID_AFTER="${WEB_IMAGE_ID_AFTER:-}"
REPORT_WORKER_IMAGE_ID_AFTER="${REPORT_WORKER_IMAGE_ID_AFTER:-$API_IMAGE_ID_AFTER}"
EMAIL_BROADCAST_WORKER_IMAGE_ID_AFTER="${EMAIL_BROADCAST_WORKER_IMAGE_ID_AFTER:-$API_IMAGE_ID_AFTER}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="${OPS_DIR:-$SCRIPT_DIR}"

TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="$DEPLOY_ROOT/backups/releases/$RELEASE_SHA/$TS"
mkdir -p "$BACKUP_DIR"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

json_string_or_null() {
  local value="$1"
  if [ -z "$value" ]; then
    printf 'null'
  else
    printf '"%s"' "$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  fi
}

sha256sum "$ENV_FILE" > "$BACKUP_DIR/env.sha256"
env_sha256="$(cut -d' ' -f1 "$BACKUP_DIR/env.sha256")"

compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_DIR/db.sql.gz"
gzip -t "$BACKUP_DIR/db.sql.gz"
db_size="$(stat -c%s "$BACKUP_DIR/db.sql.gz")"
[ "$db_size" -ge "$MIN_DB_BACKUP_BYTES" ]

volume_name="$(docker volume ls --format '{{.Name}}' | grep 'api_uploads$' | head -n1 || true)"
if [ -z "$volume_name" ]; then
  echo "ERROR: Docker uploads volume matching api_uploads was not found."
  exit 1
fi

docker run --rm \
  -v "$volume_name:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine sh -lc 'tar -czf /backup/uploads.tar.gz -C /data .'
tar -tzf "$BACKUP_DIR/uploads.tar.gz" >/dev/null
uploads_size="$(stat -c%s "$BACKUP_DIR/uploads.tar.gz")"

compose ps --format json > "$BACKUP_DIR/docker-images-before.json" || true

if bash "$OPS_DIR/check-production-business-health.sh" \
  --output "$BACKUP_DIR/business-baseline-before.json" \
  --skip-http > "$BACKUP_DIR/business-baseline-before.log" 2>&1; then
  business_before_json="$(json_string_or_null "$BACKUP_DIR/business-baseline-before.json")"
else
  if [ "${ALLOW_BUSINESS_CHECK_FAILURE:-false}" != "true" ]; then
    echo "ERROR: business baseline before deploy failed."
    exit 1
  fi
  business_before_json="null"
fi

cat > "$BACKUP_DIR/backup-checks.json" <<JSON
{
  "dbBackupCreated": true,
  "dbBackupSizeBytes": $db_size,
  "dbBackupGzipOk": true,
  "uploadsBackupCreated": true,
  "uploadsBackupSizeBytes": $uploads_size,
  "uploadsBackupTarOk": true,
  "uploadsVolume": "$(printf '%s' "${volume_name:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}
JSON

cat > "$BACKUP_DIR/deploy-manifest.json" <<JSON
{
  "releaseSha": "$RELEASE_SHA",
  "previousReleaseSha": $(json_string_or_null "$PREVIOUS_RELEASE_SHA"),
  "timestamp": "$(date -u +%FT%TZ)",
  "updatedAt": "$(date -u +%FT%TZ)",
  "environment": "production",
  "dbBackup": "$BACKUP_DIR/db.sql.gz",
  "dbBackupSizeBytes": $db_size,
  "dbBackupGzipOk": true,
  "uploadsBackup": "$BACKUP_DIR/uploads.tar.gz",
  "uploadsBackupSizeBytes": $uploads_size,
  "uploadsBackupTarOk": true,
  "uploadsVolume": $(json_string_or_null "${volume_name:-}"),
  "envSha256": "$env_sha256",
  "apiImageIdBefore": $(json_string_or_null "$API_IMAGE_ID_BEFORE"),
  "webImageIdBefore": $(json_string_or_null "$WEB_IMAGE_ID_BEFORE"),
  "reportWorkerImageIdBefore": $(json_string_or_null "$REPORT_WORKER_IMAGE_ID_BEFORE"),
  "emailBroadcastWorkerImageIdBefore": $(json_string_or_null "$EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE"),
  "apiImageIdAfter": $(json_string_or_null "$API_IMAGE_ID_AFTER"),
  "webImageIdAfter": $(json_string_or_null "$WEB_IMAGE_ID_AFTER"),
  "reportWorkerImageIdAfter": $(json_string_or_null "$REPORT_WORKER_IMAGE_ID_AFTER"),
  "emailBroadcastWorkerImageIdAfter": $(json_string_or_null "$EMAIL_BROADCAST_WORKER_IMAGE_ID_AFTER"),
  "restoreTestStatus": "PENDING",
  "migrationStarted": false,
  "migrationFinished": false,
  "businessHealthBefore": $business_before_json,
  "businessHealthAfter": null,
  "deployStatus": "BACKUP_CREATED",
  "failedStage": null
}
JSON

if command -v jq >/dev/null 2>&1; then
  jq -e . "$BACKUP_DIR/deploy-manifest.json" >/dev/null
fi

ln -sfn "$BACKUP_DIR" "$DEPLOY_ROOT/backups/releases/$RELEASE_SHA/latest"
echo "$BACKUP_DIR"
