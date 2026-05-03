#!/usr/bin/env bash
set -euo pipefail

TO_RELEASE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --to-release)
      TO_RELEASE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

[ -n "$TO_RELEASE" ] || { echo "--to-release required"; exit 1; }

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
RUNTIME_DIR="${RUNTIME_DIR:-$DEPLOY_ROOT/runtime}"
LOG_DIR="${LOG_DIR:-$DEPLOY_ROOT/deploy-logs}"
REGISTRY_FILE="${REGISTRY_FILE:-$RUNTIME_DIR/releases.json}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$RUNTIME_DIR/deploy.lock}"
ROLLBACK_LOCK_FILE="${ROLLBACK_LOCK_FILE:-$RUNTIME_DIR/rollback.lock}"
API_LOCAL_URL="${API_LOCAL_URL:-http://127.0.0.1:4000}"
WEB_LOCAL_URL="${WEB_LOCAL_URL:-http://127.0.0.1:3000}"
API_PUBLIC_URL="${API_PUBLIC_URL:-https://api.rdevents.uz}"
WEB_PUBLIC_URL="${WEB_PUBLIC_URL:-https://rdevents.uz}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="${OPS_DIR:-$SCRIPT_DIR}"

mkdir -p "$LOG_DIR" "$RUNTIME_DIR"
LOG_FILE="$LOG_DIR/rollback-code-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command is missing: $1"
    exit 1
  }
}

require_cmd docker
require_cmd jq
require_cmd curl
require_cmd flock

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

json_get_release_field() {
  local field="$1"
  jq -er "--arg" release "$TO_RELEASE" "--arg" field "$field" \
    '.releases[$release][$field] // empty' "$REGISTRY_FILE"
}

safe_release_tag() {
  printf '%s' "$1" | tr -cd 'A-Za-z0-9_.-' | cut -c1-128
}

verify_image_exists() {
  local service="$1"
  local image_id="$2"

  if ! docker image inspect "$image_id" >/dev/null 2>&1; then
    echo "Target release $TO_RELEASE exists in registry, but image $image_id is missing locally."
    echo "Code rollback aborted before changing running services."
    exit 1
  fi

  echo "OK: target image for $service exists: $image_id"
}

verify_running_image() {
  local service="$1"
  local expected="$2"
  local cid running

  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    echo "FAIL: $service container is missing after rollback"
    return 1
  fi

  running="$(docker inspect "$cid" --format '{{.Image}}')"
  echo "RUNNING_${service}_IMAGE_ID=$running"

  if [ "$running" != "$expected" ]; then
    echo "FAIL: $service is running image '$running', expected '$expected'"
    return 1
  fi
}

verify_plain_marker() {
  local url="$1"
  local label="$2"
  local body

  for attempt in $(seq 1 30); do
    body="$(curl -fsS "${url}?ts=$(date +%s)" 2>/dev/null | tr -d '\r\n' || true)"
    if [ "$body" = "$TO_RELEASE" ]; then
      echo "OK: $label returned $body"
      return 0
    fi

    echo "Attempt $attempt/30: $label returned '$body'"
    sleep 2
  done

  echo "FAIL: $label did not return expected release '$TO_RELEASE'"
  return 1
}

verify_json_marker() {
  local url="$1"
  local label="$2"
  local body extracted

  for attempt in $(seq 1 30); do
    body="$(curl -fsS "${url}?ts=$(date +%s)" 2>/dev/null || true)"
    extracted="$(printf '%s' "$body" | sed -n 's/.*"releaseSha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | tr -d '\r\n')"
    if [ "$extracted" = "$TO_RELEASE" ]; then
      echo "OK: $label returned releaseSha=$extracted"
      return 0
    fi

    echo "Attempt $attempt/30: $label returned releaseSha='$extracted'"
    sleep 2
  done

  echo "FAIL: $label did not return expected releaseSha '$TO_RELEASE'"
  return 1
}

verify_html_marker() {
  local url="$1"
  local label="$2"
  local body extracted

  for attempt in $(seq 1 30); do
    body="$(curl -fsS "${url}?ts=$(date +%s)" 2>/dev/null || true)"
    extracted="$(printf '%s' "$body" | sed -n 's/.*app-release-sha" content="\([^"]*\)".*/\1/p' | tr -d '\r\n')"
    if [ "$extracted" = "$TO_RELEASE" ]; then
      echo "OK: $label HTML release marker=$extracted"
      return 0
    fi

    echo "Attempt $attempt/30: $label returned htmlRelease='$extracted'"
    sleep 2
  done

  echo "FAIL: $label did not return expected HTML release marker '$TO_RELEASE'"
  return 1
}

update_release_registry() {
  local release_sha="$1"
  local api_image_id="$2"
  local web_image_id="$3"
  local report_worker_image_id="$4"
  local email_broadcast_worker_image_id="$5"
  local updated_at current_before tmp base_file

  updated_at="$(date -u +%FT%TZ)"
  current_before="$(jq -r '.current // empty' "$REGISTRY_FILE" 2>/dev/null || true)"
  tmp="$(mktemp)"
  base_file="$REGISTRY_FILE"

  if [ ! -f "$REGISTRY_FILE" ] || ! jq -e . "$REGISTRY_FILE" >/dev/null 2>&1; then
    base_file="$(mktemp)"
    printf '{"current":null,"previous":null,"updatedAt":null,"releases":{}}\n' > "$base_file"
  fi

  jq \
    "--arg" releaseSha "$release_sha" \
    "--arg" currentBefore "$current_before" \
    "--arg" apiImageId "$api_image_id" \
    "--arg" webImageId "$web_image_id" \
    "--arg" reportWorkerImageId "$report_worker_image_id" \
    "--arg" emailBroadcastWorkerImageId "$email_broadcast_worker_image_id" \
    "--arg" updatedAt "$updated_at" \
    '
      .releases = (.releases // {}) |
      (.releases[$releaseSha] // {}) as $existing |
      .previous = (
        if $currentBefore != "" and $currentBefore != $releaseSha
        then $currentBefore
        else (.previous // null)
        end
      ) |
      .current = $releaseSha |
      .updatedAt = $updatedAt |
      .releases[$releaseSha] = {
        releaseSha: $releaseSha,
        apiImageId: $apiImageId,
        webImageId: $webImageId,
        reportWorkerImageId: $reportWorkerImageId,
        emailBroadcastWorkerImageId: $emailBroadcastWorkerImageId,
        createdAt: ($existing.createdAt // $updatedAt)
      }
    ' "$base_file" > "$tmp"

  mv "$tmp" "$REGISTRY_FILE"
  [ "$base_file" = "$REGISTRY_FILE" ] || rm -f "$base_file"
}

if [ "${ROLLBACK_LOCK_HELD:-false}" != "true" ]; then
  exec 8>"$DEPLOY_LOCK_FILE"
  if ! flock -n 8; then
    echo "Another deploy is running. Rollback cannot start."
    exit 1
  fi
  echo "Acquired deploy coordination lock: $DEPLOY_LOCK_FILE"

  exec 9>"$ROLLBACK_LOCK_FILE"
  if ! flock -n 9; then
    echo "Another rollback is running."
    exit 1
  fi
  echo "Acquired rollback lock: $ROLLBACK_LOCK_FILE"
fi

[ -f "$REGISTRY_FILE" ] || {
  echo "Release registry is missing: $REGISTRY_FILE"
  exit 1
}

jq -e . "$REGISTRY_FILE" >/dev/null
if ! jq -e "--arg" release "$TO_RELEASE" '.releases[$release] != null' "$REGISTRY_FILE" >/dev/null; then
  echo "Target release $TO_RELEASE was not found in $REGISTRY_FILE"
  exit 1
fi

API_IMAGE_ID="$(json_get_release_field apiImageId)"
WEB_IMAGE_ID="$(json_get_release_field webImageId)"
REPORT_WORKER_IMAGE_ID="$(json_get_release_field reportWorkerImageId)"
EMAIL_BROADCAST_WORKER_IMAGE_ID="$(json_get_release_field emailBroadcastWorkerImageId)"

[ -n "$API_IMAGE_ID" ] || { echo "Target release $TO_RELEASE is missing apiImageId"; exit 1; }
[ -n "$WEB_IMAGE_ID" ] || { echo "Target release $TO_RELEASE is missing webImageId"; exit 1; }
[ -n "$REPORT_WORKER_IMAGE_ID" ] || { echo "Target release $TO_RELEASE is missing reportWorkerImageId"; exit 1; }
[ -n "$EMAIL_BROADCAST_WORKER_IMAGE_ID" ] || { echo "Target release $TO_RELEASE is missing emailBroadcastWorkerImageId"; exit 1; }

verify_image_exists api "$API_IMAGE_ID"
verify_image_exists web "$WEB_IMAGE_ID"
verify_image_exists report-worker "$REPORT_WORKER_IMAGE_ID"
verify_image_exists email-broadcast-worker "$EMAIL_BROADCAST_WORKER_IMAGE_ID"

SAFE_TAG="$(safe_release_tag "$TO_RELEASE")"

echo "Retagging target release images as compose latest tags..."
docker tag "$API_IMAGE_ID" app-api:latest
docker tag "$WEB_IMAGE_ID" app-web:latest
if [ -n "$SAFE_TAG" ]; then
  docker tag "$API_IMAGE_ID" "app-api:$SAFE_TAG" || true
  docker tag "$WEB_IMAGE_ID" "app-web:$SAFE_TAG" || true
fi

export RELEASE_SHA="$TO_RELEASE"
echo "Recreating application services for release $TO_RELEASE..."
compose up -d --force-recreate api web report-worker email-broadcast-worker

FAILED=0
verify_running_image api "$API_IMAGE_ID" || FAILED=1
verify_running_image web "$WEB_IMAGE_ID" || FAILED=1
verify_running_image report-worker "$REPORT_WORKER_IMAGE_ID" || FAILED=1
verify_running_image email-broadcast-worker "$EMAIL_BROADCAST_WORKER_IMAGE_ID" || FAILED=1

verify_plain_marker "${API_LOCAL_URL%/}/version" "API local /version" || FAILED=1
verify_plain_marker "${API_LOCAL_URL%/}/api/version" "API local /api/version" || FAILED=1
verify_json_marker "${API_LOCAL_URL%/}/release.json" "API local /release.json" || FAILED=1
verify_plain_marker "${WEB_LOCAL_URL%/}/version.txt" "Web local /version.txt" || FAILED=1
verify_json_marker "${WEB_LOCAL_URL%/}/release.json" "Web local /release.json" || FAILED=1
verify_html_marker "${WEB_LOCAL_URL%/}/ru" "Web local HTML release marker" || FAILED=1

verify_plain_marker "${API_PUBLIC_URL%/}/version" "API public /version" || FAILED=1
verify_plain_marker "${API_PUBLIC_URL%/}/api/version" "API public /api/version" || FAILED=1
verify_json_marker "${API_PUBLIC_URL%/}/release.json" "API public /release.json" || FAILED=1
verify_plain_marker "${WEB_PUBLIC_URL%/}/version.txt" "Web public /version.txt" || FAILED=1
verify_json_marker "${WEB_PUBLIC_URL%/}/release.json" "Web public /release.json" || FAILED=1
verify_html_marker "${WEB_PUBLIC_URL%/}/ru" "Web public HTML release marker" || FAILED=1

if [ "$FAILED" -ne 0 ]; then
  echo "Code rollback failed verification. Release registry was not changed."
  compose ps || true
  compose logs --tail=120 api web report-worker email-broadcast-worker || true
  exit 1
fi

printf '%s\n' "$TO_RELEASE" > "$APP_DIR/.release-commit"
printf '%s\n' "$TO_RELEASE" > "$RUNTIME_DIR/version.txt"
printf '%s\n' "$TO_RELEASE" > "$RUNTIME_DIR/version"
printf '{"service":"event-platform-web","releaseSha":"%s"}\n' "$TO_RELEASE" > "$RUNTIME_DIR/release.json"

bash "$OPS_DIR/check-production-business-health.sh"

update_release_registry \
  "$TO_RELEASE" \
  "$API_IMAGE_ID" \
  "$WEB_IMAGE_ID" \
  "$REPORT_WORKER_IMAGE_ID" \
  "$EMAIL_BROADCAST_WORKER_IMAGE_ID"

echo "Code rollback completed to $TO_RELEASE"
echo "Rollback log: $LOG_FILE"
