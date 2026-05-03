#!/usr/bin/env bash
set -euo pipefail
BACKUP_FILE="${1:?backup file required}"; LOG_FILE="${2:-/tmp/restore-test.log}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
RELEASE_SHA="${RELEASE_SHA:-manual}"; REQUIRED_PRODUCTION_EVENT_SLUG="${REQUIRED_PRODUCTION_EVENT_SLUG:-dom-gde-zhivet-rossiya}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
SAFE_SHA="$(echo "$RELEASE_SHA" | tr -cd 'a-zA-Z0-9_-' | cut -c1-24)"; DB="restore_test_${SAFE_SHA}_$(date +%s)"
cleanup(){ compose exec -T postgres sh -lc "dropdb -U \"\$POSTGRES_USER\" --if-exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
gzip -t "$BACKUP_FILE"
{
  compose exec -T postgres sh -lc "createdb -U \"\$POSTGRES_USER\" $DB"
  gunzip -c "$BACKUP_FILE" | compose exec -T postgres sh -lc "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d $DB"
  for t in users events event_members event_teams; do
    c=$(compose exec -T postgres sh -lc "psql -U \"\$POSTGRES_USER\" -d $DB -Atc 'select count(*) from ${t}'")
    [ "$c" -gt 0 ] || { echo "table $t empty"; exit 1; }
  done
  rc=$(compose exec -T postgres sh -lc "psql -U \"\$POSTGRES_USER\" -d $DB -Atc \"select count(*) from events where slug='${REQUIRED_PRODUCTION_EVENT_SLUG}'\"")
  [ "$rc" = "1" ] || { echo "required event missing"; exit 1; }
  echo "DB backup restore test passed."
} | tee "$LOG_FILE"
