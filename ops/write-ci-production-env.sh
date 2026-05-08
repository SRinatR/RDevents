#!/usr/bin/env bash
set -euo pipefail

TARGET_FILE="${1:?target env file path is required}"

mkdir -p "$(dirname "$TARGET_FILE")"

cat > "$TARGET_FILE" <<ENV
POSTGRES_DB=event_platform
POSTGRES_USER=event_platform_user
POSTGRES_PASSWORD=event_platform_password
DATABASE_URL=postgresql://event_platform_user:event_platform_password@postgres:5432/event_platform?schema=public

JWT_ACCESS_SECRET=ci_access_secret_min_32_chars_value
JWT_REFRESH_SECRET=ci_refresh_secret_min_32_chars_value
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800

CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL:-http://127.0.0.1:4000}
DEFAULT_LOCALE=ru
PORT=4000

MEDIA_STORAGE_DRIVER=local
MEDIA_UPLOAD_DIR=./uploads
MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:4000/uploads

RESEND_WEBHOOK_SECRET=ci_resend_webhook_secret
EMAIL_BROADCAST_MAX_RECIPIENTS=1000
EMAIL_BROADCAST_CONCURRENCY=3
EMAIL_BROADCAST_BATCH_SIZE=50
EMAIL_BROADCAST_BATCH_DELAY_MS=1000
ENV

echo "Wrote CI production env file to $TARGET_FILE"
