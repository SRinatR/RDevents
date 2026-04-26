#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"

STATE_FILE="$DEPLOY_ROOT/runtime/deploy-state.json"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_ROOT/.env"

json_get() {
  local json="$1"
  local key="$2"

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -er --arg key "$key" '.[$key] // empty' 2>/dev/null || true
    return 0
  fi

  printf '%s' "$json" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

fail() {
  echo "FAIL: $*"
  exit 1
}

assert_equal() {
  local label="$1"
  local actual="$2"
  local expected="$3"

  if [ "$actual" != "$expected" ]; then
    fail "$label mismatch: actual='$actual' expected='$expected'"
  fi

  echo "OK: $label = $actual"
}

read_plain_file() {
  local path="$1"
  [ -f "$path" ] || fail "missing file: $path"
  tr -d '\r\n' < "$path"
}

read_json_file_field() {
  local path="$1"
  local field="$2"
  [ -f "$path" ] || fail "missing file: $path"
  json_get "$(cat "$path")" "$field" | tr -d '\r\n'
}

container_status() {
  local service="$1"
  local cid status

  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  [ -n "$cid" ] || fail "$service container is missing"

  status="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)"
  assert_equal "$service container status" "$status" "running"
}

container_file_sha() {
  local service="$1"
  local path="$2"
  local label="$3"
  local actual

  actual="$(compose exec -T "$service" sh -lc "cat '$path'" 2>/dev/null | tr -d '\r\n')"
  [ -n "$actual" ] || fail "$label is empty or unreadable"
  assert_equal "$label" "$actual" "$RELEASE_SHA"
}

http_plain_sha() {
  local url="$1"
  local label="$2"
  local actual

  actual="$(curl --retry 5 --retry-delay 2 --retry-all-errors -fsS "$url?ts=$(date +%s)" | tr -d '\r\n')"
  assert_equal "$label" "$actual" "$RELEASE_SHA"
}

http_json_sha() {
  local url="$1"
  local label="$2"
  local body actual

  body="$(curl --retry 5 --retry-delay 2 --retry-all-errors -fsS "$url?ts=$(date +%s)")"
  actual="$(json_get "$body" releaseSha | tr -d '\r\n')"
  [ -n "$actual" ] || fail "$label did not expose releaseSha. Body: $body"
  assert_equal "$label" "$actual" "$RELEASE_SHA"
}

echo "Verifying production release from a fresh SSH session..."
echo "Expected RELEASE_SHA=$RELEASE_SHA"

[ -f "$STATE_FILE" ] || fail "deploy-state.json is missing"
STATE="$(cat "$STATE_FILE")"

STATE_RELEASE_SHA="$(json_get "$STATE" releaseSha | tr -d '\r\n')"
STATE_STATUS="$(json_get "$STATE" status | tr -d '\r\n')"
STATE_STAGE="$(json_get "$STATE" stage | tr -d '\r\n')"

assert_equal "deploy-state.releaseSha" "$STATE_RELEASE_SHA" "$RELEASE_SHA"
assert_equal "deploy-state.status" "$STATE_STATUS" "success"
assert_equal "deploy-state.stage" "$STATE_STAGE" "success"

assert_equal ".release-commit" "$(read_plain_file "$APP_DIR/.release-commit")" "$RELEASE_SHA"
assert_equal ".release-completed.releaseSha" "$(read_json_file_field "$APP_DIR/.release-completed" releaseSha)" "$RELEASE_SHA"
assert_equal "runtime/version.txt" "$(read_plain_file "$DEPLOY_ROOT/runtime/version.txt")" "$RELEASE_SHA"
assert_equal "runtime/version" "$(read_plain_file "$DEPLOY_ROOT/runtime/version")" "$RELEASE_SHA"
assert_equal "runtime/release.json.releaseSha" "$(read_json_file_field "$DEPLOY_ROOT/runtime/release.json" releaseSha)" "$RELEASE_SHA"

container_status api
container_status web
container_status report-worker
container_status email-broadcast-worker

container_file_sha api "/app/services/api/release.txt" "api release.txt"
container_file_sha web "/app/apps/web/public/version.txt" "web version.txt"
container_file_sha report-worker "/app/services/api/release.txt" "report-worker release.txt"
container_file_sha email-broadcast-worker "/app/services/api/release.txt" "email-broadcast-worker release.txt"

http_json_sha "https://api.rdevents.uz/release.json" "public API /release.json"
http_json_sha "https://rdevents.uz/release.json" "public WEB /release.json"
http_plain_sha "https://rdevents.uz/version.txt" "public WEB /version.txt"
http_plain_sha "https://api.rdevents.uz/version" "public API /version"

echo "Production release verification passed."
