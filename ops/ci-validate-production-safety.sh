#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "ERROR: $1"
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "Required file is missing: $1"
}

require_grep() {
  local pattern="$1"
  local file="$2"
  local message="$3"
  grep -Eq "$pattern" "$file" || fail "$message"
}

reject_grep() {
  local pattern="$1"
  local file="$2"
  local message="$3"
  if grep -Eq "$pattern" "$file"; then
    fail "$message"
  fi
}

bash -n ops/*.sh

require_file ops/deploy-production.sh
require_file ops/create-predeploy-backup.sh
require_file ops/test-db-backup-restore.sh
require_file ops/rollback-production.sh
require_file ops/rollback-code.sh
require_file ops/restore-db-from-backup.sh
require_file ops/restore-uploads-from-backup.sh
require_file docs/production-rollback-runbook.md
require_file docs/production-data-safety-runbook.md
require_file docs/backup-retention-policy.md
require_file .github/workflows/ci.yml
require_file .github/workflows/deploy-production.yml
require_file .github/workflows/recreate-production-services.yml

require_grep 'cancel-in-progress:[[:space:]]*false' .github/workflows/ci.yml \
  "CI must not auto-cancel runs because Required Checks aggregates upstream job statuses"
require_grep 'Required upstream job did not pass' .github/workflows/ci.yml \
  "Required Checks must print a clear error for failed or cancelled upstream jobs"
for job in production-safety lint typecheck test build docker-build container-smoke; do
  require_grep "require_success[[:space:]]+\"$job\"" .github/workflows/ci.yml \
    "Required Checks must require success for $job"
done

for workflow in .github/workflows/deploy-production.yml .github/workflows/recreate-production-services.yml; do
  require_grep 'required_secret PROD_HOST' "$workflow" \
    "$workflow must validate PROD_HOST before SSH"
  require_grep 'required_secret PROD_PORT' "$workflow" \
    "$workflow must validate PROD_PORT before SSH"
  require_grep 'required_secret PROD_USER' "$workflow" \
    "$workflow must validate PROD_USER before SSH"
  require_grep 'required_secret PROD_SSH_KEY' "$workflow" \
    "$workflow must validate PROD_SSH_KEY before SSH"
  require_grep 'ssh-keygen[[:space:]]+-y' "$workflow" \
    "$workflow must validate the production SSH private key"
  require_grep 'ssh-keyscan[[:space:]]+-T[[:space:]]+20' "$workflow" \
    "$workflow must bound ssh-keyscan with a timeout"
  require_grep 'Host prod' "$workflow" \
    "$workflow must configure a production SSH host alias"
  require_grep 'BatchMode yes' "$workflow" \
    "$workflow must use non-interactive SSH authentication"
  require_grep 'IdentitiesOnly yes' "$workflow" \
    "$workflow must force the configured deploy identity"
  require_grep 'ConnectTimeout 20' "$workflow" \
    "$workflow must fail unreachable SSH connections quickly"
  require_grep 'ServerAliveInterval 15' "$workflow" \
    "$workflow must keep long SSH sessions alive"
  require_grep 'ssh prod' "$workflow" \
    "$workflow must use the hardened production SSH alias"
  reject_grep 'ssh[[:space:]]+-p' "$workflow" \
    "$workflow must not bypass the hardened production SSH alias"
  reject_grep 'scp[[:space:]]+-P' "$workflow" \
    "$workflow must not bypass the hardened production SSH alias for scp"
done

require_grep 'create-predeploy-backup\.sh' ops/deploy-production.sh \
  "deploy-production.sh must create a predeploy backup package"
require_grep 'test-db-backup-restore\.sh' ops/deploy-production.sh \
  "deploy-production.sh must run DB restore-test before migrations"
require_grep 'prisma migrate deploy' ops/deploy-production.sh \
  "deploy-production.sh must run migrations explicitly"

backup_line="$(grep -n 'create-predeploy-backup\.sh' ops/deploy-production.sh | head -1 | cut -d: -f1)"
restore_line="$(grep -n 'test-db-backup-restore\.sh' ops/deploy-production.sh | head -1 | cut -d: -f1)"
migrate_line="$(grep -n 'prisma migrate deploy' ops/deploy-production.sh | head -1 | cut -d: -f1)"

[ "$backup_line" -lt "$migrate_line" ] || fail "predeploy backup must run before migrations"
[ "$restore_line" -lt "$migrate_line" ] || fail "restore-test must run before migrations"

reject_grep 'pnpm[[:space:]]+run[[:space:]]+db:cleanup-mock' ops/deploy-production.sh \
  "production deploy must not run db:cleanup-mock"

require_grep 'ON_ERROR_STOP=1' ops/restore-db-from-backup.sh \
  "restore-db-from-backup.sh must restore with ON_ERROR_STOP=1"
require_grep 'emergency-before-rollback' ops/restore-db-from-backup.sh \
  "restore-db-from-backup.sh must create an emergency backup"
require_grep 'docker[[:space:]]+volume[[:space:]]+ls' ops/restore-uploads-from-backup.sh \
  "restore-uploads-from-backup.sh must detect Docker uploads volume"
require_grep 'api_uploads\$' ops/restore-uploads-from-backup.sh \
  "restore-uploads-from-backup.sh must target the api_uploads Docker volume"
require_grep 'emergency-before-uploads-rollback' ops/restore-uploads-from-backup.sh \
  "restore-uploads-from-backup.sh must create an emergency uploads backup"
reject_grep 'tar[[:space:]]+-xzf[[:space:]]+"\$ARCHIVE"[[:space:]]+-C[[:space:]]+/' ops/restore-uploads-from-backup.sh \
  "restore-uploads-from-backup.sh must not extract uploads to host root"

require_grep 'releases\.json' ops/rollback-code.sh \
  "rollback-code.sh must use the release registry"
require_grep 'docker[[:space:]]+image[[:space:]]+inspect' ops/rollback-code.sh \
  "rollback-code.sh must verify target image IDs exist before changing services"
require_grep 'docker[[:space:]]+tag' ops/rollback-code.sh \
  "rollback-code.sh must retag target images for compose rollback"
require_grep 'docker[[:space:]]+inspect.*\.Image' ops/rollback-code.sh \
  "rollback-code.sh must verify running container image IDs"
require_grep 'check-production-business-health\.sh' ops/rollback-code.sh \
  "rollback-code.sh must run the business health check"

require_grep 'get_container_release_sha' ops/deploy-production.sh \
  "deploy-production.sh must inspect running container release markers before updating release registry"
require_grep 'find_earliest_manifest_for_release' ops/deploy-production.sh \
  "deploy-production.sh must be able to recover previous image IDs from an earlier same-release manifest"
require_grep 'recover_previous_images_from_manifest' ops/deploy-production.sh \
  "deploy-production.sh must recover previous release images from manifest during reruns"
require_grep 'Detected rerun after containers already switched to target release' ops/deploy-production.sh \
  "deploy-production.sh must log partial-deploy rerun detection"
require_grep 'FORCE_UPDATE_PREVIOUS_RELEASE_IMAGES' ops/deploy-production.sh \
  "deploy-production.sh must require an explicit force flag before overwriting complete previous release images"
require_grep 'Not overwriting previous release registry entry' ops/deploy-production.sh \
  "deploy-production.sh must avoid overwriting previous release registry entries when image mapping is unsafe"

require_grep 'deploy\.lock' ops/rollback-production.sh \
  "rollback-production.sh must coordinate with deploy lock"
require_grep 'rollback\.lock' ops/rollback-production.sh \
  "rollback-production.sh must coordinate with rollback lock"

ripgrep_command_pattern='r''g '
if grep -R "$ripgrep_command_pattern" ops/ >/dev/null; then
  fail "Ops scripts must not depend on ripgrep"
fi

echo "Production safety validation passed"
