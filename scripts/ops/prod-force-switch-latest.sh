#!/usr/bin/env bash
set -euo pipefail

RELEASE_SHA="${1:?usage: prod-force-switch-latest.sh <release_sha>}"
ENV_FILE="${ENV_FILE:-/opt/rdevents/.env}"
APP_DIR="${APP_DIR:-/opt/rdevents/app}"

cd "$APP_DIR"

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml \
  run --rm --no-deps --entrypoint sh api -lc 'cd /app/services/api && pnpm exec prisma migrate deploy'

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml \
  up -d --force-recreate --remove-orphans api web

sleep 10

printf '%s\n' "$RELEASE_SHA" > "$APP_DIR/.release-commit"

curl --retry 10 --retry-delay 2 --retry-all-errors -fsS "http://127.0.0.1:3000/release.json?ts=$(date +%s)"
echo
curl --retry 10 --retry-delay 2 --retry-all-errors -fsS "http://127.0.0.1:4000/release.json?ts=$(date +%s)"
echo
