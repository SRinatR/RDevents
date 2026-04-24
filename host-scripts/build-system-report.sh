#!/bin/bash
# =============================================================================
# RDEvents System Report Generator
# =============================================================================
# Guarantees:
# - flock for preventing parallel executions
# - Atomic writes via temp files + mv
# - Best-effort sections: failures are logged, not fatal
# - Old report preserved on failure
# - trap ERR for guaranteed failure path
# - Works from cold start (no pre-existing files)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="/opt/rdevents/runtime"
ADMIN_DIR="$RUNTIME_DIR/admin"
CONTROL_DIR="$RUNTIME_DIR/control"
LOG_DIR="/var/log/rdevents"
LOCK_FILE="/var/lock/rdevents-system-report.lock"

STATUS_FILE="$ADMIN_DIR/system-report-status.json"
META_FILE="$ADMIN_DIR/system-report-meta.json"
REPORT_FILE="$ADMIN_DIR/system-report.txt"
REQUEST_FILE="$CONTROL_DIR/system-report-refresh-request.json"

# ─── Cleanup on exit (both success and failure) ────────────────────────────

FINAL_STATUS=""
FINAL_FINISHED_AT=""
FINAL_ERROR=""
FINAL_LAST_SUCCESS=""
INSIDE_LOCK=0

cleanup_on_exit() {
  rm -f "$ADMIN_DIR/.status.tmp.$$" \
        "$ADMIN_DIR/.meta.tmp.$$" \
        "$ADMIN_DIR/.report.tmp.$$" \
        "$ADMIN_DIR"/*.tmp.* 2>/dev/null || true

  if [ "$INSIDE_LOCK" -eq 1 ] && [ -n "$FINAL_STATUS" ]; then
    local tmp_status="$ADMIN_DIR/.exit_status.tmp.$$"
    jq -n \
      --arg state "$FINAL_STATUS" \
      --arg finished "$FINAL_FINISHED_AT" \
      --arg error "$FINAL_ERROR" \
      --arg last_success "$FINAL_LAST_SUCCESS" \
      --arg rid "$REQUEST_ID" \
      --arg rat "$REQUEST_AT" \
      --arg rbu "$REQUEST_BY_USER" \
      --arg rbe "$REQUEST_BY_EMAIL" \
      --arg sat "$STARTED_AT" \
      '{
        state: $state,
        requestId: (if ($rid | length) > 0 then $rid else null end),
        requestedAt: (if ($rat | length) > 0 then $rat else null end),
        requestedByUserId: (if ($rbu | length) > 0 then $rbu else null end),
        requestedByEmail: (if ($rbe | length) > 0 then $rbe else null end),
        startedAt: (if ($sat | length) > 0 then $sat else null end),
        finishedAt: (if ($finished | length) > 0 and $finished != "null" then $finished else null end),
        lastSuccessAt: (if ($last_success | length) > 0 and $last_success != "null" then $last_success else null end),
        lastError: (if ($error | length) > 0 and $error != "null" then $error else null end)
      }' > "$tmp_status"

    if [ -f "$tmp_status" ]; then
      mv -f "$tmp_status" "$STATUS_FILE"
    fi

    rm -f "$REQUEST_FILE" 2>/dev/null || true
  fi
}

trap cleanup_on_exit EXIT

# ─── ERR trap: guaranteed failure path ────────────────────────────────────

on_error() {
  local exit_code=$?
  echo "$(date -Iseconds) [ERROR] Script failed with exit code $exit_code" >> "$LOG_DIR/system-report.log"

  if [ "$REPORT_GENERATED" = "yes" ]; then
    FINAL_STATUS="failed"
    FINAL_FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    FINAL_ERROR="Script exited with code $exit_code"
    FINAL_LAST_SUCCESS="$LAST_SUCCESS"
  else
    FINAL_STATUS="failed"
    FINAL_FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    FINAL_ERROR="Script exited with code $exit_code before report generation"
    FINAL_LAST_SUCCESS="$LAST_SUCCESS"
  fi
}
trap on_error ERR

# ─── Globals ───────────────────────────────────────────────────────────────

REQUEST_ID=""
REQUEST_BY_USER=""
REQUEST_BY_EMAIL=""
REQUEST_AT=""
STARTED_AT=""
LAST_SUCCESS=""
REPORT_GENERATED="no"

# ─── Redaction helper ──────────────────────────────────────────────────────
# Must be available before init so CI self-test does not touch /opt or /var.

redact_secrets() {
  sed -E \
    -e 's#(DATABASE_URL=)[^&]*#\1[REDACTED]#g' \
    -e 's#(JWT_[A-Z_]*=)[^&]*#\1[REDACTED]#g' \
    -e 's#(RESEND_API_KEY=)[^&]*#\1[REDACTED]#g' \
    -e 's#(TOKEN=)[^&]*#\1[REDACTED]#g' \
    -e 's#(SECRET=)[^&]*#\1[REDACTED]#g' \
    -e 's#(PASSWORD=)[^&]*#\1[REDACTED]#g' \
    -e 's#(POSTGRES_PASSWORD=)[^&]*#\1[REDACTED]#g' \
    -e 's#(POSTGRES_USER=)[^&]*#\1[REDACTED]#g' \
    -e 's|(# vault:)[^|]*|\1[REDACTED]|g'
}

if [ "${1:-}" = "--self-test-redaction" ]; then
  printf '%s\n' \
    'DATABASE_URL=postgres://secret' \
    '# vault:secret|ok' \
    'JWT_TOKEN=abc123' \
    'RESEND_API_KEY=re_123' \
    'POSTGRES_PASSWORD=supersecret' \
    | redact_secrets
  exit 0
fi

# ─── Init ─────────────────────────────────────────────────────────────────

mkdir -p "$ADMIN_DIR" "$CONTROL_DIR" "$LOG_DIR" "$(dirname "$LOCK_FILE")"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$(date -Iseconds) [ERROR] Missing required command: $1" >> "$LOG_DIR/system-report.log"
    return 1
  fi
}

# ─── Core dependency preflight (jq/flock required for control flow) ────────
# Must check these BEFORE using jq or flock anywhere in the script.

missing_core=""
command -v jq >/dev/null 2>&1 || missing_core="${missing_core}${missing_core:+, }jq"
command -v flock >/dev/null 2>&1 || missing_core="${missing_core}${missing_core:+, }flock"

if [ -n "$missing_core" ]; then
  echo "$(date -Iseconds) [ERROR] Missing core dependencies: $missing_core" >> "$LOG_DIR/system-report.log"

  if [ -f "$REQUEST_FILE" ]; then
    finished="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    tmp_status="$ADMIN_DIR/.preflight_failed.tmp.$$"

    printf '{\n' > "$tmp_status"
    printf '  "state": "failed",\n' >> "$tmp_status"
    printf '  "requestId": null,\n' >> "$tmp_status"
    printf '  "requestedAt": null,\n' >> "$tmp_status"
    printf '  "requestedByUserId": null,\n' >> "$tmp_status"
    printf '  "requestedByEmail": null,\n' >> "$tmp_status"
    printf '  "startedAt": null,\n' >> "$tmp_status"
    printf '  "finishedAt": "%s",\n' "$finished" >> "$tmp_status"
    printf '  "lastSuccessAt": null,\n' >> "$tmp_status"
    printf '  "lastError": "Missing core dependencies: %s"\n' "$missing_core" >> "$tmp_status"
    printf '}\n' >> "$tmp_status"

    mv -f "$tmp_status" "$STATUS_FILE" 2>/dev/null || true
    rm -f "$REQUEST_FILE" 2>/dev/null || true
  fi

  exit 1
fi

if [ ! -f "$REQUEST_FILE" ]; then
  echo "$(date -Iseconds) [INFO] No request file found. Exiting." >> "$LOG_DIR/system-report.log"
  exit 0
fi

REQUEST_ID=$(jq -r '.requestId // empty' "$REQUEST_FILE" 2>/dev/null || echo "")
REQUEST_BY_USER=$(jq -r '.requestedByUserId // empty' "$REQUEST_FILE" 2>/dev/null || echo "")
REQUEST_BY_EMAIL=$(jq -r '.requestedByEmail // empty' "$REQUEST_FILE" 2>/dev/null || echo "")
REQUEST_AT=$(jq -r '.requestedAt // empty' "$REQUEST_FILE" 2>/dev/null || echo "")

if [ -f "$STATUS_FILE" ]; then
  LAST_SUCCESS=$(jq -r '.lastSuccessAt // empty' "$STATUS_FILE" 2>/dev/null || echo "")
fi

STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ─── Acquire lock ─────────────────────────────────────────────────────────

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "$(date -Iseconds) [INFO] Another instance is running. Exiting." >> "$LOG_DIR/system-report.log"
  exit 0
fi
INSIDE_LOCK=1

echo "$(date -Iseconds) [INFO] Acquired lock. Starting report. requestId=$REQUEST_ID by=$REQUEST_BY_EMAIL" >> "$LOG_DIR/system-report.log"

# ─── Write running status ───────────────────────────────────────────────────

write_status() {
  local state="$1"
  local tmp_status="$ADMIN_DIR/.status.running.$$"
  jq -n \
    --arg state "$state" \
    --arg rid "$REQUEST_ID" \
    --arg rat "$REQUEST_AT" \
    --arg rbu "$REQUEST_BY_USER" \
    --arg rbe "$REQUEST_BY_EMAIL" \
    --arg sat "$STARTED_AT" \
    --arg ls "$LAST_SUCCESS" \
    '{
      state: $state,
      requestId: (if ($rid | length) > 0 then $rid else null end),
      requestedAt: (if ($rat | length) > 0 then $rat else null end),
      requestedByUserId: (if ($rbu | length) > 0 then $rbu else null end),
      requestedByEmail: (if ($rbe | length) > 0 then $rbe else null end),
      startedAt: (if ($sat | length) > 0 then $sat else null end),
      finishedAt: null,
      lastSuccessAt: (if ($ls | length) > 0 and $ls != "null" then $ls else null end),
      lastError: null
    }' > "$tmp_status"
  mv -f "$tmp_status" "$STATUS_FILE"
}

write_status "running"

# ─── Dependency checks (after lock acquired, so ERR trap works) ────────────

check_deps() {
  local missing=""
  for cmd in docker curl sha256sum; do
    if ! require_cmd "$cmd"; then
      missing="${missing}${missing:+, }$cmd"
    fi
  done

  if ! docker compose version >/dev/null 2>&1; then
    missing="${missing}${missing:+, }docker compose"
  fi

  if [ -n "$missing" ]; then
    echo "$(date -Iseconds) [ERROR] Missing dependencies: $missing" >> "$LOG_DIR/system-report.log"
    return 1
  fi
  return 0
}

if ! check_deps; then
  FINAL_STATUS="failed"
  FINAL_FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  FINAL_ERROR="Missing required dependencies"
  FINAL_LAST_SUCCESS="$LAST_SUCCESS"
  exit 1
fi

# ─── Generate report (best-effort) ─────────────────────────────────────────

report_content=""

generate_report() {
  local ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local content=""

  content+="================================================================================"$'\n'
  content+="RDEvents System Diagnostic Report"$'\n'
  content+="Generated: $ts UTC"$'\n'
  content+="RequestId: ${REQUEST_ID:-none}"$'\n'
  content+="================================================================================"$'\n'
  content+=$'\n'
  content+="[environment]"$'\n'
  content+="generated_at_utc=$ts"$'\n'
  content+="hostname=$(hostname 2>/dev/null || echo unknown)"$'\n'
  content+="host_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo unknown)"$'\n'
  content+="whoami=$(whoami 2>/dev/null || echo unknown)"$'\n'
  content+="pwd=$(pwd 2>/dev/null || echo unknown)"$'\n'
  content+="date=$(date 2>/dev/null || echo unknown)"$'\n'
  content+="uptime=$(uptime -p 2>/dev/null || uptime 2>/dev/null || echo unknown)"$'\n'
  content+="uname=$(uname -a 2>/dev/null || echo unknown)"$'\n'
  content+=$'\n'

  capture() {
    local label="$1"; shift
    local cmd="$*"
    local result
    local exit_code=0
    result=$(eval "$cmd" 2>&1) || exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "[ERROR:$label] $(echo "$result" | head -c 200)" >> "$LOG_DIR/system-report.log"
      echo "## $label: ERROR — $exit_code"$'\n'
      echo "$result" | head -3 | sed 's/^/  /'
      echo "---"
    else
      echo "$result"
    fi
  }

  content+=$'\n'"[app_release_commit]"$'\n'
  content+=$(capture "release" "cat '$APP_DIR/app/.release-commit' 2>/dev/null || echo '# file not found'")$'\n'

  content+=$'\n'"[runtime_version]"$'\n'
  content+=$(capture "version_txt" "cat '$RUNTIME_DIR/version.txt' 2>/dev/null || echo '# not found'")$'\n'
  content+=$(capture "release_json" "cat '$RUNTIME_DIR/release.json' 2>/dev/null || echo '# not found'" | redact_secrets)$'\n'

  content+=$'\n'"[compose_ps]"$'\n'
  content+=$(capture "compose" "docker compose --env-file '$APP_DIR/.env' -f '$APP_DIR/app/docker-compose.prod.yml' ps -a 2>&1 | head -50 || echo '# docker compose not available'" | redact_secrets)$'\n'

  content+=$'\n'"[local_endpoint_checks]"$'\n'
  for url in \
    "http://127.0.0.1:3000/release.json" \
    "http://127.0.0.1:3000/version.txt" \
    "http://127.0.0.1:4000/health" \
    "http://127.0.0.1:4000/ready" \
    "http://127.0.0.1:4000/version"; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")
    content+="  $url -> $code"$'\n'
  done

  content+=$'\n'"[public_endpoint_checks]"$'\n'
  for url in \
    "https://rdevents.uz/release.json" \
    "https://rdevents.uz/version.txt" \
    "https://api.rdevents.uz/health" \
    "https://api.rdevents.uz/ready" \
    "https://api.rdevents.uz/version"; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")
    content+="  $url -> $code"$'\n'
  done

  content+=$'\n'"[ports]"$'\n'
  content+=$(capture "ports" "ss -ltnp 2>/dev/null | grep -E ':80 |:443 |:3000 |:4000 ' | head -30 || netstat -ltnp 2>/dev/null | head -20 || echo '# ss/netstat not available'")$'\n'

  content+=$'\n'"[disk_usage]"$'\n'
  content+=$(capture "disk" "df -h / 2>/dev/null | tail -1")$'\n'

  content+=$'\n'"[memory]"$'\n'
  content+=$(capture "mem" "free -h 2>/dev/null || echo '# not available'")$'\n'

  content+=$'\n'"================================================================================"$'\n'
  content+="End of Report"$'\n'
  content+="================================================================================"$'\n'

  echo "$content"
}

report_content=$(generate_report)

if [ -z "$report_content" ] || [ $(printf '%s' "$report_content" | wc -c) -lt 100 ]; then
  echo "$(date -Iseconds) [ERROR] Report generation produced empty or too small output" >> "$LOG_DIR/system-report.log"
  exit 1
fi

REPORT_GENERATED="yes"

# ─── Commit atomically ────────────────────────────────────────────────────

REPORT_SIZE=$(printf '%s' "$report_content" | wc -c)
REPORT_SHA=$(printf '%s' "$report_content" | sha256sum | awk '{print $1}')
FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

tmp_meta="$ADMIN_DIR/.meta.tmp.$$"
jq -n \
  --arg fname "system-report.txt" \
  --arg generated "$FINISHED_AT" \
  --arg size "$REPORT_SIZE" \
  --arg sha "$REPORT_SHA" \
  --arg rbu "$REQUEST_BY_USER" \
  --arg rbe "$REQUEST_BY_EMAIL" \
  '{
    fileName: $fname,
    generatedAt: $generated,
    fileSizeBytes: ($size | tonumber),
    sha256: $sha,
    requestedByUserId: (if ($rbu | length) > 0 then $rbu else null end),
    requestedByEmail: (if ($rbe | length) > 0 then $rbe else null end)
  }' > "$tmp_meta"

mv -f "$tmp_meta" "$META_FILE"

tmp_report="$ADMIN_DIR/.report.tmp.$$"
printf '%s' "$report_content" > "$tmp_report"
mv -f "$tmp_report" "$REPORT_FILE"

echo "$(date -Iseconds) [INFO] Report generated. size=$REPORT_SIZE sha256=$REPORT_SHA" >> "$LOG_DIR/system-report.log"

# ─── Success path ─────────────────────────────────────────────────────────

FINAL_STATUS="success"
FINAL_FINISHED_AT="$FINISHED_AT"
FINAL_ERROR=""
FINAL_LAST_SUCCESS="$FINISHED_AT"
