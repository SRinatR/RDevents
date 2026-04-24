#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA="${1:-}"
ENV_FILE="${ENV_FILE:-/opt/rdevents/.env}"
APP_DIR="${APP_DIR:-/opt/rdevents/app}"

cd "$APP_DIR"

WEB_JSON="$(curl -fsS "https://rdevents.uz/release.json?ts=$(date +%s)")"
API_JSON="$(curl -fsS "https://api.rdevents.uz/release.json?ts=$(date +%s)")"

WEB_SHA="$(printf '%s' "$WEB_JSON" | sed -n 's/.*"releaseSha":"\([^"]*\)".*/\1/p')"
API_SHA="$(printf '%s' "$API_JSON" | sed -n 's/.*"releaseSha":"\([^"]*\)".*/\1/p')"

echo "WEB_JSON=$WEB_JSON"
echo "API_JSON=$API_JSON"
echo "WEB_SHA=$WEB_SHA"
echo "API_SHA=$API_SHA"

curl -fsS "https://api.rdevents.uz/health"
echo
curl -fsS "https://api.rdevents.uz/ready"
echo

if [ -n "$EXPECTED_SHA" ]; then
  [ "$WEB_SHA" = "$EXPECTED_SHA" ] || { echo "WEB SHA mismatch"; exit 1; }
  [ "$API_SHA" = "$EXPECTED_SHA" ] || { echo "API SHA mismatch"; exit 1; }
  echo "SHA checks passed"
fi
