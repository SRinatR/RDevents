#!/usr/bin/env bash
set -euo pipefail
BACKUP_FILE="${1:?backup file required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
[ -f "$BACKUP_FILE" ] || { echo "backup missing"; exit 1; }
gzip -t "$BACKUP_FILE"
TS="$(date +%Y%m%d-%H%M%S)"; EDIR="$DEPLOY_ROOT/backups/emergency-before-rollback-$TS"; mkdir -p "$EDIR"
compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$EDIR/db.sql.gz"
compose stop api web report-worker email-broadcast-worker
compose exec -T postgres sh -lc 'dropdb --force -U "$POSTGRES_USER" "$POSTGRES_DB"'
compose exec -T postgres sh -lc 'createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
gunzip -c "$BACKUP_FILE" | compose exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
compose up -d api web report-worker email-broadcast-worker
bash "$APP_DIR/ops/check-production-business-health.sh"
