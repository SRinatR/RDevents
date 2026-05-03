#!/usr/bin/env bash
set -euo pipefail
MIN_EVENT_APPLICATIONS="${MIN_EVENT_APPLICATIONS:-1}"; MIN_EVENT_TEAMS="${MIN_EVENT_TEAMS:-1}"; REQUIRED_SUPER_ADMIN_EMAIL="${REQUIRED_SUPER_ADMIN_EMAIL:-rinat200355@gmail.com}"; REQUIRED_PRODUCTION_EVENT_SLUG="${REQUIRED_PRODUCTION_EVENT_SLUG:-dom-gde-zhivet-rossiya}"; REQUIRED_EVENT_ID="${REQUIRED_EVENT_ID:-cmo8j8w7c000s4bqxo8w89l3a}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"select count(*) from events where slug='${REQUIRED_PRODUCTION_EVENT_SLUG}' and status='PUBLISHED' and \"deletedAt\" is null;\"" | grep -q '^1$'
apps=$(compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"select count(*) from event_members where \"eventId\"='${REQUIRED_EVENT_ID}' and role='PARTICIPANT' and status<>'REMOVED';\"")
teams=$(compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"select count(*) from event_teams where \"eventId\"='${REQUIRED_EVENT_ID}' and coalesce(\"deletedAt\", null) is null;\"")
[ "$apps" -ge "$MIN_EVENT_APPLICATIONS" ] && [ "$teams" -ge "$MIN_EVENT_TEAMS" ]
compose exec -T postgres sh -lc "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"select count(*) from users where email='${REQUIRED_SUPER_ADMIN_EMAIL}' and role='SUPER_ADMIN' and \"isActive\"=true and \"deletedAt\" is null;\"" | grep -q '^1$'
curl -fsS https://api.rdevents.uz/api/events >/dev/null
curl -fsS https://rdevents.uz/ru/events >/dev/null
echo "Business health checks passed"
