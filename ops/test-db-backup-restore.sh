#!/usr/bin/env bash
set -euo pipefail
BACKUP_FILE="${1:?backup file required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
RELEASE_SHA="${RELEASE_SHA:-manual}"
REQUIRED_PRODUCTION_EVENT_SLUG="${REQUIRED_PRODUCTION_EVENT_SLUG:-dom-gde-zhivet-rossiya}"
LOG_FILE="${2:-/tmp/restore-test.log}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
DB="restore_test_${RELEASE_SHA}_$(date +%s)"
{
  echo "Creating $DB"
  compose exec -T postgres sh -lc "createdb -U \"$POSTGRES_USER\" $DB"
  gunzip -c "$BACKUP_FILE" | compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d $DB"
  compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d $DB -c \"select count(*) from users; select count(*) from events; select count(*) from event_members; select count(*) from event_teams;\""
  compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d $DB -c \"select id, slug, title, status from events where slug='${REQUIRED_PRODUCTION_EVENT_SLUG}';\""
  echo "DB backup restore test passed."
} | tee "$LOG_FILE"
compose exec -T postgres sh -lc "dropdb -U \"$POSTGRES_USER\" --if-exists $DB"
