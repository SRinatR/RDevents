#!/usr/bin/env bash
set -euo pipefail
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/rdevents}"; APP_DIR="${APP_DIR:-$DEPLOY_ROOT/app}"; ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"; COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"; RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
MIN_DB_BACKUP_BYTES="${MIN_DB_BACKUP_BYTES:-50000}"; TS="$(date -u +%Y%m%d-%H%M%S)"; BACKUP_DIR="$DEPLOY_ROOT/backups/releases/$RELEASE_SHA/$TS"; mkdir -p "$BACKUP_DIR"
compose(){ docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
sha256sum "$ENV_FILE" > "$BACKUP_DIR/env.sha256"
compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_DIR/db.sql.gz"
gzip -t "$BACKUP_DIR/db.sql.gz"; db_size=$(stat -c%s "$BACKUP_DIR/db.sql.gz"); [ "$db_size" -ge "$MIN_DB_BACKUP_BYTES" ]
volume_name="$(docker volume ls --format '{{.Name}}' | rg 'api_uploads$' | head -n1 || true)"
if [ -n "$volume_name" ]; then
 docker run --rm -v "$volume_name:/data:ro" -v "$BACKUP_DIR:/backup" alpine sh -lc 'tar -czf /backup/uploads.tar.gz -C /data .'
else
 tar -czf "$BACKUP_DIR/uploads.tar.gz" --files-from /dev/null
fi
tar -tzf "$BACKUP_DIR/uploads.tar.gz" >/dev/null; up_size=$(stat -c%s "$BACKUP_DIR/uploads.tar.gz")
compose ps --format json > "$BACKUP_DIR/docker-images-before.json" || true
cat > "$BACKUP_DIR/backup-checks.json" <<JSON
{"dbBackupCreated":true,"dbBackupSizeBytes":$db_size,"dbBackupGzipOk":true,"uploadsBackupCreated":true,"uploadsBackupSizeBytes":$up_size,"uploadsBackupTarOk":true,"uploadsVolume":"${volume_name:-}"}
JSON
cat > "$BACKUP_DIR/deploy-manifest.json" <<JSON
{"releaseSha":"$RELEASE_SHA","timestamp":"$(date -u +%FT%TZ)","environment":"production","dbBackup":"$BACKUP_DIR/db.sql.gz","dbBackupSizeBytes":$db_size,"dbBackupGzipOk":true,"uploadsBackup":"$BACKUP_DIR/uploads.tar.gz","uploadsBackupSizeBytes":$up_size,"uploadsBackupTarOk":true,"envSha256":"$(cut -d' ' -f1 "$BACKUP_DIR/env.sha256")","restoreTestStatus":"PENDING","migrationStarted":false,"migrationFinished":false,"deployStatus":"BACKUP_CREATED"}
JSON
ln -sfn "$BACKUP_DIR" "$DEPLOY_ROOT/backups/releases/$RELEASE_SHA/latest"
echo "$BACKUP_DIR"
