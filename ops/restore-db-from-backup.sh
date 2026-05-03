#!/usr/bin/env bash
set -euo pipefail
BACKUP_FILE="${1:?backup file required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
gunzip -c "$BACKUP_FILE" | compose exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
