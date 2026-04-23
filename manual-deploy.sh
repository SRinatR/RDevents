#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# manual-deploy.sh
#
# Final unified safe manual production deploy for RDevents
#
# Usage:
#   /opt/rdevents/manual-deploy.sh
#   /opt/rdevents/manual-deploy.sh production
#   REPO_URL=git@github.com:SRinatR/RDevents.git /opt/rdevents/manual-deploy.sh main
###############################################################################

TARGET_REF="${1:-${TARGET_REF:-production}}"

# ---- Config -----------------------------------------------------------------
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RUNTIME_DIR="${RUNTIME_DIR:-$DEPLOY_ROOT/runtime}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_ROOT/backups}"
SOURCE_CACHE_DIR="${SOURCE_CACHE_DIR:-$DEPLOY_ROOT/source-cache}"

REPO_URL="${REPO_URL:-git@github.com:SRinatR/RDevents.git}"

COMPOSE_FILE_NAME="${COMPOSE_FILE_NAME:-docker-compose.prod.yml}"
CURRENT_COMPOSE_FILE="${APP_DIR}/${COMPOSE_FILE_NAME}"

NGINX_TEST_CMD="${NGINX_TEST_CMD:-nginx -t}"
NGINX_RELOAD_CMD="${NGINX_RELOAD_CMD:-systemctl reload nginx}"

LOCAL_WEB_VERSION_URL="${LOCAL_WEB_VERSION_URL:-http://127.0.0.1:3000/version.txt}"
LOCAL_WEB_RELEASE_JSON_URL="${LOCAL_WEB_RELEASE_JSON_URL:-http://127.0.0.1:3000/release.json}"
LOCAL_API_VERSION_URL="${LOCAL_API_VERSION_URL:-http://127.0.0.1:4000/version}"

PUBLIC_WEB_VERSION_URL="${PUBLIC_WEB_VERSION_URL:-https://rdevents.uz/version.txt}"
PUBLIC_WEB_RELEASE_JSON_URL="${PUBLIC_WEB_RELEASE_JSON_URL:-https://rdevents.uz/release.json}"
PUBLIC_API_VERSION_URL="${PUBLIC_API_VERSION_URL:-https://api.rdevents.uz/version}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/manual-pre-redeploy-${TIMESTAMP}.sql.gz"

STAGING_DIR=""
RELEASE_SHA=""

# ---- Logging ----------------------------------------------------------------
log() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

# ---- Cleanup ----------------------------------------------------------------
cleanup() {
  local exit_code=$?
  if [[ -n "${STAGING_DIR}" && -d "${STAGING_DIR}" ]]; then
    rm -rf "${STAGING_DIR}" 2>/dev/null || true
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

# ---- Preconditions -----------------------------------------------------------
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_cmd git
require_cmd gzip
require_cmd curl
require_cmd docker
require_cmd sed
require_cmd mktemp

mkdir -p "${DEPLOY_ROOT}" "${APP_DIR}" "${BACKUP_DIR}" "${RUNTIME_DIR}" "${SOURCE_CACHE_DIR}"

[[ -f "${ENV_FILE}" ]] || fail "Missing env file: ${ENV_FILE}"
[[ -f "${CURRENT_COMPOSE_FILE}" ]] || fail "Missing current compose file: ${CURRENT_COMPOSE_FILE}"

# ---- Helpers ----------------------------------------------------------------
run_privileged() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${APP_DIR}/${COMPOSE_FILE_NAME}" "$@"
}

print_remote_identity() {
  log "Remote host identity"
  printf 'hostname: %s\n' "$(hostname)"
  printf 'hostname -I: %s\n' "$(hostname -I 2>/dev/null || true)"
  printf 'user: %s\n' "$(whoami)"
  printf 'pwd: %s\n' "$(pwd)"
}

wait_for_service() {
  local service="$1"
  local timeout_seconds="${2:-120}"
  local cid=""
  local started_at
  started_at="$(date +%s)"

  cid="$(compose ps -q "${service}" 2>/dev/null || true)"
  [[ -n "${cid}" ]] || fail "Could not resolve container id for service: ${service}"

  while true; do
    local now elapsed health status
    now="$(date +%s)"
    elapsed=$(( now - started_at ))

    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "${cid}" 2>/dev/null || true)"
    status="$(docker inspect -f '{{.State.Status}}' "${cid}" 2>/dev/null || true)"

    if [[ "${health}" == "healthy" ]]; then
      log "Service ${service} is healthy."
      return 0
    fi

    if [[ "${health}" == "no-healthcheck" && "${status}" == "running" ]]; then
      log "Service ${service} is running (no healthcheck)."
      return 0
    fi

    if (( elapsed >= timeout_seconds )); then
      compose ps || true
      compose logs --tail=120 "${service}" || true
      fail "Service ${service} did not become ready in ${timeout_seconds}s (health=${health}, status=${status})."
    fi

    sleep 2
  done
}

fetch_plain_url() {
  local url="$1"
  curl -fsS "${url}" | tr -d '\r\n'
}

fetch_release_json_sha() {
  local url="$1"
  curl -fsS "${url}" | sed -n 's/.*"releaseSha":"\([^"]*\)".*/\1/p' | tr -d '\r\n'
}

fetch_html_release_meta() {
  local url="$1"
  curl -fsS "${url}" | sed -n 's/.*app-release-sha" content="\([^"]*\)".*/\1/p' | tr -d '\r\n'
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local label="$3"

  if [[ "${actual}" != "${expected}" ]]; then
    fail "${label}: expected '${expected}', got '${actual}'"
  fi

  log "OK: ${label} = ${actual}"
}

verify_runtime_plain_file() {
  local path="$1"
  local label="$2"

  [[ -f "${path}" ]] || fail "${label} is missing: ${path}"

  local actual
  actual="$(tr -d '\r\n' < "${path}")"
  assert_eq "${actual}" "${RELEASE_SHA}" "${label}"
}

verify_runtime_release_json_file() {
  local path="$1"
  local label="$2"

  [[ -f "${path}" ]] || fail "${label} is missing: ${path}"

  local actual
  actual="$(sed -n 's/.*"releaseSha":"\([^"]*\)".*/\1/p' "${path}" | tr -d '\r\n')"
  assert_eq "${actual}" "${RELEASE_SHA}" "${label}"
}

# ---- Deploy -----------------------------------------------------------------
log "Starting manual deploy"
print_remote_identity
log "Target ref: ${TARGET_REF}"
log "Repo URL: ${REPO_URL}"

STAGING_DIR="$(mktemp -d "${SOURCE_CACHE_DIR}/release-XXXXXX")"

log "1) Clone target ref into staging"
git clone --depth 1 --branch "${TARGET_REF}" "${REPO_URL}" "${STAGING_DIR}"

RELEASE_SHA="$(git -C "${STAGING_DIR}" rev-parse HEAD)"
[[ -n "${RELEASE_SHA}" ]] || fail "Could not resolve release SHA"
export RELEASE_SHA

log "Resolved RELEASE_SHA=${RELEASE_SHA}"

log "2) Ensure postgres is up before backup"
compose up -d postgres
wait_for_service postgres 120

log "3) Backup database"
compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "${BACKUP_FILE}"
[[ -s "${BACKUP_FILE}" ]] || fail "Backup file is empty: ${BACKUP_FILE}"
log "Backup written: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"

log "4) Replace application source"
find "${APP_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "${STAGING_DIR}/." "${APP_DIR}/"
rm -rf "${APP_DIR}/.git"

[[ -f "${APP_DIR}/${COMPOSE_FILE_NAME}" ]] || fail "Deployed source is missing ${COMPOSE_FILE_NAME}"

cd "${APP_DIR}"

log "5) Build fresh images"
compose build api web

log "6) Start postgres again from deployed source and wait"
compose up -d postgres
wait_for_service postgres 120

log "7) Run migrations"
compose run --rm --no-deps --entrypoint sh api -lc 'cd /app/services/api && pnpm exec prisma migrate deploy'

log "8) Recreate api and web"
compose up -d --force-recreate --remove-orphans api web

wait_for_service api 180
wait_for_service web 180

log "9) Verify container release files"
API_CONTAINER_SHA="$(compose exec -T api sh -lc 'cat /app/services/api/release.txt' | tr -d '\r\n')"
WEB_CONTAINER_SHA="$(compose exec -T web sh -lc 'cat /app/apps/web/public/version.txt' | tr -d '\r\n')"

assert_eq "${API_CONTAINER_SHA}" "${RELEASE_SHA}" "API container release.txt"
assert_eq "${WEB_CONTAINER_SHA}" "${RELEASE_SHA}" "Web container version.txt"

log "10) Verify localhost endpoints"
LOCAL_API_SHA="$(fetch_plain_url "${LOCAL_API_VERSION_URL}")"
LOCAL_WEB_SHA="$(fetch_plain_url "${LOCAL_WEB_VERSION_URL}")"
LOCAL_WEB_JSON_SHA="$(fetch_release_json_sha "${LOCAL_WEB_RELEASE_JSON_URL}")"
LOCAL_API_JSON_SHA="$(fetch_release_json_sha "http://127.0.0.1:4000/release.json")"
LOCAL_WEB_HTML_SHA="$(fetch_html_release_meta "http://127.0.0.1:3000/ru")"

assert_eq "${LOCAL_API_SHA}" "${RELEASE_SHA}" "Local API /version"
assert_eq "${LOCAL_WEB_SHA}" "${RELEASE_SHA}" "Local Web /version.txt"
assert_eq "${LOCAL_WEB_JSON_SHA}" "${RELEASE_SHA}" "Local Web /release.json"
assert_eq "${LOCAL_API_JSON_SHA}" "${RELEASE_SHA}" "Local API /release.json"
assert_eq "${LOCAL_WEB_HTML_SHA}" "${RELEASE_SHA}" "Local Web /ru HTML marker"

log "11) Update runtime files"
printf '%s\n' "${RELEASE_SHA}" > "${RUNTIME_DIR}/version.txt"
printf '%s\n' "${RELEASE_SHA}" > "${RUNTIME_DIR}/version"
printf '{"service":"event-platform-web","releaseSha":"%s"}\n' "${RELEASE_SHA}" > "${RUNTIME_DIR}/release.json"

verify_runtime_plain_file "${RUNTIME_DIR}/version.txt" "Runtime version.txt"
verify_runtime_plain_file "${RUNTIME_DIR}/version" "Runtime version"
verify_runtime_release_json_file "${RUNTIME_DIR}/release.json" "Runtime release.json"

log "12) Test and reload nginx"
run_privileged bash -lc "${NGINX_TEST_CMD}"
run_privileged bash -lc "${NGINX_RELOAD_CMD}"

log "13) Verify public endpoints"
PUBLIC_WEB_SHA="$(fetch_plain_url "${PUBLIC_WEB_VERSION_URL}")"
PUBLIC_API_SHA="$(fetch_plain_url "${PUBLIC_API_VERSION_URL}")"
PUBLIC_WEB_JSON_SHA="$(fetch_release_json_sha "${PUBLIC_WEB_RELEASE_JSON_URL}")"
PUBLIC_API_JSON_SHA="$(fetch_release_json_sha "https://api.rdevents.uz/release.json")"
PUBLIC_WEB_HTML_SHA="$(fetch_html_release_meta "https://rdevents.uz/ru")"

assert_eq "${PUBLIC_WEB_SHA}" "${RELEASE_SHA}" "Public Web /version.txt"
assert_eq "${PUBLIC_API_SHA}" "${RELEASE_SHA}" "Public API /version"
assert_eq "${PUBLIC_WEB_JSON_SHA}" "${RELEASE_SHA}" "Public Web /release.json"
assert_eq "${PUBLIC_API_JSON_SHA}" "${RELEASE_SHA}" "Public API /release.json"
assert_eq "${PUBLIC_WEB_HTML_SHA}" "${RELEASE_SHA}" "Public Web /ru HTML marker"

log "14) Persist deployed release marker"
printf '%s\n' "${RELEASE_SHA}" > "${APP_DIR}/.release-commit"

log "15) Final compose status"
compose ps

log "16) Prune dangling images"
docker image prune -f

log "DEPLOY SUCCESS"
printf 'Release SHA: %s\n' "${RELEASE_SHA}"
printf 'App marker: %s\n' "${APP_DIR}/.release-commit"
printf 'Runtime dir: %s\n' "${RUNTIME_DIR}"
printf 'Backup file: %s\n' "${BACKUP_FILE}"