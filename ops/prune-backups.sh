#!/usr/bin/env bash
set -euo pipefail
CONFIRM=false; [ "${1:-}" = "--confirm" ] && CONFIRM=true
ROOT="/opt/rdevents/backups/releases"
find "$ROOT" -mindepth 2 -maxdepth 2 -type d | while read -r d; do
  [ -f "$d/KEEP" ] && continue
  age_days=$(( ( $(date +%s) - $(date -d "$(basename "$d")" +%s 2>/dev/null || echo 0) ) / 86400 ))
  if [ "$age_days" -gt 7 ]; then
    echo "prune candidate: $d"
    $CONFIRM && rm -rf "$d"
  fi
done
