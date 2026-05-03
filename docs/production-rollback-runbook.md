# Production rollback runbook

## Active release
- `cat /opt/rdevents/app/.release-commit`
- `cat /opt/rdevents/runtime/deploy-state.json`
- `curl https://api.rdevents.uz/release.json`
- `curl https://rdevents.uz/release.json`

## Find backup package
- `ls -lh /opt/rdevents/backups/releases/`
- `cat <manifest> | jq`

## Rollback commands
- Code only: `ops/rollback-production.sh --mode code --to-release <sha>`
- Code + DB: `ops/rollback-production.sh --mode code-db --manifest <path>`
- Full: `ops/rollback-production.sh --mode full --manifest <path>`

## Verify rollback
- `docker compose ps`
- `curl https://api.rdevents.uz/health`
- `curl https://api.rdevents.uz/api/events`
- `ops/check-production-business-health.sh`

## Safety rules
- Never restore over production without emergency backup.
- Never run cleanup without explicit production confirmation.
- Never hard-delete production events.
