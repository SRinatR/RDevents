#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE=""
COMPARE_FILE=""
SKIP_HTTP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    --compare)
      COMPARE_FILE="${2:-}"
      shift 2
      ;;
    --skip-http)
      SKIP_HTTP=true
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

MIN_EVENT_APPLICATIONS="${MIN_EVENT_APPLICATIONS:-1}"
MIN_EVENT_TEAMS="${MIN_EVENT_TEAMS:-1}"
REQUIRED_SUPER_ADMIN_EMAIL="${REQUIRED_SUPER_ADMIN_EMAIL:-rinat200355@gmail.com}"
REQUIRED_PRODUCTION_EVENT_SLUG="${REQUIRED_PRODUCTION_EVENT_SLUG:-dom-gde-zhivet-rossiya}"
REQUIRED_EVENT_ID="${REQUIRED_EVENT_ID:-cmo8j8w7c000s4bqxo8w89l3a}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

psql_scalar() {
  local sql="$1"
  compose exec -T -e SQL="$sql" postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$SQL"' | tr -d '\r'
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

json_number_get() {
  local file="$1"
  local key="$2"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p" "$file" | head -1
}

events_has_deleted_at="$(psql_scalar "select exists(select 1 from information_schema.columns where table_name='events' and column_name='deletedAt');")"
users_has_deleted_at="$(psql_scalar "select exists(select 1 from information_schema.columns where table_name='users' and column_name='deletedAt');")"
teams_has_deleted_at="$(psql_scalar "select exists(select 1 from information_schema.columns where table_name='event_teams' and column_name='deletedAt');")"

if [ "$events_has_deleted_at" = "t" ]; then
  events_count="$(psql_scalar 'select count(*) from events where "deletedAt" is null;')"
  required_event_sql="select id || '|' || status || '|' || coalesce(\"deletedAt\"::text, '') from events where slug='${REQUIRED_PRODUCTION_EVENT_SLUG}' limit 1;"
else
  events_count="$(psql_scalar 'select count(*) from events;')"
  required_event_sql="select id || '|' || status || '|' from events where slug='${REQUIRED_PRODUCTION_EVENT_SLUG}' limit 1;"
fi

if [ "$users_has_deleted_at" = "t" ]; then
  users_count="$(psql_scalar 'select count(*) from users where "deletedAt" is null;')"
  super_admin_sql="select id || '|' || role || '|' || case when \"isActive\" then 'true' else 'false' end || '|' || coalesce(\"deletedAt\"::text, '') from users where email='${REQUIRED_SUPER_ADMIN_EMAIL}' limit 1;"
else
  users_count="$(psql_scalar 'select count(*) from users;')"
  super_admin_sql="select id || '|' || role || '|' || case when \"isActive\" then 'true' else 'false' end || '|' from users where email='${REQUIRED_SUPER_ADMIN_EMAIL}' limit 1;"
fi

event_members_count="$(psql_scalar "select count(*) from event_members where \"eventId\"='${REQUIRED_EVENT_ID}' and role='PARTICIPANT' and status<>'REMOVED';")"
if [ "$teams_has_deleted_at" = "t" ]; then
  event_teams_count="$(psql_scalar "select count(*) from event_teams where \"eventId\"='${REQUIRED_EVENT_ID}' and \"deletedAt\" is null;")"
else
  event_teams_count="$(psql_scalar "select count(*) from event_teams where \"eventId\"='${REQUIRED_EVENT_ID}';")"
fi
analytics_events_count="$(psql_scalar "select count(*) from analytics_events where \"eventId\"='${REQUIRED_EVENT_ID}';")"

required_event_row="$(psql_scalar "$required_event_sql")"
if [ -n "$required_event_row" ]; then
  required_event_exists=true
  required_event_status="$(printf '%s' "$required_event_row" | cut -d'|' -f2)"
  required_event_deleted_at="$(printf '%s' "$required_event_row" | cut -d'|' -f3)"
else
  required_event_exists=false
  required_event_status=""
  required_event_deleted_at=""
fi

super_admin_row="$(psql_scalar "$super_admin_sql")"
if [ -n "$super_admin_row" ]; then
  super_admin_exists=true
  super_admin_role="$(printf '%s' "$super_admin_row" | cut -d'|' -f2)"
  super_admin_active="$(printf '%s' "$super_admin_row" | cut -d'|' -f3)"
  super_admin_deleted_at="$(printf '%s' "$super_admin_row" | cut -d'|' -f4)"
else
  super_admin_exists=false
  super_admin_role=""
  super_admin_active="false"
  super_admin_deleted_at=""
fi

tmp_output="$(mktemp)"
cat > "$tmp_output" <<JSON
{
  "eventsCount": $events_count,
  "usersCount": $users_count,
  "eventMembersCount": $event_members_count,
  "eventTeamsCount": $event_teams_count,
  "analyticsEventsCount": $analytics_events_count,
  "requiredEvent": {
    "slug": "$(json_escape "$REQUIRED_PRODUCTION_EVENT_SLUG")",
    "exists": $required_event_exists,
    "status": "$(json_escape "$required_event_status")",
    "deletedAt": $(if [ -n "$required_event_deleted_at" ]; then printf '"%s"' "$(json_escape "$required_event_deleted_at")"; else printf 'null'; fi)
  },
  "superAdmin": {
    "email": "$(json_escape "$REQUIRED_SUPER_ADMIN_EMAIL")",
    "exists": $super_admin_exists,
    "role": "$(json_escape "$super_admin_role")",
    "isActive": $super_admin_active,
    "deletedAt": $(if [ -n "$super_admin_deleted_at" ]; then printf '"%s"' "$(json_escape "$super_admin_deleted_at")"; else printf 'null'; fi)
  }
}
JSON

if [ -n "$OUTPUT_FILE" ]; then
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  mv "$tmp_output" "$OUTPUT_FILE"
else
  cat "$tmp_output"
  rm -f "$tmp_output"
fi

FAILED=0

if [ "$required_event_exists" != "true" ]; then
  echo "Business health failed: required event is missing."
  FAILED=1
fi

if [ "$required_event_status" != "PUBLISHED" ] || [ -n "$required_event_deleted_at" ]; then
  echo "Business health failed: required event is not an active published event."
  FAILED=1
fi

if [ "$super_admin_exists" != "true" ] || [ "$super_admin_role" != "SUPER_ADMIN" ] || [ "$super_admin_active" != "true" ] || [ -n "$super_admin_deleted_at" ]; then
  echo "Business health failed: required super admin is missing, disabled, deleted, or has wrong role."
  FAILED=1
fi

if [ "$event_members_count" -lt "$MIN_EVENT_APPLICATIONS" ]; then
  echo "Business health failed: participant applications count is below $MIN_EVENT_APPLICATIONS."
  FAILED=1
fi

if [ "$event_teams_count" -lt "$MIN_EVENT_TEAMS" ]; then
  echo "Business health failed: event teams count is below $MIN_EVENT_TEAMS."
  FAILED=1
fi

if [ -n "$COMPARE_FILE" ] && [ -f "$COMPARE_FILE" ]; then
  before_members="$(json_number_get "$COMPARE_FILE" eventMembersCount)"
  before_teams="$(json_number_get "$COMPARE_FILE" eventTeamsCount)"

  if [ "${before_members:-0}" -gt 0 ] && [ "$event_members_count" -eq 0 ]; then
    echo "Business health failed: participant applications unexpectedly became 0."
    FAILED=1
  fi

  if [ "${before_teams:-0}" -gt 0 ] && [ "$event_teams_count" -eq 0 ]; then
    echo "Business health failed: event teams unexpectedly became 0."
    FAILED=1
  fi
fi

if [ "$SKIP_HTTP" != "true" ]; then
  curl -fsS https://api.rdevents.uz/api/events >/dev/null || FAILED=1
  curl -fsS https://rdevents.uz/ru/events >/dev/null || FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  if [ "${ALLOW_BUSINESS_CHECK_FAILURE:-false}" = "true" ]; then
    echo "WARNING: business health checks failed, but ALLOW_BUSINESS_CHECK_FAILURE=true."
  else
    exit 1
  fi
fi

echo "Business health checks passed"
