#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  pnpm exec prisma migrate deploy
fi

if [ "$#" -gt 0 ]; then
  echo "Starting custom command: $@"
  exec "$@"
fi

echo "Starting application..."
exec node dist/main.js
