#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  pnpm exec prisma migrate deploy
fi

echo "Starting application..."
exec node dist/main.js
