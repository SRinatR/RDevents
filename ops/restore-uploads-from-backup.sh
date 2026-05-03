#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:?archive required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-$DEPLOY_ROOT/backups}"
RUNTIME_DIR="${RUNTIME_DIR:-$DEPLOY_ROOT/runtime}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$RUNTIME_DIR/deploy.lock}"
ROLLBACK_LOCK_FILE="${ROLLBACK_LOCK_FILE:-$RUNTIME_DIR/rollback.lock}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="${OPS_DIR:-$SCRIPT_DIR}"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

mkdir -p "$RUNTIME_DIR"
if [ "${ROLLBACK_LOCK_HELD:-false}" != "true" ]; then
  exec 8>"$DEPLOY_LOCK_FILE"
  if ! flock -n 8; then
    echo "A deploy is running. Uploads restore cannot start."
    exit 1
  fi
  exec 9>"$ROLLBACK_LOCK_FILE"
  if ! flock -n 9; then
    echo "Another rollback is running."
    exit 1
  fi
  echo "Acquired rollback locks for uploads restore."
fi

[ -f "$ARCHIVE" ] || {
  echo "ERROR: uploads archive was not found: $ARCHIVE"
  exit 1
}

if ! tar -tzf "$ARCHIVE" >/dev/null; then
  echo "ERROR: uploads archive is corrupt or unreadable: $ARCHIVE"
  exit 1
fi

volume_name="$(docker volume ls --format '{{.Name}}' | grep 'api_uploads$' | head -n1 || true)"
if [ -z "$volume_name" ]; then
  echo "ERROR: Docker uploads volume matching api_uploads was not found."
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
EMERGENCY_DIR="$BACKUP_ROOT/emergency-before-uploads-rollback-$TS"
mkdir -p "$EMERGENCY_DIR"

echo "Creating emergency backup of current uploads volume '$volume_name'..."
docker run --rm \
  -v "$volume_name:/data:ro" \
  -v "$EMERGENCY_DIR:/backup" \
  alpine sh -lc 'tar -czf /backup/uploads.tar.gz -C /data .'

tar -tzf "$EMERGENCY_DIR/uploads.tar.gz" >/dev/null
echo "Emergency uploads backup written to $EMERGENCY_DIR/uploads.tar.gz"

services_stopped=false
restart_services() {
  if [ "$services_stopped" = "true" ]; then
    compose up -d api report-worker email-broadcast-worker >/dev/null 2>&1 || true
  fi
}
trap restart_services EXIT

echo "Stopping API and worker services before uploads restore..."
compose stop api report-worker email-broadcast-worker
services_stopped=true

archive_dir="$(cd "$(dirname "$ARCHIVE")" && pwd)"
archive_base="$(basename "$ARCHIVE")"

echo "Restoring uploads archive into Docker volume '$volume_name'..."
docker run --rm \
  -e ARCHIVE_BASE="$archive_base" \
  -v "$volume_name:/data" \
  -v "$archive_dir:/backup:ro" \
  alpine sh -lc '
    rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true
    tar -xzf "/backup/$ARCHIVE_BASE" -C /data
  '

restored_count="$(docker run --rm -v "$volume_name:/data:ro" alpine sh -lc 'find /data -mindepth 1 | wc -l' | tr -d '[:space:]')"
echo "Restored uploads volume item count: $restored_count"

echo "Restarting API and worker services..."
compose up -d api report-worker email-broadcast-worker
services_stopped=false
trap - EXIT

if [ "${SKIP_UPLOADS_RESTORE_HEALTH_CHECK:-false}" != "true" ]; then
  bash "$OPS_DIR/check-production-business-health.sh"
fi
echo "Uploads restore completed from $ARCHIVE"
