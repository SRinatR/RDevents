# Production rollback runbook

Production merge gate: complete [production-readiness-staging-checklist.md](production-readiness-staging-checklist.md) before deploying this safety release to production.

## Active release
- `cat /opt/rdevents/app/.release-commit`
- `cat /opt/rdevents/runtime/deploy-state.json`
- `cat /opt/rdevents/runtime/releases.json | jq`
- `curl https://api.rdevents.uz/release.json`
- `curl https://rdevents.uz/release.json`

## Find backup package
- `ls -lh /opt/rdevents/backups/releases/`
- `cat <manifest> | jq`

## Rollback commands
- Code only: `ops/rollback-production.sh --mode code --to-release <sha>`
- Code + DB: `ops/rollback-production.sh --mode code-db --manifest <path>`
- Full: `ops/rollback-production.sh --mode full --manifest <path>`

For `code-db` and `full`, use the manifest for the failed deploy. Rollback uses `previousReleaseSha` from that manifest, falling back to `releaseSha` only for older manifests.

## Verify rollback
- `docker compose ps`
- `docker inspect <container_id> --format '{{.Image}}'`
- `cat /opt/rdevents/runtime/releases.json | jq '.current,.previous'`
- `curl https://api.rdevents.uz/version`
- `curl https://api.rdevents.uz/api/version`
- `curl https://api.rdevents.uz/release.json`
- `curl https://rdevents.uz/version.txt`
- `curl https://rdevents.uz/release.json`
- `curl https://api.rdevents.uz/health`
- `curl https://api.rdevents.uz/api/events`
- `ops/check-production-business-health.sh`

## Safety rules
- Never restore over production without emergency backup.
- Never run cleanup without explicit production confirmation.
- Never hard-delete production events.
- Rollback and deploy coordinate through `/opt/rdevents/runtime/deploy.lock` and `/opt/rdevents/runtime/rollback.lock`.
- `flock` releases locks when the process exits. If a lock appears stale, verify there is no running deploy or rollback process before removing any lock file.
- `.release-commit` is only a marker. Code rollback source of truth is `/opt/rdevents/runtime/releases.json` plus locally available Docker image IDs.

## Backup and restore checks
- Backup health: `ops/check-backup-health.sh`
- Prune preview: `ops/prune-backups.sh --dry-run`
- Prune confirmed: `ops/prune-backups.sh --confirm`
- Scheduled backup logs: `journalctl -u rdevents-backup.service`
