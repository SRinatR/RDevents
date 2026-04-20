# CI/CD and Production Release Workflow

This repository separates code verification from production deployment.

## Branches

| Branch | Purpose | Direct push | Merge path |
|--------|---------|-------------|------------|
| `feature/*` | Feature work | Allowed for developers | PR to `main` |
| `fix/*` | Bug fixes | Allowed for developers | PR to `main` |
| `hotfix/*` | Urgent fixes | Allowed for developers | PR to `main` |
| `main` | Integration branch | Forbidden by branch protection | PR only |
| `production` | Release and production branch | Forbidden by branch protection | PR from `main` only |

`develop` is still covered by CI while the branch exists, but the production release flow is `dev branch -> main -> production -> deploy`.

## Workflow Summary

```text
feature/*, fix/*, hotfix/*
        |
        | PR
        v
main  -- CI only, no production secrets, no deploy
        |
        | PR main -> production
        v
production -- production deploy only
```

## CI Workflow

File: `.github/workflows/ci.yml`

CI is verification only. It must not deploy, connect to production, or read production secrets.

Triggers:

- `pull_request` to `main`
- `pull_request` to `develop`
- `push` to `main`
- `push` to `develop`
- `push` to `feature/**`
- `push` to `fix/**`
- `push` to `hotfix/**`

Jobs:

- `Type check`: installs dependencies and runs `pnpm typecheck`
- `Lint`: installs dependencies and runs `pnpm lint`
- `Test`: starts a Postgres service, generates the Prisma client, and runs `pnpm test`
- `Build`: waits for typecheck, lint, and test to pass, then installs dependencies and runs `pnpm build`

Runtime policy:

- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- project Node.js runtime is `24`
- pnpm is installed before `actions/setup-node` enables `cache: pnpm`
- `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` must not be used

Concurrency:

- old CI runs for the same PR or branch are cancelled with `cancel-in-progress: true`

Required status checks for branch protection:

- `Type check`
- `Lint`
- `Test`
- `Build`

Use the exact check-run names reported by GitHub API. In the PR UI these checks are shown under the workflow as `CI / Type check`, `CI / Lint`, `CI / Test`, and `CI / Build`; branch protection stores the check names as `Type check`, `Lint`, `Test`, and `Build`. If GitHub UI shows old entries such as `CI/Build` or `CI/Type check`, remove them and select the current checks above.

## Production Deploy Workflow

File: `.github/workflows/deploy-production.yml`

Production deploy is deployment only. It is not a replacement for CI and does not run `pnpm typecheck` or `pnpm build`.

Triggers:

- `push` to `production`
- `workflow_dispatch`, guarded so it can run only from `refs/heads/production`

Deploy job:

- uses GitHub Environment `production`
- uses `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- uses `cancel-in-progress: false` so a production deploy is not silently cancelled by a newer run
- checks out the exact workflow ref
- packs the checked-out production commit into an archive
- uploads the archive to the production server
- writes the environment file from the `production` environment secret
- deploys with Docker Compose on the server (see sequence below)
- writes `.release-commit` with the deployed commit SHA
- starts Postgres, waits for it to become healthy, and writes a non-empty pre-migration database backup
- runs `pnpm prisma:deploy` only after the backup succeeds
- recreates API and web with Docker Compose only after backup and migrations succeed
- runs smoke checks for API, web, `/health`, `/ready`, web `/ru`, release markers, and public HTTPS ingress

### Deploy sequence

The deploy step on the server follows this exact order to keep the database safe:

1. **Unpack release** — extract the archive into `$APP_DIR`, write `.release-commit`.
2. **Build images** — `docker compose build` builds all new images before any running container is touched.
3. **Keep current api and web running** — the deploy does not stop app containers before backup and migration. If any risky step fails, the old site keeps serving traffic.
4. **Start postgres** — `docker compose up -d postgres` ensures postgres is up without touching api/web.
5. **Wait for postgres healthy** — polls the postgres container health status with `docker inspect` for up to 60 seconds; aborts the deploy if postgres does not become healthy. This checks the Docker health check (`pg_isready -U <user> -d <db>`) rather than a bare TCP probe, confirming the correct user and database are accepting connections.
6. **Backup** — runs `pg_dump | gzip` inside the postgres container using the container's own `POSTGRES_USER` and `POSTGRES_DB`, then writes the compressed dump to `$DEPLOY_ROOT/backups/pre-migrate-<timestamp>.sql.gz`. The deploy aborts if the backup fails or the file is empty.
7. **Migrate** — runs `pnpm prisma:deploy` inside a one-off API container (`docker compose run --rm --no-deps api`). The deploy aborts if any migration fails; the previously running api/web containers were not stopped by the deploy workflow. **Seed (`db:seed`) is never run here.**
8. **Recreate api and web** — `docker compose up -d --no-build --force-recreate --remove-orphans api web` replaces the app containers using the images built in step 2. This step is only reached if backup and migration succeeded.
9. **Prune** — removes dangling Docker images.

### Smoke checks (after deploy step)

Each check uses a retry loop (30 attempts × 2 s = up to 60 s) so that timing/race
conditions between container startup and the check do not produce false failures.
On failure each check prints `docker compose ps` and recent container logs before exiting.

| Step | What is checked | How |
|------|-----------------|-----|
| API container running | `docker compose ps --status running` lists `api` | retry loop on server |
| API /health | HTTP 200 from `http://127.0.0.1:4000/health` | `wget --spider` from host, retry loop |
| API /ready | HTTP 200 from `http://127.0.0.1:4000/ready` | `wget --spider` from host, retry loop |
| Web container running | `docker compose ps --status running` lists `web` | retry loop on server |
| Web /ru | HTTP 200 from `http://127.0.0.1:3000/ru` | `wget --spider` from host, retry loop |
| Public root | HTTPS 307 from `https://rdevents.uz/` | `curl -I` from the VPS, retry loop |
| Public /ru | HTTPS 200 from `https://rdevents.uz/ru` | `curl -I` from the VPS, retry loop |
| Public API health | HTTPS 200 from `https://api.rdevents.uz/health` | `curl -I` from the VPS, retry loop |
| Web release marker | HTTP 200 from `https://rdevents.uz/version.txt` and `https://rdevents.uz/release.json`, body contains deployed commit SHA | `curl` from the VPS, retry loop |
| API release marker | HTTP 200 from `https://api.rdevents.uz/version` and `https://api.rdevents.uz/api/version`, body contains deployed commit SHA | `curl` from the VPS, retry loop |

If a public ingress check fails, the workflow prints the last public response headers, curl error, Docker Compose state, local upstream headers, readable nginx errors, and recent api/web logs.

The production API container CMD is `node dist/main.js`. It never runs `prisma migrate deploy` on startup. Migrations are exclusively the responsibility of the deploy workflow.

Seed data (`db:seed`) must never be run in production as part of the deploy. It is a local development tool only.

The deploy workflow must not run from `main`, feature branches, or PRs.

### Release marker contract

Every deployed image receives the same `RELEASE_SHA` build argument and runtime environment value. The web image writes it into static public files during Docker build; the API image writes it into `release.txt` and also exposes it through `RELEASE_SHA`. While the nginx static fallback aliases remain enabled, the deploy workflow also writes the same SHA to `$DEPLOY_ROOT/runtime/version.txt`, `$DEPLOY_ROOT/runtime/version`, and `$DEPLOY_ROOT/runtime/release.json` so the fallback cannot report a stale release.

Required app-level endpoints:

- Web: `GET /version.txt` returns `200 text/plain` with the deployed commit SHA.
- Web: `GET /release.json` returns `200 application/json` with the deployed commit SHA in `releaseSha`.
- API: `GET /version` returns `200 text/plain` with the deployed commit SHA.
- API: `GET /api/version` returns `200 text/plain` with the deployed commit SHA.

These endpoints must not depend on request headers, cookies, or other request-bound dynamic logic. Nginx may keep a static fallback as a safety layer, but the application endpoints are the primary contract and the deploy smoke checks validate that contract.

## GitHub Environment

Create GitHub Environment `production`.

Recommended settings:

- Required reviewers: enabled for the responsible release owner or release group
- Deployment branch policy: only `production`
- Environment secrets stored only in this environment

Current repository setting: `production` has custom deployment branch policy `production` and required reviewer `SRinatR`.

Required environment secrets:

- `PROD_HOST`
- `PROD_PORT`
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_ENV_FILE`

Production secrets must not be stored as broadly available repository secrets unless there is a specific operational reason. CI must not reference them.

## Branch Protection

These settings are configured in GitHub repository settings, not in workflow YAML.

### `main`

Required:

- Require a pull request before merging
- Require at least 1 approval for the normal contributor flow
- Require status checks to pass before merging
- Required checks:
  - `Type check`
  - `Lint`
  - `Test`
  - `Build`
- Block direct push
- Do not allow force pushes
- Do not allow branch deletion

Recommended:

- Dismiss stale approvals when new commits are pushed
- Do not allow bypassing for regular contributors

Current repository setting: owner/admin bypass is enabled for `main`. Regular contributors still go through PR, checks, and review; the owner can bypass branch protection when needed.

### `production`

`production` must be stricter than `main`.

Required:

- Require a pull request before merging
- Only accept release PRs from `main`
- Require at least 2 approvals or approval from the release owner group
- Require status checks to pass before merging
- Required checks:
  - `Type check`
  - `Lint`
  - `Test`
  - `Build`
- Restrict who can push to matching branches when the repository is in an organization
- Restrict who can dismiss reviews
- Block direct push
- Do not allow force pushes
- Do not allow branch deletion

Recommended:

- Allow manual bypass only for repository owners or admins
- Require conversation resolution before merging
- Require signed commits if the team uses signed commits consistently

Current repository setting: owner/admin bypass is enabled for `production`. Regular contributors still go through PR, 2 approvals, required checks, and the `production` environment reviewer; the owner can bypass branch protection for emergency release operations.

Note for `SRinatR/RDevents`: this is a personal repository. GitHub rejects user/team push restrictions for personal repositories with `Only organization repositories can have users and team restrictions`. The active stricter controls for `production` are 2 required approvals, required checks, blocked force push/delete for non-admin contributors, owner/admin bypass, and the `production` environment required reviewer. If the repository moves to an organization, enable push restrictions for the release owner group.

## Release Process

1. Developer creates `feature/*`, `fix/*`, or `hotfix/*`.
2. Developer opens a PR to `main`.
3. CI runs on the PR.
4. PR is reviewed and merged to `main` only after `Type check`, `Lint`, `Test`, and `Build` are green.
5. When a release is approved, open PR `main -> production`.
6. `production` PR goes through stricter review and required checks.
7. Merge to `production`.
8. Push to `production` starts `Deploy production`.
9. GitHub Environment `production` can require approval before the deploy job receives production secrets.
10. Deploy fails if SSH, Docker Compose, or any smoke check fails.

## Failure Triage

CI errors are in workflow `CI`.

- `Type check` failures are TypeScript or dependency install failures.
- `Lint` failures are ESLint violations or dependency install failures.
- `Test` failures are Vitest failures, test database startup failures, Prisma client generation failures, or dependency install failures.
- `Build` failures are production build failures.
- CI never means production deployment failed.

Deploy errors are in workflow `Deploy production`.

- `Validate production ref` means the workflow was started from the wrong branch.
- `Prepare SSH`, `Upload archive`, or `Write env file on server` means infrastructure or secret configuration failed.
- `Deploy on server` means the server-side deploy script failed. The failure message indicates the exact stage:
  - *Postgres did not become healthy* — postgres container failed to start or pass its health check; existing api/web containers were not stopped by the deploy workflow.
  - *pg_dump* error or empty backup file — backup failed; existing api/web containers were not stopped by the deploy workflow.
  - *prisma migrate deploy* error — migration failed; existing api/web containers were not stopped by the deploy workflow; restore from `$DEPLOY_ROOT/backups/` if needed.
  - Any other error after migration — api/web start failed but migration may have already been applied; check `docker compose ps` and logs on the server.
- `Smoke test - API container is running` / `Smoke test - Web container is running` — container did not reach running state within 60 s after `docker compose up`; check `docker compose ps` and logs on the server.
- `Smoke test - API health` / `Smoke test - API ready` — API process did not respond on port 4000 within 60 s; check API logs.
- `Smoke test - Web /ru` — web did not respond on port 3000 within 60 s; check web logs.
- `Smoke test - Public HTTPS ingress` — nginx, TLS, DNS, or public proxying did not return the expected public status codes even though local upstream checks may have passed.

## Production Runbook

Use absolute paths in manual production commands. Do not rely on `$DEPLOY_ROOT` in an interactive shell unless you have explicitly exported it.

### Safely start the site manually

```bash
cd /opt/rdevents/app
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml up -d api web
```

### Safely inspect production status

```bash
cd /opt/rdevents/app
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml ps -a
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml logs --tail=200 web
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml logs --tail=200 api
```

Do not run commands like this in a plain interactive shell:

```bash
docker compose --env-file "$DEPLOY_ROOT/.env" -f docker-compose.prod.yml up -d api web
```

If `DEPLOY_ROOT` is unset, that expands to `--env-file /.env` and can turn a recovery command into another outage. Use `/opt/rdevents/.env`.

### Diagnose a 502

1. Check whether app containers exist and are running:

   ```bash
   cd /opt/rdevents/app
   docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml ps -a
   ```

2. Check local upstreams from the VPS:

   ```bash
   curl -I http://127.0.0.1:3000/ru
   curl -I http://127.0.0.1:4000/health
   ```

3. Check recent app logs:

   ```bash
   docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml logs --tail=200 web
   docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml logs --tail=200 api
   ```

4. If local upstreams work but public HTTPS fails, inspect nginx:

   ```bash
   sudo nginx -t
   sudo tail -200 /var/log/nginx/error.log
   sudo tail -200 /var/log/nginx/access.log
   curl -I https://rdevents.uz/ru
   curl -I https://api.rdevents.uz/health
   ```

### Resend webhook

If Resend webhooks are enabled, configure the webhook URL as:

```text
https://api.rdevents.uz/webhooks/resend
```

Set `RESEND_WEBHOOK_SECRET` in the production environment file using the signing secret from the Resend webhook settings. Requests without a valid Svix signature are rejected. If Resend webhooks are not used, disable the webhook in Resend so production logs do not receive useless delivery attempts.

## Local Checks

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## Required Confirmation Checklist

Before considering release governance complete, confirm in GitHub Settings:

- Branch protection for `main` is enabled.
- Branch protection for `production` is enabled and stricter than `main`.
- Direct push to `main` is blocked.
- Direct push to `production` is blocked.
- Required checks are exactly `Type check`, `Lint`, `Test`, and `Build`.
- GitHub Environment `production` exists.
- Environment `production` has the required reviewers or protection rules.
- Environment `production` contains `PROD_HOST`, `PROD_PORT`, `PROD_USER`, `PROD_SSH_KEY`, and `PROD_ENV_FILE`.
