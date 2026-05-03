#!/usr/bin/env bash
set -euo pipefail
MODE=""; TO_RELEASE=""; MANIFEST=""
while [[ $# -gt 0 ]]; do case "$1" in --mode) MODE="$2"; shift 2;; --to-release) TO_RELEASE="$2"; shift 2;; --manifest) MANIFEST="$2"; shift 2;; *) shift;; esac; done
[ -n "$MODE" ] || exit 1
TS="$(date +%Y%m%d-%H%M%S)"; EDIR="/opt/rdevents/backups/emergency-before-rollback-$TS"; mkdir -p "$EDIR"
/opt/rdevents/ops/create-predeploy-backup.sh >/tmp/rollback-prebackup.txt || true
if [[ "$MODE" == "code" ]]; then /opt/rdevents/ops/rollback-code.sh --to-release "$TO_RELEASE"; exit 0; fi
DB_BACKUP="$(jq -r .dbBackup "$MANIFEST")"; UP_BACKUP="$(jq -r .uploadsBackup "$MANIFEST")"; REL="$(jq -r .releaseSha "$MANIFEST")"
/opt/rdevents/ops/restore-db-from-backup.sh "$DB_BACKUP"
[[ "$MODE" == "full" ]] && /opt/rdevents/ops/restore-uploads-from-backup.sh "$UP_BACKUP"
/opt/rdevents/ops/rollback-code.sh --to-release "$REL"
