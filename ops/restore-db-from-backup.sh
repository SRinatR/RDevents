#!/usr/bin/env bash
set -euo pipefail
BACKUP_FILE="${1:?backup file required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"; RUNTIME_DIR="${RUNTIME_DIR:-$DEPLOY_ROOT/runtime}"; DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$RUNTIME_DIR/deploy.lock}"; ROLLBACK_LOCK_FILE="${ROLLBACK_LOCK_FILE:-$RUNTIME_DIR/rollback.lock}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
[ -f "$BACKUP_FILE" ] || { echo "backup missing"; exit 1; }
gzip -t "$BACKUP_FILE"
mkdir -p "$RUNTIME_DIR"
if [ "${ROLLBACK_LOCK_HELD:-false}" != "true" ]; then
  exec 8>"$DEPLOY_LOCK_FILE"
  if ! flock -n 8; then
    echo "A deploy is running. DB restore cannot start."
    exit 1
  fi
  exec 9>"$ROLLBACK_LOCK_FILE"
  if ! flock -n 9; then
    echo "Another rollback is running."
    exit 1
  fi
  echo "Acquired rollback locks for DB restore."
fi
TS="$(date +%Y%m%d-%H%M%S)"; EDIR="$DEPLOY_ROOT/backups/emergency-before-rollback-$TS"; mkdir -p "$EDIR"
compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$EDIR/db.sql.gz"
gzip -t "$EDIR/db.sql.gz"
compose stop api web report-worker email-broadcast-worker
compose exec -T postgres sh -lc 'dropdb --force -U "$POSTGRES_USER" "$POSTGRES_DB"'
compose exec -T postgres sh -lc 'createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
gunzip -c "$BACKUP_FILE" | compose exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
compose up -d api web report-worker email-broadcast-worker
if [ "${SKIP_DB_RESTORE_HEALTH_CHECK:-false}" != "true" ]; then
  bash "$APP_DIR/ops/check-production-business-health.sh"
fi
