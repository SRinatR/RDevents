#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
BACKUP_ROOT="${BACKUP_ROOT:-$DEPLOY_ROOT/backups}"
RELEASE_BACKUP_ROOT="${RELEASE_BACKUP_ROOT:-$BACKUP_ROOT/releases}"
MAX_DB_BACKUP_AGE_HOURS="${MAX_DB_BACKUP_AGE_HOURS:-24}"
MAX_UPLOADS_BACKUP_AGE_HOURS="${MAX_UPLOADS_BACKUP_AGE_HOURS:-24}"
MIN_DB_BACKUP_BYTES="${MIN_DB_BACKUP_BYTES:-50000}"
MIN_FREE_DISK_PERCENT="${MIN_FREE_DISK_PERCENT:-15}"
RESTORE_TEST_SUCCESS_MARKER="${RESTORE_TEST_SUCCESS_MARKER:-DB backup restore test passed.}"

fail() {
  echo "ERROR: $1"
  exit 1
}

latest_file() {
  local pattern="$1"
  find "$RELEASE_BACKUP_ROOT" -name "$pattern" -type f -printf '%T@ %p\n' 2>/dev/null |
    sort -n |
    tail -1 |
    cut -d' ' -f2-
}

file_age_hours() {
  local file="$1"
  echo $(( ( $(date +%s) - $(stat -c %Y "$file") ) / 3600 ))
}

[ -d "$RELEASE_BACKUP_ROOT" ] || fail "backup root does not exist: $RELEASE_BACKUP_ROOT"

latest_db="$(latest_file db.sql.gz)"
[ -n "$latest_db" ] || fail "latest DB backup was not found"
[ -f "$latest_db" ] || fail "latest DB backup path is invalid: $latest_db"

db_age="$(file_age_hours "$latest_db")"
[ "$db_age" -le "$MAX_DB_BACKUP_AGE_HOURS" ] || fail "latest DB backup is too old: ${db_age}h"

gzip -t "$latest_db" || fail "latest DB backup failed gzip integrity check: $latest_db"
db_size="$(stat -c%s "$latest_db")"
[ "$db_size" -ge "$MIN_DB_BACKUP_BYTES" ] || fail "latest DB backup is too small: $db_size bytes"

uploads_volume="$(docker volume ls --format '{{.Name}}' | grep 'api_uploads$' | head -n1 || true)"
if [ -n "$uploads_volume" ]; then
  latest_uploads="$(latest_file uploads.tar.gz)"
  [ -n "$latest_uploads" ] || fail "uploads volume exists, but latest uploads backup was not found"
  uploads_age="$(file_age_hours "$latest_uploads")"
  [ "$uploads_age" -le "$MAX_UPLOADS_BACKUP_AGE_HOURS" ] || fail "latest uploads backup is too old: ${uploads_age}h"
  tar -tzf "$latest_uploads" >/dev/null || fail "latest uploads backup failed tar integrity check: $latest_uploads"
fi

latest_restore_log="$(latest_file restore-test.log)"
[ -n "$latest_restore_log" ] || fail "latest restore-test log was not found"
grep -F "$RESTORE_TEST_SUCCESS_MARKER" "$latest_restore_log" >/dev/null || fail "latest restore-test log has no success marker: $latest_restore_log"

free_percent="$(df -P "$DEPLOY_ROOT" | awk 'NR==2 { gsub("%", "", $5); print 100 - $5 }')"
[ "$free_percent" -ge "$MIN_FREE_DISK_PERCENT" ] || fail "free disk space is too low: ${free_percent}%"

echo "Backup health ok"
echo "latestDbBackup=$latest_db"
echo "latestDbBackupAgeHours=$db_age"
echo "latestDbBackupSizeBytes=$db_size"
if [ -n "${latest_uploads:-}" ]; then
  echo "latestUploadsBackup=$latest_uploads"
  echo "latestUploadsBackupAgeHours=$uploads_age"
fi
echo "latestRestoreTestLog=$latest_restore_log"
echo "freeDiskPercent=$free_percent"
