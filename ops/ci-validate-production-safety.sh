#!/usr/bin/env bash
set -euo pipefail
bash -n ops/deploy-production.sh ops/create-predeploy-backup.sh ops/test-db-backup-restore.sh ops/rollback-production.sh ops/rollback-code.sh
rg -n "run_backup|create-predeploy-backup" ops/deploy-production.sh >/dev/null
if rg -n "pnpm run db:cleanup-mock" ops/deploy-production.sh >/dev/null; then
  rg -n "RUN_PRODUCTION_MOCK_CLEANUP" ops/deploy-production.sh >/dev/null || { echo "Unsafe cleanup invocation in deploy script"; exit 1; }
fi
[ -f ops/rollback-production.sh ] && [ -f docs/production-rollback-runbook.md ]
echo "Production safety validation passed"
