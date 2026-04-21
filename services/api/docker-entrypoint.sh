#!/bin/sh
set -e

if [ "$SKIP_MIGRATE" = "true" ]; then
  echo "Skipping migrations (recovery mode)..."
else
  echo "Running database migrations..."
  pnpm exec prisma migrate deploy
fi

echo "Starting application..."
exec node dist/main.js
