#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ARCHIVE_NAME="${ARCHIVE_NAME:-deploy.tgz}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
ALLOW_DEPLOY_WITHOUT_BACKUP="${ALLOW_DEPLOY_WITHOUT_BACKUP:-false}"
STALE_DEPLOY_SECONDS="${STALE_DEPLOY_SECONDS:-900}"

case "$DEPLOY_ROOT" in
  /*) ;;
  *)
    echo "DEPLOY_ROOT must be an absolute path."
    exit 1
    ;;
esac

if [ "$APP_DIR" != "$DEPLOY_ROOT/app" ]; then
  echo "APP_DIR must be $DEPLOY_ROOT/app for production deploy safety."
  exit 1
fi

LOG_DIR="$DEPLOY_ROOT/deploy-logs"
RUNTIME_DIR="$DEPLOY_ROOT/runtime"
STATE_FILE="$RUNTIME_DIR/deploy-state.json"
LOCK_FILE="$RUNTIME_DIR/deploy.lock"
RELEASES_REGISTRY_FILE="$RUNTIME_DIR/releases.json"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_ROOT/.env"
MANIFEST_FILE=""
BACKUP_DIR=""
PREVIOUS_RELEASE_SHA=""
PREVIOUS_IMAGE_SOURCE=""

mkdir -p "$LOG_DIR" "$RUNTIME_DIR"

LOG_FILE="$LOG_DIR/deploy-$RELEASE_SHA-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

CURRENT_STAGE="init"
DEPLOY_SUCCESS=false

json_get() {
  local json="$1"
  local key="$2"

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -er "--arg" key "$key" '.[$key] // empty' 2>/dev/null || true
    return 0
  fi

  printf '%s' "$json" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

set_stage() {
  local stage="$1"
  local status="${2:-running}"

  CURRENT_STAGE="$stage"
  printf '{"releaseSha":"%s","status":"%s","stage":"%s","ts":"%s"}\n' \
    "$RELEASE_SHA" \
    "$status" \
    "$stage" \
    "$(date -u +%FT%TZ)" > "$STATE_FILE"
  echo "[STAGE] $stage -> $status"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

safe_release_tag() {
  printf '%s' "$1" | tr -cd 'A-Za-z0-9_.-' | cut -c1-128
}

get_running_image_id() {
  local service="$1"
  local cid

  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    return 0
  fi

  docker inspect "$cid" --format '{{.Image}}' 2>/dev/null || true
}

get_container_release_sha() {
  local service="$1"
  local path

  case "$service" in
    web)
      path="/app/apps/web/public/version.txt"
      ;;
    api|report-worker|email-broadcast-worker)
      path="/app/services/api/release.txt"
      ;;
    *)
      echo "Unknown service for release marker: $service" >&2
      return 1
      ;;
  esac

  compose exec -T "$service" sh -lc "cat '$path'" 2>/dev/null | tr -d '\r\n'
}

registry_get() {
  local expression="$1"

  if [ -f "$RELEASES_REGISTRY_FILE" ] && command -v jq >/dev/null 2>&1; then
    jq -er "$expression // empty" "$RELEASES_REGISTRY_FILE" 2>/dev/null || true
  fi
}

registry_release_complete() {
  local release_sha="$1"

  [ -n "$release_sha" ] || return 1
  [ -f "$RELEASES_REGISTRY_FILE" ] || return 1

  jq -e "--arg" releaseSha "$release_sha" '
    (.releases[$releaseSha].apiImageId // "") != "" and
    (.releases[$releaseSha].webImageId // "") != "" and
    (.releases[$releaseSha].reportWorkerImageId // "") != "" and
    (.releases[$releaseSha].emailBroadcastWorkerImageId // "") != ""
  ' "$RELEASES_REGISTRY_FILE" >/dev/null 2>&1
}

load_release_images_from_registry() {
  local release_sha="$1"

  API_IMAGE_ID_BEFORE="$(registry_get ".releases[\"$release_sha\"].apiImageId")"
  WEB_IMAGE_ID_BEFORE="$(registry_get ".releases[\"$release_sha\"].webImageId")"
  REPORT_WORKER_IMAGE_ID_BEFORE="$(registry_get ".releases[\"$release_sha\"].reportWorkerImageId")"
  EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE="$(registry_get ".releases[\"$release_sha\"].emailBroadcastWorkerImageId")"
}

release_images_exist() {
  local api_image_id="$1"
  local web_image_id="$2"
  local report_worker_image_id="$3"
  local email_broadcast_worker_image_id="$4"

  [ -n "$api_image_id" ] || return 1
  [ -n "$web_image_id" ] || return 1
  [ -n "$report_worker_image_id" ] || return 1
  [ -n "$email_broadcast_worker_image_id" ] || return 1

  docker image inspect "$api_image_id" >/dev/null 2>&1 &&
    docker image inspect "$web_image_id" >/dev/null 2>&1 &&
    docker image inspect "$report_worker_image_id" >/dev/null 2>&1 &&
    docker image inspect "$email_broadcast_worker_image_id" >/dev/null 2>&1
}

find_earliest_manifest_for_release() {
  local release_sha="$1"
  local release_backup_root="$DEPLOY_ROOT/backups/releases/$release_sha"

  [ -d "$release_backup_root" ] || return 0

  find "$release_backup_root" -mindepth 2 -maxdepth 2 -type f -name deploy-manifest.json 2>/dev/null |
    sort |
    head -1
}

recover_previous_images_from_manifest() {
  local manifest_file="$1"
  local recovered_previous recovered_api recovered_web recovered_report_worker recovered_email_broadcast_worker

  [ -n "$manifest_file" ] || return 1
  [ -f "$manifest_file" ] || return 1
  jq -e . "$manifest_file" >/dev/null 2>&1 || return 1

  recovered_previous="$(jq -r '.previousReleaseSha // empty' "$manifest_file")"
  recovered_api="$(jq -r '.apiImageIdBefore // empty' "$manifest_file")"
  recovered_web="$(jq -r '.webImageIdBefore // empty' "$manifest_file")"
  recovered_report_worker="$(jq -r '.reportWorkerImageIdBefore // empty' "$manifest_file")"
  recovered_email_broadcast_worker="$(jq -r '.emailBroadcastWorkerImageIdBefore // empty' "$manifest_file")"

  recovered_report_worker="${recovered_report_worker:-$recovered_api}"
  recovered_email_broadcast_worker="${recovered_email_broadcast_worker:-$recovered_api}"

  [ -n "$recovered_previous" ] || return 1
  release_images_exist "$recovered_api" "$recovered_web" "$recovered_report_worker" "$recovered_email_broadcast_worker" || return 1

  PREVIOUS_RELEASE_SHA="$recovered_previous"
  API_IMAGE_ID_BEFORE="$recovered_api"
  WEB_IMAGE_ID_BEFORE="$recovered_web"
  REPORT_WORKER_IMAGE_ID_BEFORE="$recovered_report_worker"
  EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE="$recovered_email_broadcast_worker"
  PREVIOUS_IMAGE_SOURCE="manifest:$manifest_file"
}

update_release_entry_only() {
  local release_sha="$1"
  local api_image_id="$2"
  local web_image_id="$3"
  local report_worker_image_id="$4"
  local email_broadcast_worker_image_id="$5"
  local updated_at tmp base_file

  command -v jq >/dev/null 2>&1 || {
    echo "ERROR: jq is required to update $RELEASES_REGISTRY_FILE"
    exit 1
  }

  updated_at="$(date -u +%FT%TZ)"
  tmp="$(mktemp)"
  base_file="$RELEASES_REGISTRY_FILE"

  if [ ! -f "$RELEASES_REGISTRY_FILE" ] || ! jq -e . "$RELEASES_REGISTRY_FILE" >/dev/null 2>&1; then
    base_file="$(mktemp)"
    printf '{"current":null,"previous":null,"updatedAt":null,"releases":{}}\n' > "$base_file"
  fi

  jq \
    "--arg" releaseSha "$release_sha" \
    "--arg" apiImageId "$api_image_id" \
    "--arg" webImageId "$web_image_id" \
    "--arg" reportWorkerImageId "$report_worker_image_id" \
    "--arg" emailBroadcastWorkerImageId "$email_broadcast_worker_image_id" \
    "--arg" updatedAt "$updated_at" \
    '
      .releases = (.releases // {}) |
      (.releases[$releaseSha] // {}) as $existing |
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

  mv "$tmp" "$RELEASES_REGISTRY_FILE"
  [ "$base_file" = "$RELEASES_REGISTRY_FILE" ] || rm -f "$base_file"
}

maybe_register_previous_release() {
  local reason="$1"

  [ -n "$PREVIOUS_RELEASE_SHA" ] || return 0
  [ -n "$API_IMAGE_ID_BEFORE" ] || return 0
  [ -n "$WEB_IMAGE_ID_BEFORE" ] || return 0

  REPORT_WORKER_IMAGE_ID_BEFORE="${REPORT_WORKER_IMAGE_ID_BEFORE:-$API_IMAGE_ID_BEFORE}"
  EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE="${EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE:-$API_IMAGE_ID_BEFORE}"

  if registry_release_complete "$PREVIOUS_RELEASE_SHA" && [ "${FORCE_UPDATE_PREVIOUS_RELEASE_IMAGES:-false}" != "true" ] && [ "$reason" != "manifest-recovery" ]; then
    echo "Preserving previous release registry entry for $PREVIOUS_RELEASE_SHA."
    return 0
  fi

  if release_images_exist "$API_IMAGE_ID_BEFORE" "$WEB_IMAGE_ID_BEFORE" "$REPORT_WORKER_IMAGE_ID_BEFORE" "$EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE"; then
    update_release_entry_only \
      "$PREVIOUS_RELEASE_SHA" \
      "$API_IMAGE_ID_BEFORE" \
      "$WEB_IMAGE_ID_BEFORE" \
      "$REPORT_WORKER_IMAGE_ID_BEFORE" \
      "$EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE"
    echo "Updated previous release registry entry for $PREVIOUS_RELEASE_SHA from $reason."
  else
    echo "WARNING: previous release image IDs for $PREVIOUS_RELEASE_SHA are incomplete or missing locally."
    echo "Not overwriting previous release registry entry."
  fi
}

determine_previous_release_images() {
  local registry_current registry_previous release_commit running_api_release running_web_release
  local running_report_worker_release running_email_broadcast_worker_release earliest_manifest
  local running_already_target=false

  registry_current="$(registry_get '.current')"
  registry_previous="$(registry_get '.previous')"
  release_commit=""
  if [ -f "$APP_DIR/.release-commit" ]; then
    release_commit="$(tr -d '\r\n' < "$APP_DIR/.release-commit")"
  fi

  running_api_release="$(get_container_release_sha api || true)"
  running_web_release="$(get_container_release_sha web || true)"
  running_report_worker_release="$(get_container_release_sha report-worker || true)"
  running_email_broadcast_worker_release="$(get_container_release_sha email-broadcast-worker || true)"

  echo "Registry current release SHA: ${registry_current:-none}"
  echo "Registry previous release SHA: ${registry_previous:-none}"
  echo "Release commit marker before deploy: ${release_commit:-none}"
  echo "Running API release marker: ${running_api_release:-unknown}"
  echo "Running Web release marker: ${running_web_release:-unknown}"
  echo "Running report-worker release marker: ${running_report_worker_release:-unknown}"
  echo "Running email-broadcast-worker release marker: ${running_email_broadcast_worker_release:-unknown}"

  if [ "$running_api_release" = "$RELEASE_SHA" ] && [ "$running_web_release" = "$RELEASE_SHA" ]; then
    running_already_target=true
  fi

  if [ "$running_already_target" = "true" ]; then
    echo "Detected rerun after containers already switched to target release."
    earliest_manifest="$(find_earliest_manifest_for_release "$RELEASE_SHA")"

    if recover_previous_images_from_manifest "$earliest_manifest"; then
      echo "Recovered previous image IDs from earliest manifest:"
      echo "manifest=$earliest_manifest"
      echo "previousReleaseSha=$PREVIOUS_RELEASE_SHA"
      echo "apiImageIdBefore=$API_IMAGE_ID_BEFORE"
      echo "webImageIdBefore=$WEB_IMAGE_ID_BEFORE"
      echo "reportWorkerImageIdBefore=$REPORT_WORKER_IMAGE_ID_BEFORE"
      echo "emailBroadcastWorkerImageIdBefore=$EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE"
      maybe_register_previous_release "manifest-recovery"
      return 0
    fi

    PREVIOUS_RELEASE_SHA=""
    if [ -n "$registry_current" ] && [ "$registry_current" != "$RELEASE_SHA" ]; then
      PREVIOUS_RELEASE_SHA="$registry_current"
    elif [ -n "$registry_previous" ] && [ "$registry_previous" != "$RELEASE_SHA" ]; then
      PREVIOUS_RELEASE_SHA="$registry_previous"
    fi

    if registry_release_complete "$PREVIOUS_RELEASE_SHA"; then
      load_release_images_from_registry "$PREVIOUS_RELEASE_SHA"
      PREVIOUS_IMAGE_SOURCE="registry-preserved"
      echo "Preserving previous release registry entry."
      echo "Previous release SHA: $PREVIOUS_RELEASE_SHA"
      echo "apiImageIdBefore=$API_IMAGE_ID_BEFORE"
      echo "webImageIdBefore=$WEB_IMAGE_ID_BEFORE"
      return 0
    fi

    echo "WARNING: running containers already match RELEASE_SHA, but no previous image mapping could be recovered."
    echo "Not overwriting previous release registry entry."
    PREVIOUS_IMAGE_SOURCE="unknown-rerun-target-running"
    return 0
  fi

  if [ -n "$running_api_release" ] && [ "$running_api_release" != "$RELEASE_SHA" ]; then
    PREVIOUS_RELEASE_SHA="$running_api_release"
  elif [ -n "$registry_current" ] && [ "$registry_current" != "$RELEASE_SHA" ]; then
    PREVIOUS_RELEASE_SHA="$registry_current"
  elif [ -n "$release_commit" ] && [ "$release_commit" != "$RELEASE_SHA" ]; then
    PREVIOUS_RELEASE_SHA="$release_commit"
  elif [ -n "$registry_previous" ] && [ "$registry_previous" != "$RELEASE_SHA" ]; then
    PREVIOUS_RELEASE_SHA="$registry_previous"
  fi

  API_IMAGE_ID_BEFORE="$(get_running_image_id api)"
  WEB_IMAGE_ID_BEFORE="$(get_running_image_id web)"
  REPORT_WORKER_IMAGE_ID_BEFORE="$(get_running_image_id report-worker)"
  EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE="$(get_running_image_id email-broadcast-worker)"
  PREVIOUS_IMAGE_SOURCE="running-containers"

  echo "Previous release SHA: ${PREVIOUS_RELEASE_SHA:-unknown}"
  echo "Captured previous image IDs from running containers."
  echo "API_IMAGE_ID_BEFORE=${API_IMAGE_ID_BEFORE:-}"
  echo "WEB_IMAGE_ID_BEFORE=${WEB_IMAGE_ID_BEFORE:-}"
  echo "REPORT_WORKER_IMAGE_ID_BEFORE=${REPORT_WORKER_IMAGE_ID_BEFORE:-}"
  echo "EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE=${EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE:-}"

  maybe_register_previous_release "running-containers"
}

update_release_registry() {
  local release_sha="$1"
  local api_image_id="$2"
  local web_image_id="$3"
  local report_worker_image_id="$4"
  local email_broadcast_worker_image_id="$5"
  local updated_at current_before previous_candidate tmp base_file

  command -v jq >/dev/null 2>&1 || {
    echo "ERROR: jq is required to update $RELEASES_REGISTRY_FILE"
    exit 1
  }

  updated_at="$(date -u +%FT%TZ)"
  current_before="$(jq -r '.current // empty' "$RELEASES_REGISTRY_FILE" 2>/dev/null || true)"
  previous_candidate="${PREVIOUS_RELEASE_SHA:-}"
  tmp="$(mktemp)"
  base_file="$RELEASES_REGISTRY_FILE"

  if [ ! -f "$RELEASES_REGISTRY_FILE" ] || ! jq -e . "$RELEASES_REGISTRY_FILE" >/dev/null 2>&1; then
    base_file="$(mktemp)"
    printf '{"current":null,"previous":null,"updatedAt":null,"releases":{}}\n' > "$base_file"
  fi

  jq \
    "--arg" releaseSha "$release_sha" \
    "--arg" currentBefore "$current_before" \
    "--arg" previousCandidate "$previous_candidate" \
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
        elif $previousCandidate != "" and $previousCandidate != $releaseSha
        then $previousCandidate
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

  mv "$tmp" "$RELEASES_REGISTRY_FILE"
  [ "$base_file" = "$RELEASES_REGISTRY_FILE" ] || rm -f "$base_file"
}

manifest_update() {
  [ -n "$MANIFEST_FILE" ] || return 0
  [ -f "$MANIFEST_FILE" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0

  local expression="$1"
  local tmp
  tmp="$(mktemp)"
  jq "$expression" "$MANIFEST_FILE" > "$tmp"
  mv "$tmp" "$MANIFEST_FILE"
}

manifest_set_restore_test_passed() {
  manifest_update '.restoreTestStatus = "PASSED" | .updatedAt = (now | todateiso8601) | .deployStatus = "RESTORE_TEST_PASSED"'
}

manifest_set_migration_started() {
  manifest_update '.migrationStarted = true | .updatedAt = (now | todateiso8601) | .deployStatus = "MIGRATION_RUNNING"'
}

manifest_set_migration_finished() {
  manifest_update '.migrationFinished = true | .updatedAt = (now | todateiso8601) | .deployStatus = "MIGRATION_FINISHED"'
}

manifest_set_services_healthy() {
  manifest_update '.servicesHealthy = true | .updatedAt = (now | todateiso8601) | .deployStatus = "SERVICES_HEALTHY"'
}

manifest_set_business_after() {
  local after_file="$1"
  [ -n "$MANIFEST_FILE" ] || return 0
  [ -f "$MANIFEST_FILE" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0

  local tmp
  tmp="$(mktemp)"
  jq "--arg" afterFile "$after_file" \
    '.businessHealthAfter = $afterFile | .updatedAt = (now | todateiso8601) | .deployStatus = "BUSINESS_HEALTH_PASSED"' \
    "$MANIFEST_FILE" > "$tmp"
  mv "$tmp" "$MANIFEST_FILE"
}

manifest_set_failed() {
  local failed_stage="$1"
  [ -n "$MANIFEST_FILE" ] || return 0
  [ -f "$MANIFEST_FILE" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0

  local tmp
  tmp="$(mktemp)"
  jq "--arg" failedStage "$failed_stage" \
    '.deployStatus = "FAILED" | .failedStage = $failedStage | .updatedAt = (now | todateiso8601)' \
    "$MANIFEST_FILE" > "$tmp" || return 0
  mv "$tmp" "$MANIFEST_FILE"
}

get_last_deploy_log() {
  ls -t "$LOG_DIR"/deploy-*.log 2>/dev/null | head -1 || true
}

dump_diagnostics() {
  local last_log
  last_log="$(get_last_deploy_log)"

  echo
  echo "========== DEPLOY DIAGNOSTICS =========="
  echo "TIMESTAMP=$(date -u +%FT%TZ)"
  echo "CURRENT_STAGE=$CURRENT_STAGE"
  echo "RELEASE_SHA=$RELEASE_SHA"
  echo "LAST_LOG_FILE=$last_log"
  echo ""

  if [ -f "$COMPOSE_FILE" ]; then
    echo "--- Docker Compose PS ---"
    compose ps 2>&1 || true
    echo ""
    echo "--- Docker Images (app-*) ---"
    docker images 'app-*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}' 2>&1 || true
    echo ""
    echo "--- Postgres Logs (last 40) ---"
    compose logs --tail=40 postgres 2>&1 || true
    echo ""
    echo "--- API Logs (last 80) ---"
    compose logs --tail=80 api 2>&1 || true
    echo ""
    echo "--- Web Logs (last 80) ---"
    compose logs --tail=80 web 2>&1 || true
    echo ""
    echo "--- Report Worker Logs (last 80) ---"
    compose logs --tail=80 report-worker 2>&1 || true
    echo ""
    echo "--- Email Broadcast Worker Logs (last 80) ---"
    compose logs --tail=80 email-broadcast-worker 2>&1 || true
    echo ""
  else
    echo "(compose file not available at $COMPOSE_FILE)"
    echo ""
  fi

  if [ -n "$last_log" ] && [ -f "$last_log" ]; then
    echo "--- Last 160 lines of deploy log ($last_log) ---"
    tail -160 "$last_log" 2>&1 || true
    echo ""
  fi

  echo "--- Nginx Error Log (last 40) ---"
  tail -40 /var/log/nginx/error.log 2>/dev/null || echo "(no nginx error log)"
  echo ""
  echo "--- Runtime state ---"
  cat "$STATE_FILE" 2>/dev/null || echo "(no state file)"
  echo ""
  echo "--- Embedded release markers ---"
  if [ -f "$COMPOSE_FILE" ]; then
    compose exec -T api sh -lc 'cat /app/services/api/release.txt' 2>/dev/null || echo "(cannot read api release.txt)"
    compose exec -T web sh -lc 'cat /app/apps/web/public/version.txt' 2>/dev/null || echo "(cannot read web version.txt)"
    compose exec -T report-worker sh -lc 'cat /app/services/api/release.txt' 2>/dev/null || echo "(cannot read report-worker release.txt)"
    compose exec -T email-broadcast-worker sh -lc 'cat /app/services/api/release.txt' 2>/dev/null || echo "(cannot read email-broadcast-worker release.txt)"
  fi
  echo ""
  echo "========================================"
}

on_exit() {
  local rc=$?
  trap - EXIT

  if [ "$DEPLOY_SUCCESS" != "true" ]; then
    if [ "$rc" -eq 0 ]; then
      rc=1
    fi

    set +e
    manifest_set_failed "$CURRENT_STAGE"
    set_stage "$CURRENT_STAGE" "failed"
    echo ""
    echo "========== DEPLOY FAILED =========="
    echo "Exit code: $rc"
    echo "Failed at stage: $CURRENT_STAGE"
    echo "==================================="
    dump_diagnostics
  fi

  exit "$rc"
}

trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mark_stale_running_state_if_needed() {
  [ -f "$STATE_FILE" ] || return 0

  local state previous_status previous_stage previous_sha previous_ts previous_epoch now age
  state="$(cat "$STATE_FILE" 2>/dev/null || true)"
  previous_status="$(json_get "$state" status)"
  previous_stage="$(json_get "$state" stage)"
  previous_sha="$(json_get "$state" releaseSha)"
  previous_ts="$(json_get "$state" ts)"

  [ "$previous_status" = "running" ] || return 0

  previous_epoch="$(date -u -d "$previous_ts" +%s 2>/dev/null || echo 0)"
  now="$(date -u +%s)"
  age=$((now - previous_epoch))

  if [ "$previous_epoch" -gt 0 ] && [ "$age" -gt "$STALE_DEPLOY_SECONDS" ]; then
    echo "WARNING: stale running deploy state detected: sha=$previous_sha stage=$previous_stage age=${age}s"
    printf '{"releaseSha":"%s","status":"failed","stage":"stale-running-state-detected","previousReleaseSha":"%s","previousStage":"%s","ts":"%s"}\n' \
      "$previous_sha" \
      "$previous_sha" \
      "$previous_stage" \
      "$(date -u +%FT%TZ)" > "$STATE_FILE"
    return 0
  fi

  CURRENT_STAGE="preflight-running-state-present"
  echo "ERROR: deploy-state.json says another deploy is running and it is not stale yet."
  echo "$state"
  exit 1
}

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

wait_for_postgres_healthy() {
  echo "Waiting for postgres to be healthy..."

  local postgres_cid health
  postgres_cid="$(compose ps -q postgres 2>/dev/null || true)"
  if [ -z "$postgres_cid" ]; then
    echo "Could not find postgres container ID."
    compose ps
    exit 1
  fi

  for i in $(seq 1 30); do
    health="$(docker inspect -f '{{.State.Health.Status}}' "$postgres_cid" 2>/dev/null || echo "unknown")"
    if [ "$health" = "healthy" ]; then
      echo "Postgres is healthy."
      return 0
    fi

    if [ "$i" -eq 30 ]; then
      echo "Postgres did not become healthy in time (last status: $health)."
      compose ps
      compose logs --tail=80 postgres
      exit 1
    fi

    echo "Waiting for postgres... ($i/30, status: $health)"
    sleep 2
  done
}

wait_for_service_healthy() {
  local service="$1"
  local timeout="${2:-180}"
  local cid elapsed status

  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    echo "Could not find container ID for service '$service'"
    return 1
  fi

  elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid" 2>/dev/null || echo unknown)"
    if [ "$status" = "healthy" ]; then
      echo "Service '$service' is healthy"
      return 0
    fi

    echo "Waiting for '$service' to become healthy... elapsed=${elapsed}s status=$status"
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "Service '$service' did not become healthy in ${timeout}s"
  return 1
}

wait_for_service_running() {
  local service="$1"
  local timeout="${2:-60}"
  local cid elapsed status

  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    echo "Could not find container ID for service '$service'"
    return 1
  fi

  elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    status="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)"
    if [ "$status" = "running" ]; then
      echo "Service '$service' is running"
      return 0
    fi

    if [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
      echo "Service '$service' stopped unexpectedly with status=$status"
      compose logs --tail=120 "$service" || true
      return 1
    fi

    echo "Waiting for '$service' to run... elapsed=${elapsed}s status=$status"
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "Service '$service' did not reach running status in ${timeout}s"
  compose logs --tail=120 "$service" || true
  return 1
}

verify_container_sha() {
  local service="$1"
  local path="$2"
  local label="$3"
  local actual

  actual="$(compose exec -T "$service" sh -lc "cat '$path'" 2>/dev/null | tr -d '\r\n')"

  if [ -z "$actual" ]; then
    echo "FAIL: $label release file is empty or unreadable: $path"
    return 1
  fi

  if [ "$actual" != "$RELEASE_SHA" ]; then
    echo "FAIL: $label container release is '$actual', expected '$RELEASE_SHA'."
    return 1
  fi

  echo "$actual"
}

verify_http_sha_plain() {
  local url="$1"
  local label="$2"
  local body_file err_file ret code body

  body_file="$(mktemp)"
  err_file="$(mktemp)"
  ret=1

  for attempt in $(seq 1 30); do
    code="$(curl -sS -o "$body_file" -w "%{http_code}" "$url?ts=$(date +%s)" 2>"$err_file" || true)"
    body="$(tr -d '\r\n' < "$body_file" 2>/dev/null || true)"

    if [ "$code" = "200" ] && [ "$body" = "$RELEASE_SHA" ]; then
      echo "OK: $label returned correct SHA: $body"
      ret=0
      break
    fi

    echo "Attempt $attempt/30: $label returned code=$code body='$body'"
    [ "$attempt" -lt 30 ] && sleep 2
  done

  if [ "$ret" -ne 0 ]; then
    echo "FAIL: $label did not return expected SHA '$RELEASE_SHA'."
    echo "Last code=$code body='$(tr -d '\r\n' < "$body_file" 2>/dev/null || true)'"
    echo "Last curl error: $(cat "$err_file" 2>/dev/null || true)"
  fi

  rm -f "$body_file" "$err_file"
  return "$ret"
}

verify_http_sha_json() {
  local url="$1"
  local label="$2"
  local body_file err_file ret code body extracted

  body_file="$(mktemp)"
  err_file="$(mktemp)"
  ret=1

  for attempt in $(seq 1 30); do
    code="$(curl -sS -o "$body_file" -w "%{http_code}" "$url?ts=$(date +%s)" 2>"$err_file" || true)"
    body="$(cat "$body_file" 2>/dev/null || true)"
    extracted="$(json_get "$body" releaseSha | tr -d '\r\n')"

    if [ "$code" = "200" ] && [ "$extracted" = "$RELEASE_SHA" ]; then
      echo "OK: $label returned correct releaseSha: $extracted"
      ret=0
      break
    fi

    echo "Attempt $attempt/30: $label returned code=$code releaseSha='$extracted'"
    [ "$attempt" -lt 30 ] && sleep 2
  done

  if [ "$ret" -ne 0 ]; then
    echo "FAIL: $label did not return expected releaseSha '$RELEASE_SHA'."
    echo "Last body: $(cat "$body_file" 2>/dev/null || true)"
    echo "Last curl error: $(cat "$err_file" 2>/dev/null || true)"
  fi

  rm -f "$body_file" "$err_file"
  return "$ret"
}

verify_html_release_meta() {
  local url="$1"
  local label="$2"
  local body_file err_file ret code extracted

  body_file="$(mktemp)"
  err_file="$(mktemp)"
  ret=1

  for attempt in $(seq 1 30); do
    code="$(curl -sS -o "$body_file" -w "%{http_code}" "$url?ts=$(date +%s)" 2>"$err_file" || true)"
    extracted="$(sed -n 's/.*app-release-sha" content="\([^"]*\)".*/\1/p' "$body_file" | tr -d '\r\n')"

    if [ "$code" = "200" ] && [ "$extracted" = "$RELEASE_SHA" ]; then
      echo "OK: $label HTML release marker = $extracted"
      ret=0
      break
    fi

    echo "Attempt $attempt/30: $label code=$code htmlRelease='$extracted'"
    [ "$attempt" -lt 30 ] && sleep 2
  done

  if [ "$ret" -ne 0 ]; then
    echo "FAIL: $label did not return expected HTML release marker '$RELEASE_SHA'."
    echo "Last body:"
    cat "$body_file" || true
    echo "Last curl error:"
    cat "$err_file" || true
  fi

  rm -f "$body_file" "$err_file"
  return "$ret"
}

check_ingress_status() {
  local url="$1"
  local expected="$2"
  local label="$3"
  local body_file err_file ret code

  body_file="$(mktemp)"
  err_file="$(mktemp)"
  ret=1

  for attempt in $(seq 1 30); do
    code="$(curl -sS -I -o "$body_file" -w "%{http_code}" "$url?ts=$(date +%s)" 2>"$err_file" || true)"

    if [ "$code" = "$expected" ]; then
      echo "OK: $label returned expected status $code"
      ret=0
      break
    fi

    echo "Attempt $attempt/30: $label returned code=$code, expected=$expected"
    [ "$attempt" -lt 30 ] && sleep 2
  done

  if [ "$ret" -ne 0 ]; then
    echo "FAIL: $label did not return expected status $expected"
    echo "Last response headers:"
    cat "$body_file" 2>/dev/null || true
    echo "Last curl error:"
    cat "$err_file" 2>/dev/null || true
  fi

  rm -f "$body_file" "$err_file"
  return "$ret"
}

verify_runtime_file() {
  local path="$1"
  local label="$2"
  local actual

  if [ ! -f "$path" ]; then
    echo "FAIL: $label is missing: $path"
    return 1
  fi

  actual="$(tr -d '\r\n' < "$path")"
  if [ "$actual" != "$RELEASE_SHA" ]; then
    echo "FAIL: $label contains '$actual', expected '$RELEASE_SHA'."
    return 1
  fi

  echo "OK: $label updated to $actual"
}

verify_running_image() {
  local service="$1"
  local expected="$2"
  local cid running

  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    echo "FAIL: $service container is missing"
    return 1
  fi

  running="$(docker inspect "$cid" --format '{{.Image}}')"
  echo "RUNNING_${service}_IMAGE_ID=$running"

  if [ "$running" != "$expected" ]; then
    echo "FAIL: $service container is not running the freshly built image"
    echo "expected=$expected actual=$running"
    return 1
  fi
}

run_backup() {
  CURRENT_STAGE="backup-before-migrate"
  set_stage "$CURRENT_STAGE"

  local backup_dir backup_file tmp_backup_file backup_start backup_end backup_duration backup_status
  backup_dir="$DEPLOY_ROOT/backups"
  mkdir -p "$backup_dir"

  backup_file="$backup_dir/pre-migrate-$(date +%Y%m%d-%H%M%S).sql.gz"
  tmp_backup_file="$backup_file.tmp"

  echo "Starting postgres backup with 120s timeout..."
  backup_start="$(date +%s)"

  export DEPLOY_ROOT APP_DIR tmp_backup_file

  set +e
  timeout 120s bash -o pipefail -c '
    cd "$APP_DIR" &&
    docker compose --env-file "$DEPLOY_ROOT/.env" -f docker-compose.prod.yml \
      exec -T postgres sh -lc '"'"'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'"'"' \
      | gzip > "$tmp_backup_file"
  '
  backup_status=$?
  set -e

  backup_end="$(date +%s)"
  backup_duration="$((backup_end - backup_start))"

  if [ "$backup_status" -ne 0 ]; then
    echo "ERROR: Backup failed with status=$backup_status after ${backup_duration}s"
    rm -f "$tmp_backup_file"
    if [ "$ALLOW_DEPLOY_WITHOUT_BACKUP" = "true" ]; then
      echo "WARNING: ALLOW_DEPLOY_WITHOUT_BACKUP=true, continuing without backup."
      return 0
    fi
    exit 1
  fi

  if [ ! -s "$tmp_backup_file" ]; then
    echo "ERROR: Backup file is empty"
    rm -f "$tmp_backup_file"
    if [ "$ALLOW_DEPLOY_WITHOUT_BACKUP" = "true" ]; then
      echo "WARNING: ALLOW_DEPLOY_WITHOUT_BACKUP=true, continuing without backup."
      return 0
    fi
    exit 1
  fi

  if ! gzip -t "$tmp_backup_file"; then
    echo "ERROR: Backup gzip integrity check failed"
    rm -f "$tmp_backup_file"
    if [ "$ALLOW_DEPLOY_WITHOUT_BACKUP" = "true" ]; then
      echo "WARNING: ALLOW_DEPLOY_WITHOUT_BACKUP=true, continuing without backup."
      return 0
    fi
    exit 1
  fi

  mv "$tmp_backup_file" "$backup_file"
  echo "Backup written to $backup_file ($(du -sh "$backup_file" | cut -f1)) in ${backup_duration}s"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deploy is already running."
  exit 1
fi

mark_stale_running_state_if_needed

set_stage "$CURRENT_STAGE"

determine_previous_release_images

if [ -n "$PREVIOUS_RELEASE_SHA" ] && [ -n "$API_IMAGE_ID_BEFORE" ] && [ -n "$WEB_IMAGE_ID_BEFORE" ]; then
  SAFE_PREVIOUS_TAG="$(safe_release_tag "$PREVIOUS_RELEASE_SHA")"
  if [ -n "$SAFE_PREVIOUS_TAG" ]; then
    docker tag "$API_IMAGE_ID_BEFORE" "app-api:$SAFE_PREVIOUS_TAG" || true
    docker tag "$WEB_IMAGE_ID_BEFORE" "app-web:$SAFE_PREVIOUS_TAG" || true
  fi
fi

mkdir -p "$APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

tar -xzf "$DEPLOY_ROOT/$ARCHIVE_NAME" -C "$APP_DIR"
rm -f "$DEPLOY_ROOT/$ARCHIVE_NAME"

cd "$APP_DIR"

echo "Release SHA: $RELEASE_SHA"
export RELEASE_SHA

CURRENT_STAGE="build-images"
set_stage "$CURRENT_STAGE"

SKIP_BUILD=false
if [ -f "$RUNTIME_DIR/images-built-$RELEASE_SHA.json" ]; then
  echo "Found images-built marker for $RELEASE_SHA"
  STORED_SHA="$(json_get "$(cat "$RUNTIME_DIR/images-built-$RELEASE_SHA.json")" releaseSha)"
  if [ "$STORED_SHA" = "$RELEASE_SHA" ]; then
    echo "Images already built for this release SHA. Checking if images exist locally..."
    if docker image inspect app-api:latest >/dev/null 2>&1 && \
       docker image inspect app-web:latest >/dev/null 2>&1; then
      echo "Images found locally. Skipping build phase."
      SKIP_BUILD=true
    else
      echo "Images not found locally. Proceeding with build."
    fi
  fi
fi

if [ "$SKIP_BUILD" = "true" ]; then
  echo "Skipping docker compose build (recovery mode)"
  EXPECTED_API_IMAGE_ID="$(json_get "$(cat "$RUNTIME_DIR/images-built-$RELEASE_SHA.json")" apiImageId)"
  EXPECTED_WEB_IMAGE_ID="$(json_get "$(cat "$RUNTIME_DIR/images-built-$RELEASE_SHA.json")" webImageId)"
  echo "Recovered EXPECTED_API_IMAGE_ID=$EXPECTED_API_IMAGE_ID"
  echo "Recovered EXPECTED_WEB_IMAGE_ID=$EXPECTED_WEB_IMAGE_ID"

  if [ -z "$EXPECTED_API_IMAGE_ID" ] || [ -z "$EXPECTED_WEB_IMAGE_ID" ]; then
    echo "ERROR: cannot recover image IDs from $RUNTIME_DIR/images-built-$RELEASE_SHA.json"
    exit 1
  fi
else
  compose build api web report-worker email-broadcast-worker

  CURRENT_STAGE="capture-built-image-ids"
  set_stage "$CURRENT_STAGE"

  EXPECTED_API_IMAGE_ID="$(docker image inspect app-api:latest --format '{{.Id}}')"
  EXPECTED_WEB_IMAGE_ID="$(docker image inspect app-web:latest --format '{{.Id}}')"

  echo "EXPECTED_API_IMAGE_ID=$EXPECTED_API_IMAGE_ID"
  echo "EXPECTED_WEB_IMAGE_ID=$EXPECTED_WEB_IMAGE_ID"

  test -n "$EXPECTED_API_IMAGE_ID"
  test -n "$EXPECTED_WEB_IMAGE_ID"

  printf '{"releaseSha":"%s","imagesBuilt":true,"apiImageId":"%s","webImageId":"%s","builtAt":"%s"}\n' \
    "$RELEASE_SHA" \
    "$EXPECTED_API_IMAGE_ID" \
    "$EXPECTED_WEB_IMAGE_ID" \
    "$(date -u +%FT%TZ)" > "$RUNTIME_DIR/images-built-$RELEASE_SHA.json"

  echo "Image build marker written for recovery"
fi

EXPECTED_REPORT_WORKER_IMAGE_ID="$EXPECTED_API_IMAGE_ID"
EXPECTED_EMAIL_BROADCAST_WORKER_IMAGE_ID="$EXPECTED_API_IMAGE_ID"

SAFE_RELEASE_TAG="$(safe_release_tag "$RELEASE_SHA")"
if [ -n "$SAFE_RELEASE_TAG" ]; then
  docker tag "$EXPECTED_API_IMAGE_ID" "app-api:$SAFE_RELEASE_TAG" || true
  docker tag "$EXPECTED_WEB_IMAGE_ID" "app-web:$SAFE_RELEASE_TAG" || true
fi

echo "Images built for release SHA=$RELEASE_SHA"

CURRENT_STAGE="images-ready"
set_stage "$CURRENT_STAGE"

compose up -d postgres
wait_for_postgres_healthy

CURRENT_STAGE="create-predeploy-backup-package"
set_stage "$CURRENT_STAGE"
BACKUP_DIR="$(
  RELEASE_SHA="$RELEASE_SHA" \
  PREVIOUS_RELEASE_SHA="$PREVIOUS_RELEASE_SHA" \
  DEPLOY_ROOT="$DEPLOY_ROOT" \
  APP_DIR="$APP_DIR" \
  ENV_FILE="$ENV_FILE" \
  COMPOSE_FILE="$COMPOSE_FILE" \
  API_IMAGE_ID_BEFORE="$API_IMAGE_ID_BEFORE" \
  WEB_IMAGE_ID_BEFORE="$WEB_IMAGE_ID_BEFORE" \
  REPORT_WORKER_IMAGE_ID_BEFORE="$REPORT_WORKER_IMAGE_ID_BEFORE" \
  EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE="$EMAIL_BROADCAST_WORKER_IMAGE_ID_BEFORE" \
  API_IMAGE_ID_AFTER="$EXPECTED_API_IMAGE_ID" \
  WEB_IMAGE_ID_AFTER="$EXPECTED_WEB_IMAGE_ID" \
  REPORT_WORKER_IMAGE_ID_AFTER="$EXPECTED_REPORT_WORKER_IMAGE_ID" \
  EMAIL_BROADCAST_WORKER_IMAGE_ID_AFTER="$EXPECTED_EMAIL_BROADCAST_WORKER_IMAGE_ID" \
  bash "$APP_DIR/ops/create-predeploy-backup.sh"
)"
MANIFEST_FILE="$BACKUP_DIR/deploy-manifest.json"
echo "Backup package created at: $BACKUP_DIR"

CURRENT_STAGE="restore-test-backup"
set_stage "$CURRENT_STAGE"
bash "$APP_DIR/ops/test-db-backup-restore.sh" "$BACKUP_DIR/db.sql.gz" "$BACKUP_DIR/restore-test.log"
manifest_set_restore_test_passed
echo "DB backup restore test passed."

echo "Checking DATABASE_URL in production env..."
if ! grep -Eq '^DATABASE_URL=.*@postgres:5432/' "$ENV_FILE" 2>/dev/null; then
  echo "ERROR: production DATABASE_URL must use host 'postgres:5432' inside docker-compose network."
  echo "This is required because Prisma connects from inside the api container, where 'postgres' resolves to the DB service."
  echo "Current DATABASE_URL:"
  grep '^DATABASE_URL=' "$ENV_FILE" || true
  echo "Example of correct production DATABASE_URL:"
  echo "  postgresql://event_platform_user:event_platform_password@postgres:5432/event_platform?schema=public"
  exit 1
fi

CURRENT_STAGE="migrate"
set_stage "$CURRENT_STAGE"
manifest_set_migration_started

compose run --rm --no-deps --entrypoint sh api -lc 'cd /app/services/api && pnpm exec prisma migrate deploy'
manifest_set_migration_finished

echo "Skipping mock cleanup in production deploy."

CURRENT_STAGE="recreate-api-web-report-worker"
set_stage "$CURRENT_STAGE"

compose up -d --force-recreate --remove-orphans api web report-worker email-broadcast-worker

CURRENT_STAGE="wait-api-healthy"
set_stage "$CURRENT_STAGE"
wait_for_service_healthy api 180

CURRENT_STAGE="wait-web-healthy"
set_stage "$CURRENT_STAGE"
wait_for_service_healthy web 240

CURRENT_STAGE="wait-report-worker-healthy"
set_stage "$CURRENT_STAGE"
wait_for_service_healthy report-worker 90

CURRENT_STAGE="wait-email-broadcast-worker-healthy"
set_stage "$CURRENT_STAGE"
wait_for_service_healthy email-broadcast-worker 90
manifest_set_services_healthy

CURRENT_STAGE="verify-running-image-ids"
set_stage "$CURRENT_STAGE"

verify_running_image api "$EXPECTED_API_IMAGE_ID"
verify_running_image web "$EXPECTED_WEB_IMAGE_ID"
verify_running_image report-worker "$EXPECTED_REPORT_WORKER_IMAGE_ID"
verify_running_image email-broadcast-worker "$EXPECTED_EMAIL_BROADCAST_WORKER_IMAGE_ID"

CURRENT_STAGE="host-install"
set_stage "$CURRENT_STAGE"

run_privileged mkdir -p "$RUNTIME_DIR"
run_privileged mkdir -p "$RUNTIME_DIR/reports"
run_privileged mkdir -p /var/log/rdevents
run_privileged mkdir -p "$DEPLOY_ROOT/ops"
run_privileged rsync -a --delete "$APP_DIR/ops/" "$DEPLOY_ROOT/ops/"
run_privileged chmod +x "$DEPLOY_ROOT/ops/"*.sh
run_privileged cp "$APP_DIR/systemd/rdevents-backup.service" /etc/systemd/system/
run_privileged cp "$APP_DIR/systemd/rdevents-backup.timer" /etc/systemd/system/
run_privileged systemctl daemon-reload
run_privileged systemctl enable --now rdevents-backup.timer
run_privileged systemctl is-enabled rdevents-backup.timer
run_privileged systemctl is-active rdevents-backup.timer
SCHEDULED_BACKUP_STARTED_AT="$(date +%s)"
run_privileged systemctl start rdevents-backup.service
LATEST_SCHEDULED_BACKUP="$(
  find "$DEPLOY_ROOT/backups/releases" -path '*/scheduled-*/*/deploy-manifest.json' -type f -printf '%T@ %p\n' 2>/dev/null |
    sort -n |
    tail -1 |
    cut -d' ' -f2-
)"
if [ -z "$LATEST_SCHEDULED_BACKUP" ] || [ "$(stat -c %Y "$LATEST_SCHEDULED_BACKUP" 2>/dev/null || echo 0)" -lt "$SCHEDULED_BACKUP_STARTED_AT" ]; then
  echo "ERROR: manual scheduled backup test did not create a fresh backup manifest."
  exit 1
fi
echo "Scheduled backup timer verified; manual backup manifest: $LATEST_SCHEDULED_BACKUP"

CURRENT_STAGE="local-verification"
set_stage "$CURRENT_STAGE"

FAILED=0

API_CONTAINER_SHA="$(verify_container_sha api "/app/services/api/release.txt" "API")" || FAILED=1
WEB_CONTAINER_SHA="$(verify_container_sha web "/app/apps/web/public/version.txt" "Web")" || FAILED=1
REPORT_WORKER_CONTAINER_SHA="$(verify_container_sha report-worker "/app/services/api/release.txt" "Report worker")" || FAILED=1
EMAIL_BROADCAST_WORKER_CONTAINER_SHA="$(verify_container_sha email-broadcast-worker "/app/services/api/release.txt" "Email broadcast worker")" || FAILED=1

if [ "$FAILED" -eq 0 ] && [ "$API_CONTAINER_SHA" != "$WEB_CONTAINER_SHA" ]; then
  echo "FAIL: API and Web container SHAs differ: api='$API_CONTAINER_SHA', web='$WEB_CONTAINER_SHA'"
  FAILED=1
fi

if [ "$FAILED" -eq 0 ] && [ "$API_CONTAINER_SHA" != "$REPORT_WORKER_CONTAINER_SHA" ]; then
  echo "FAIL: API and report-worker container SHAs differ: api='$API_CONTAINER_SHA', report-worker='$REPORT_WORKER_CONTAINER_SHA'"
  FAILED=1
fi

if [ "$FAILED" -eq 0 ] && [ "$API_CONTAINER_SHA" != "$EMAIL_BROADCAST_WORKER_CONTAINER_SHA" ]; then
  echo "FAIL: API and email-broadcast-worker container SHAs differ: api='$API_CONTAINER_SHA', email-broadcast-worker='$EMAIL_BROADCAST_WORKER_CONTAINER_SHA'"
  FAILED=1
fi

verify_http_sha_plain "http://127.0.0.1:4000/version" "API local /version" || FAILED=1
verify_http_sha_plain "http://127.0.0.1:4000/api/version" "API local /api/version" || FAILED=1
verify_http_sha_plain "http://127.0.0.1:3000/version.txt" "Web local /version.txt" || FAILED=1
verify_http_sha_json "http://127.0.0.1:4000/release.json" "API local /release.json" || FAILED=1
verify_http_sha_json "http://127.0.0.1:3000/release.json" "Web local /release.json" || FAILED=1
verify_html_release_meta "http://127.0.0.1:3000/ru" "Web local /ru" || FAILED=1

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "=========================================="
  echo "DEPLOYMENT FAILED: Local SHA verification failed."
  echo "Expected RELEASE_SHA: $RELEASE_SHA"
  echo "=========================================="
  compose ps
  compose logs --tail=120 api
  compose logs --tail=120 web
  compose logs --tail=120 report-worker
  compose logs --tail=120 email-broadcast-worker
  exit 1
fi

CURRENT_STAGE="sync-runtime-fallback"
set_stage "$CURRENT_STAGE"

printf '%s\n' "$RELEASE_SHA" > "$RUNTIME_DIR/version.txt"
printf '%s\n' "$RELEASE_SHA" > "$RUNTIME_DIR/version"
printf '{"service":"event-platform-web","releaseSha":"%s"}\n' "$RELEASE_SHA" > "$RUNTIME_DIR/release.json"

verify_runtime_file "$RUNTIME_DIR/version.txt" "Runtime version.txt" || FAILED=1
verify_runtime_file "$RUNTIME_DIR/version" "Runtime version" || FAILED=1
RUNTIME_RELEASE_JSON_SHA="$(json_get "$(cat "$RUNTIME_DIR/release.json")" releaseSha | tr -d '\r\n')"
if [ "$RUNTIME_RELEASE_JSON_SHA" != "$RELEASE_SHA" ]; then
  echo "FAIL: Runtime release.json contains releaseSha='$RUNTIME_RELEASE_JSON_SHA', expected '$RELEASE_SHA'."
  FAILED=1
else
  echo "OK: Runtime release.json updated to $RUNTIME_RELEASE_JSON_SHA"
fi

CURRENT_STAGE="reload-nginx"
set_stage "$CURRENT_STAGE"

run_privileged nginx -t || FAILED=1
run_privileged systemctl reload nginx || FAILED=1

CURRENT_STAGE="public-verification"
set_stage "$CURRENT_STAGE"

check_ingress_status "https://rdevents.uz/" "307" "Public root" || FAILED=1
check_ingress_status "https://rdevents.uz/ru" "200" "Public /ru" || FAILED=1
check_ingress_status "https://rdevents.uz/ru/events" "200" "Public /ru/events" || FAILED=1
check_ingress_status "https://api.rdevents.uz/health" "200" "Public API /health" || FAILED=1
verify_http_sha_json "https://api.rdevents.uz/release.json" "API public /release.json" || FAILED=1
verify_http_sha_json "https://rdevents.uz/release.json" "Web public /release.json" || FAILED=1
verify_html_release_meta "https://rdevents.uz/ru" "Web public /ru" || FAILED=1
verify_http_sha_plain "http://127.0.0.1:3000/version.txt" "Required check: Web local /version.txt" || FAILED=1
verify_http_sha_plain "http://127.0.0.1:4000/version" "Required check: API local /version" || FAILED=1
verify_http_sha_plain "https://rdevents.uz/version.txt" "Required check: Web public /version.txt" || FAILED=1
verify_http_sha_plain "https://api.rdevents.uz/version" "Required check: API public /version" || FAILED=1
BUSINESS_BASELINE_AFTER="$BACKUP_DIR/business-baseline-after.json"
bash "$APP_DIR/ops/check-production-business-health.sh" \
  --output "$BUSINESS_BASELINE_AFTER" \
  --compare "$BACKUP_DIR/business-baseline-before.json" || {
  if [ "${ALLOW_BUSINESS_CHECK_FAILURE:-false}" != "true" ]; then
    FAILED=1
  fi
}
if [ -f "$BUSINESS_BASELINE_AFTER" ]; then
  manifest_set_business_after "$BUSINESS_BASELINE_AFTER"
fi

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "=========================================="
  echo "DEPLOYMENT FAILED: Release marker verification failed."
  echo "Expected RELEASE_SHA: $RELEASE_SHA"
  echo "=========================================="
  compose ps
  compose logs --tail=120 api
  compose logs --tail=120 web
  compose logs --tail=120 report-worker
  compose logs --tail=120 email-broadcast-worker
  tail -120 /var/log/nginx/error.log 2>/dev/null || true
  exit 1
fi

CURRENT_STAGE="finalize-success"
set_stage "$CURRENT_STAGE"

printf '%s\n' "$RELEASE_SHA" > "$APP_DIR/.release-commit"
printf '{"releaseSha":"%s","imagesBuilt":true,"deployedAt":"%s"}\n' \
  "$RELEASE_SHA" \
  "$(date -u +%FT%TZ)" > "$RUNTIME_DIR/release-$RELEASE_SHA.json"
printf '{"releaseSha":"%s","completedAt":"%s"}\n' \
  "$RELEASE_SHA" \
  "$(date -u +%FT%TZ)" > "$APP_DIR/.release-completed"

update_release_registry \
  "$RELEASE_SHA" \
  "$EXPECTED_API_IMAGE_ID" \
  "$EXPECTED_WEB_IMAGE_ID" \
  "$EXPECTED_REPORT_WORKER_IMAGE_ID" \
  "$EXPECTED_EMAIL_BROADCAST_WORKER_IMAGE_ID"
manifest_update '.deployStatus = "SUCCESS" | .failedStage = null | .updatedAt = (now | todateiso8601)'

DEPLOY_SUCCESS=true
set_stage "success" "success"

echo ""
echo "=========================================="
echo "DEPLOYMENT SUCCESS: All containers, worker, markers, and public endpoints are on the correct release."
echo "Release SHA: $RELEASE_SHA"
echo "=========================================="

echo "Skipping docker image prune to preserve locally registered rollback images."
compose ps
