#!/usr/bin/env bash
set -euo pipefail

MODE=""
TO_RELEASE=""
MANIFEST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --to-release)
      TO_RELEASE="${2:-}"
      shift 2
      ;;
    --manifest)
      MANIFEST="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

case "$MODE" in
  code|code-db|full) ;;
  *)
    echo "--mode must be one of: code, code-db, full"
    exit 1
    ;;
esac

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
RUNTIME_DIR="${RUNTIME_DIR:-$DEPLOY_ROOT/runtime}"
LOG_DIR="${LOG_DIR:-$DEPLOY_ROOT/deploy-logs}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$RUNTIME_DIR/deploy.lock}"
ROLLBACK_LOCK_FILE="${ROLLBACK_LOCK_FILE:-$RUNTIME_DIR/rollback.lock}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="${OPS_DIR:-$SCRIPT_DIR}"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
LOG_FILE="$LOG_DIR/rollback-production-$MODE-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command is missing: $1"
    exit 1
  }
}

require_cmd flock
require_cmd jq

manifest_get() {
  local key="$1"
  jq -er "--arg" key "$key" '.[$key] // empty' "$MANIFEST"
}

validate_manifest() {
  [ -n "$MANIFEST" ] || {
    echo "--manifest is required for mode=$MODE"
    exit 1
  }
  [ -f "$MANIFEST" ] || {
    echo "Manifest not found: $MANIFEST"
    exit 1
  }
  jq -e . "$MANIFEST" >/dev/null
}

exec 8>"$DEPLOY_LOCK_FILE"
if ! flock -n 8; then
  echo "A deploy is running. Rollback cannot start."
  exit 1
fi
echo "Acquired deploy coordination lock: $DEPLOY_LOCK_FILE"

exec 9>"$ROLLBACK_LOCK_FILE"
if ! flock -n 9; then
  echo "Another rollback is running."
  exit 1
fi
echo "Acquired rollback lock: $ROLLBACK_LOCK_FILE"

export ROLLBACK_LOCK_HELD=true

if [ "$MODE" = "code" ]; then
  [ -n "$TO_RELEASE" ] || {
    echo "--to-release is required for mode=code"
    exit 1
  }
  bash "$OPS_DIR/rollback-code.sh" --to-release "$TO_RELEASE"
  bash "$OPS_DIR/check-production-business-health.sh"
  echo "Production code rollback completed. Log: $LOG_FILE"
  exit 0
fi

validate_manifest

DB_BACKUP="$(manifest_get dbBackup)"
UPLOADS_BACKUP="$(manifest_get uploadsBackup || true)"
ROLLBACK_RELEASE="$(manifest_get previousReleaseSha || true)"
if [ -z "$ROLLBACK_RELEASE" ]; then
  ROLLBACK_RELEASE="$(manifest_get releaseSha)"
fi

[ -f "$DB_BACKUP" ] || {
  echo "DB backup from manifest is missing: $DB_BACKUP"
  exit 1
}

echo "Restoring database from manifest backup: $DB_BACKUP"
SKIP_DB_RESTORE_HEALTH_CHECK=true bash "$OPS_DIR/restore-db-from-backup.sh" "$DB_BACKUP"

if [ "$MODE" = "full" ]; then
  [ -n "$UPLOADS_BACKUP" ] || {
    echo "Manifest does not contain uploadsBackup"
    exit 1
  }
  [ -f "$UPLOADS_BACKUP" ] || {
    echo "Uploads backup from manifest is missing: $UPLOADS_BACKUP"
    exit 1
  }
  echo "Restoring uploads from manifest backup: $UPLOADS_BACKUP"
  SKIP_UPLOADS_RESTORE_HEALTH_CHECK=true bash "$OPS_DIR/restore-uploads-from-backup.sh" "$UPLOADS_BACKUP"
fi

echo "Rolling code back to release: $ROLLBACK_RELEASE"
bash "$OPS_DIR/rollback-code.sh" --to-release "$ROLLBACK_RELEASE"
bash "$OPS_DIR/check-production-business-health.sh"

echo "Production rollback completed for mode=$MODE. Log: $LOG_FILE"
