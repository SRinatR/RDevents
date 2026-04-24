#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="/opt/rdevents/runtime"
ADMIN_DIR="$RUNTIME_DIR/admin"
CONTROL_DIR="$RUNTIME_DIR/control"
LOG_DIR="/var/log/rdevents"

REQUEST_FILE="$CONTROL_DIR/system-report-refresh-request.json"
STATUS_FILE="$ADMIN_DIR/system-report-status.json"
META_FILE="$ADMIN_DIR/system-report-meta.json"
REPORT_FILE="$ADMIN_DIR/system-report.txt"
TMP_REPORT="$ADMIN_DIR/system-report.txt.tmp.$$"
TMP_STATUS="$ADMIN_DIR/system-report-status.json.tmp.$$"
TMP_META="$ADMIN_DIR/system-report-meta.json.tmp.$$"

LOCK_FILE="$RUNTIME_DIR/system-report.lock"

mkdir -p "$ADMIN_DIR" "$CONTROL_DIR" "$LOG_DIR"
mkdir -p "$(dirname "$LOCK_FILE")"

exec {lock_fd}<"$LOCK_FILE"
if ! flock -n "$lock_fd"; then
  echo "$(date -Iseconds) [WARN] Another instance is running, exiting."
  exit 0
fi

request_id=""
requested_by_user_id=""
requested_by_email=""
requested_at=""

if [ -f "$REQUEST_FILE" ]; then
  request_id=$(jq -r '.requestId // ""' "$REQUEST_FILE" 2>/dev/null || echo "")
  requested_by_user_id=$(jq -r '.requestedByUserId // ""' "$REQUEST_FILE" 2>/dev/null || echo "")
  requested_by_email=$(jq -r '.requestedByEmail // ""' "$REQUEST_FILE" 2>/dev/null || echo "")
  requested_at=$(jq -r '.requestedAt // ""' "$REQUEST_FILE" 2>/dev/null || echo "")
fi

echo "$(date -Iseconds) [INFO] Starting system report generation. requestId=$request_id by=$requested_by_email" | tee -a "$LOG_DIR/system-report.log"

write_status() {
  local state="$1"
  local started="$2"
  local finished="$3"
  local last_error="$4"
  cat > "$TMP_STATUS" <<EOF
{
  "state": "$state",
  "requestId": ${request_id:+$(printf '%s' "$request_id" | jq -Rs .)},
  "requestedAt": ${requested_at:+$(printf '%s' "$requested_at" | jq -Rs .)},
  "requestedByUserId": ${requested_by_user_id:+$(printf '%s' "$requested_by_user_id" | jq -Rs .)},
  "requestedByEmail": ${requested_by_email:+$(printf '%s' "$requested_by_email" | jq -Rs .)},
  "startedAt": $started,
  "finishedAt": $finished,
  "lastSuccessAt": $(jq -r '.lastSuccessAt // null' "$STATUS_FILE" 2>/dev/null || echo "null"),
  "lastError": $last_error
}
EOF
}

write_meta() {
  local generated="$1"
  local size="$2"
  local sha="$3"
  cat > "$TMP_META" <<EOF
{
  "fileName": "system-report.txt",
  "generatedAt": "$generated",
  "fileSizeBytes": $size,
  "sha256": "$sha",
  "requestedByUserId": ${requested_by_user_id:+$(printf '%s' "$requested_by_user_id" | jq -Rs .)},
  "requestedByEmail": ${requested_by_email:+$(printf '%s' "$requested_by_email" | jq -Rs .)}
}
EOF
}

STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
write_status "running" "\"$STARTED_AT\"" "null" "null"
mv -f "$TMP_STATUS" "$STATUS_FILE"

generate_report() {
  local report_content=""
  local ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  report_content+="================================================================================
RDEvents System Diagnostic Report
Generated: $ts UTC
================================================================================

"

  report_content+="[environment]
"
  report_content+="generated_at_utc=$ts
"
  report_content+="hostname=$(hostname 2>/dev/null || echo unknown)
"
  report_content+="host_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo unknown)
"
  report_content+="whoami=$(whoami 2>/dev/null || echo unknown)
"
  report_content+="pwd=$(pwd 2>/dev/null || echo unknown)
"
  report_content+="date=$(date 2>/dev/null || echo unknown)
"
  report_content+="uname=$(uname -a 2>/dev/null || echo unknown)
"
  report_content+="
"

  report_content+="[app_release_commit]
"
  if [ -f "$APP_DIR/app/.release-commit" ]; then
    report_content+="$(cat "$APP_DIR/app/.release-commit" 2>/dev/null | head -5)
"
  else
    report_content+="# File not found: $APP_DIR/app/.release-commit
"
  fi
  report_content+="
"

  report_content+="[runtime_version]
"
  if [ -f "$RUNTIME_DIR/version.txt" ]; then
    report_content+="$(cat "$RUNTIME_DIR/version.txt" 2>/dev/null)
"
  fi
  report_content+="
"
  if [ -f "$RUNTIME_DIR/release.json" ]; then
    report_content+="$(cat "$RUNTIME_DIR/release.json" 2>/dev/null)
"
  fi
  report_content+="
"

  report_content+="[compose_ps]
"
  if command -v docker &>/dev/null; then
    report_content+="$("$APP_DIR/app/docker-compose.prod.yml" 2>/dev/null && docker compose --env-file "$APP_DIR/.env" -f "$APP_DIR/app/docker-compose.prod.yml" ps -a 2>&1 | head -30 || echo "docker compose not available")
"
  else
    report_content+="# docker not available
"
  fi
  report_content+="
"

  report_content+="[container_release_files]
"
  for svc in api web; do
    report_content+="## $svc container
"
    report_content+="# Note: container release files read via docker exec (if available)
"
  done
  report_content+="
"

  report_content+="[local_endpoint_checks]
"
  for url in \
    "http://127.0.0.1:3000/release.json" \
    "http://127.0.0.1:3000/version.txt" \
    "http://127.0.0.1:4000/health" \
    "http://127.0.0.1:4000/ready" \
    "http://127.0.0.1:4000/version"; do
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")
    report_content+="$url -> $status_code
"
  done
  report_content+="
"

  report_content+="[public_endpoint_checks]
"
  for url in \
    "https://rdevents.uz/release.json" \
    "https://rdevents.uz/version.txt" \
    "https://api.rdevents.uz/health" \
    "https://api.rdevents.uz/ready" \
    "https://api.rdevents.uz/version"; do
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")
    report_content+="$url -> $status_code
"
  done
  report_content+="
"

  report_content+="[ports]
"
  if command -v ss &>/dev/null; then
    report_content+="$(\ss -ltnp 2>/dev/null | grep -E ':80 |:443 |:3000 |:4000 ' | head -20 || echo "ss not available")
"
  elif command -v netstat &>/dev/null; then
    report_content+="$(\netstat -ltnp 2>/dev/null | grep -E ':80 |:443 |:3000 |:4000 ' | head -20 || echo "netstat not available")
"
  else
    report_content+="# ss/netstat not available
"
  fi
  report_content+="
"

  report_content+="[disk_usage]
"
  report_content+="$(df -h / 2>/dev/null | tail -1)
"
  report_content+="
"

  report_content+="================================================================================
End of Report
================================================================================
"
  echo "$report_content"
}

ERROR_MSG="null"
FINISHED_AT="null"
SUCCESS="false"

if generate_report > "$TMP_REPORT" 2>&1; then
  SIZE=$(wc -c < "$TMP_REPORT")
  SHA=$(sha256sum "$TMP_REPORT" | awk '{print $1}')
  GEN_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  write_meta "$GEN_AT" "$SIZE" "$SHA"
  mv -f "$TMP_META" "$META_FILE"

  mv -f "$TMP_REPORT" "$REPORT_FILE"
  SUCCESS="true"
else
  ERROR_MSG=$(printf '%s' "$(cat "$TMP_REPORT" 2>/dev/null | head -c 500)" | jq -Rs .)
  FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "$(date -Iseconds) [ERROR] Report generation failed: $ERROR_MSG" | tee -a "$LOG_DIR/system-report.log"

  rm -f "$TMP_REPORT"
fi

FINISHED_AT_VAL=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$SUCCESS" = "true" ]; then
  write_status "success" "\"$STARTED_AT\"" "\"$FINISHED_AT_VAL\"" "null"
  echo "$(date -Iseconds) [INFO] Report generated successfully. size=$SIZE sha256=$SHA" | tee -a "$LOG_DIR/system-report.log"
else
  write_status "failed" "\"$STARTED_AT\"" "\"$FINISHED_AT_VAL\"" "$ERROR_MSG"
fi

rm -f "$TMP_STATUS" "$TMP_META" 2>/dev/null
[ -f "$STATUS_FILE" ] && mv -f "$TMP_STATUS" "$STATUS_FILE" 2>/dev/null || true

rm -f "$REQUEST_FILE" 2>/dev/null || true

flock -u "$lock_fd"