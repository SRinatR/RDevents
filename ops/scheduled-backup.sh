#!/usr/bin/env bash
set -euo pipefail
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; LOG_DIR="$DEPLOY_ROOT/deploy-logs"; mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"; LOG="$LOG_DIR/scheduled-backup-$TS.log"
exec >>"$LOG" 2>&1
docker compose --env-file "$DEPLOY_ROOT/.env" -f "$APP_DIR/docker-compose.prod.yml" up -d postgres
RELEASE_SHA="scheduled-$TS" DEPLOY_ROOT="$DEPLOY_ROOT" APP_DIR="$APP_DIR" ENV_FILE="$DEPLOY_ROOT/.env" COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml" bash "$APP_DIR/ops/create-predeploy-backup.sh"
