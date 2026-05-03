#!/usr/bin/env bash
set -euo pipefail
TO_RELEASE=""
while [[ $# -gt 0 ]]; do case "$1" in --to-release) TO_RELEASE="$2"; shift 2;; *) shift;; esac; done
[ -n "$TO_RELEASE" ] || { echo "--to-release required"; exit 1; }
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
echo "$TO_RELEASE" > "$APP_DIR/.release-commit"
compose up -d --force-recreate api web report-worker email-broadcast-worker
curl -fsS https://api.rdevents.uz/health >/dev/null
echo "Code rollback completed to $TO_RELEASE"
