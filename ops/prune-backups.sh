#!/usr/bin/env bash
set -euo pipefail

MODE="dry-run"
if [ "${1:-}" = "--confirm" ]; then
  MODE="confirm"
elif [ "${1:-}" = "--dry-run" ] || [ $# -eq 0 ]; then
  MODE="dry-run"
else
  echo "Usage: ops/prune-backups.sh [--dry-run|--confirm]"
  exit 2
fi

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"
ROOT="${BACKUP_RELEASE_ROOT:-$DEPLOY_ROOT/backups/releases}"
NOW="$(date +%s)"

declare -A KEEP_REASON
declare -A BEST_DAILY
declare -A BEST_WEEKLY
declare -A BEST_MONTHLY
declare -A BEST_EPOCH

parse_epoch() {
  local dir="$1"
  local stamp
  stamp="$(basename "$dir")"
  date -d "$stamp" +%s 2>/dev/null || echo 0
}

remember_best() {
  local bucket_name="$1"
  local key="$2"
  local dir="$3"
  local epoch="$4"
  local current=""

  case "$bucket_name" in
    daily) current="${BEST_DAILY[$key]:-}" ;;
    weekly) current="${BEST_WEEKLY[$key]:-}" ;;
    monthly) current="${BEST_MONTHLY[$key]:-}" ;;
  esac

  if [ -z "$current" ] || [ "$epoch" -gt "${BEST_EPOCH[$current]:-0}" ]; then
    case "$bucket_name" in
      daily) BEST_DAILY[$key]="$dir" ;;
      weekly) BEST_WEEKLY[$key]="$dir" ;;
      monthly) BEST_MONTHLY[$key]="$dir" ;;
    esac
  fi
}

mark_keep() {
  local dir="$1"
  local reason="$2"
  KEEP_REASON["$dir"]="$reason"
}

[ -d "$ROOT" ] || {
  echo "Backup release root does not exist: $ROOT"
  exit 0
}

mapfile -t DIRS < <(find "$ROOT" -mindepth 2 -maxdepth 2 -type d | sort)

for dir in "${DIRS[@]}"; do
  epoch="$(parse_epoch "$dir")"
  BEST_EPOCH["$dir"]="$epoch"

  if [ -f "$dir/KEEP" ]; then
    mark_keep "$dir" "KEEP file"
    continue
  fi

  case "$dir" in
    *emergency*|*incident*|*manual*)
      mark_keep "$dir" "protected emergency/incident/manual backup"
      continue
      ;;
  esac

  if [ "$epoch" -le 0 ]; then
    mark_keep "$dir" "unparseable timestamp"
    continue
  fi

  age_days=$(( (NOW - epoch) / 86400 ))
  if [ "$age_days" -le 7 ]; then
    mark_keep "$dir" "all backups for 7 days"
  elif [ "$age_days" -le 30 ]; then
    remember_best daily "$(date -d "@$epoch" +%Y%m%d)" "$dir" "$epoch"
  elif [ "$age_days" -le 90 ]; then
    remember_best weekly "$(date -d "@$epoch" +%G-W%V)" "$dir" "$epoch"
  elif [ "$age_days" -le 365 ]; then
    remember_best monthly "$(date -d "@$epoch" +%Y-%m)" "$dir" "$epoch"
  fi
done

for dir in "${BEST_DAILY[@]}"; do
  mark_keep "$dir" "daily retention"
done
for dir in "${BEST_WEEKLY[@]}"; do
  mark_keep "$dir" "weekly retention"
done
for dir in "${BEST_MONTHLY[@]}"; do
  mark_keep "$dir" "monthly retention"
done

deleted=0
kept=0
for dir in "${DIRS[@]}"; do
  if [ -n "${KEEP_REASON[$dir]:-}" ]; then
    echo "keep: $dir (${KEEP_REASON[$dir]})"
    kept=$((kept + 1))
    continue
  fi

  echo "delete candidate: $dir"
  if [ "$MODE" = "confirm" ]; then
    rm -rf "$dir"
    echo "deleted: $dir"
  fi
  deleted=$((deleted + 1))
done

if [ "$MODE" = "dry-run" ]; then
  echo "Dry run complete. Kept $kept backup directories; $deleted would be deleted."
  echo "Run with --confirm to delete eligible backups."
else
  echo "Prune complete. Kept $kept backup directories; deleted $deleted."
fi
