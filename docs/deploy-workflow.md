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
- `pull_request` to `production`
- `push` to `main`
- `push` to `feature/**`
- `push` to `fix/**`
- `push` to `hotfix/**`
- `workflow_dispatch`

Jobs:

- `Lint`: installs dependencies and runs `pnpm lint`
- `Shell validation`: validates host script syntax and runtime redaction smoke test
- `Typecheck`: installs dependencies, generates Prisma client, and runs `pnpm typecheck` on the GitHub runner
- `Test`: starts PostgreSQL as a GitHub Actions service on the runner, generates Prisma client, and runs `pnpm test`
- `Build`: installs dependencies, generates Prisma client, and runs `pnpm build` on the GitHub runner
- `Docker Build`: builds API and Web Docker images using Docker Compose
- `Container Smoke`: starts postgres/api/web via Docker Compose and validates the production-like runtime contract inside compose topology

Runtime policy:

- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- project Node.js runtime is `24`
- pnpm is installed before `actions/setup-node` enables `cache: pnpm`
- `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` must not be used

Concurrency:

- old CI runs for the same PR or branch are cancelled with `cancel-in-progress: true`

Required status checks for branch protection:

- `Lint`
- `Shell validation`
- `Typecheck`
- `Test`
- `Build`
- `Docker Build`
- `Container Smoke`
- `Required Checks`

Use the exact check-run names reported by GitHub API. In the PR UI these checks are shown under the workflow as `CI / Lint`, `CI / Shell validation`, `CI / Typecheck`, `CI / Test`, `CI / Build`, `CI / Docker Build`, `CI / Container Smoke`, and `CI / Required Checks`; branch protection stores the check names as `Lint`, `Shell validation`, `Typecheck`, `Test`, `Build`, `Docker Build`, `Container Smoke`, and `Required Checks`. The `Required Checks` aggregator job confirms all upstream jobs passed; individual job results are `Lint`, `Shell validation`, `Typecheck`, `Test`, `Build`, `Docker Build`, and `Container Smoke`.

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
- validates that production `DATABASE_URL` uses `postgres:5432` as the host (inside docker-compose network, not `127.0.0.1` or `localhost`); the deploy aborts before migration if the host is wrong
- runs `pnpm prisma:deploy` only after the backup succeeds and DATABASE_URL validation passes
- recreates API and web with Docker Compose only after backup and migrations succeed
- updates runtime fallback files in `/opt/rdevents/runtime/`
- runs `nginx -t` and `systemctl reload nginx` after runtime files are updated
- fails the deploy if any required release marker endpoint does not return the new SHA
- runs smoke checks for API, web, `/health`, `/ready`, web `/ru`, release markers, and public HTTPS ingress

### Deploy sequence

The deploy step on the server follows this exact order to keep the database safe:

1. **Unpack release** — extract the archive into `$APP_DIR`, write `.release-commit`.
2. **Build images** — `docker compose build` builds all new images before any running container is touched.
3. **Keep current api and web running** — the deploy does not stop app containers before backup and migration. If any risky step fails, the old site keeps serving traffic.
4. **Start postgres** — `docker compose up -d postgres` ensures postgres is up without touching api/web.
5. **Wait for postgres healthy** — polls the postgres container health status with `docker inspect` for up to 60 seconds; aborts the deploy if postgres does not become healthy. This checks the Docker health check (`pg_isready -U <user> -d <db>`) rather than a bare TCP probe, confirming the correct user and database are accepting connections.
6. **Backup** — runs `pg_dump | gzip` inside the postgres container using the container's own `POSTGRES_USER` and `POSTGRES_DB`, then writes the compressed dump to `$DEPLOY_ROOT/backups/pre-migrate-<timestamp>.sql.gz`. The deploy aborts if the backup fails or the file is empty.
7. **Validate DATABASE_URL** — before running migrations, the deploy validates that `$DEPLOY_ROOT/.env` contains `DATABASE_URL` with host `postgres:5432` (not `127.0.0.1`, not `localhost`). Prisma connects from inside the `api` container, where `postgres` resolves to the database service in the Docker Compose network. The deploy aborts immediately if the host is wrong.
8. **Migrate** — runs `pnpm prisma:deploy` inside a one-off API container (`docker compose run --rm --no-deps api`). The deploy aborts if any migration fails; the previously running api/web containers were not stopped by the deploy workflow. **Seed (`db:seed`) is never run here.**
9. **Clean mock data** — runs `pnpm run db:cleanup-mock` in the production API container. This removes old demo/example users and seeded event data, then promotes `rinat200355@gmail.com` to `SUPER_ADMIN`; the command refuses to run outside `NODE_ENV=production` unless explicitly overridden.
10. **Recreate api and web** — `docker compose up -d --no-build --force-recreate --remove-orphans api web` replaces the app containers using the images built in step 2. This step is only reached if backup, migration, and mock cleanup succeeded.
11. **Update runtime fallbacks** — writes the deployed SHA into `/opt/rdevents/runtime/version.txt`, `/opt/rdevents/runtime/version`, and `/opt/rdevents/runtime/release.json`.
12. **Validate and reload nginx** — runs `nginx -t` and then `systemctl reload nginx` so nginx fallback aliases pick up the fresh runtime files.
13. **Verify release markers** — the deploy is considered failed unless all required SHA endpoints return the new release after reload.
14. **Prune** — removes dangling Docker images.

### Production .env contract

The production `.env` file at `/opt/rdevents/.env` must define these variables:

```env
# PostgreSQL container credentials
POSTGRES_DB=event_platform
POSTGRES_USER=event_platform_user
POSTGRES_PASSWORD=<strong-random-secret>

# Database URL — CRITICAL: host must be "postgres", not "127.0.0.1" or "localhost"
# Prisma connects from inside the api container where "postgres" resolves via Docker DNS.
DATABASE_URL=postgresql://event_platform_user:<password>@postgres:5432/event_platform?schema=public

# JWT secrets (min 32 chars each)
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>

# App URL for production
APP_URL=https://rdevents.uz
CORS_ORIGIN=https://rdevents.uz
NEXT_PUBLIC_API_BASE_URL=https://api.rdevents.uz

# Other required vars (defaults are set in docker-compose.prod.yml if missing)
DEFAULT_LOCALE=ru
PORT=4000
```

**Why `postgres` and not `127.0.0.1`/`localhost`?**

In Docker Compose, each service is reachable by its service name from within the default network. The `api` container runs `node dist/main.js`, which uses Prisma to connect to the database. Prisma makes a TCP connection from inside the `api` container — it does not resolve `127.0.0.1` or `localhost` to the postgres container. Those addresses refer to the `api` container itself.

The deploy workflow and the API startup guard (in `services/api/src/config/env.ts`) both validate that `DATABASE_URL` does not contain `@127.0.0.1:` or `@localhost:` when `NODE_ENV=production`. If the wrong host is detected, the deploy aborts before migrations and the API throws a startup error.

**Only the `container-smoke` job mirrors production topology.**
It runs postgres, migrations, api, and web inside the docker-compose network and therefore uses `DATABASE_URL` with `@postgres:5432/`.

Runner-based CI jobs (`typecheck`, `test`, `build`) are not proof of compose-network reachability and must not be described as identical to production topology.

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
| Required SHA check 1 | HTTP 200 from `http://127.0.0.1:3000/version.txt`, body equals the deployed commit SHA | `curl` from the VPS, retry loop, blocking |
| Required SHA check 2 | HTTP 200 from `http://127.0.0.1:4000/version`, body equals the deployed commit SHA | `curl` from the VPS, retry loop, blocking |
| Required SHA check 3 | HTTP 200 from `https://rdevents.uz/version.txt`, body equals the deployed commit SHA after nginx reload | `curl` from the VPS, retry loop, blocking |
| Required SHA check 4 | HTTP 200 from `https://api.rdevents.uz/version`, body equals the deployed commit SHA after nginx reload | `curl` from the VPS, retry loop, blocking |
| Web release marker | HTTP 200 from `https://rdevents.uz/release.json`, body contains deployed commit SHA in `releaseSha` | `curl` from the VPS, retry loop |
| API compatibility marker | HTTP 200 from `https://api.rdevents.uz/api/version`, body contains deployed commit SHA. This remains a compatibility path and may warn while nginx does not route that path. | `curl` from the VPS, retry loop |

If a public ingress check fails, the workflow prints the last public response headers, curl error, Docker Compose state, local upstream headers, readable nginx errors, and recent api/web logs.

The production API container CMD is `node dist/main.js`. It never runs `prisma migrate deploy` on startup. Migrations are exclusively the responsibility of the deploy workflow.

Seed data (`db:seed`) must never be run in production as part of the deploy. It is a local development tool only and fails under `NODE_ENV=production`.

The deploy workflow must not run from `main`, feature branches, or PRs.

### Release marker contract

The primary release contract is the application-level endpoints, not the nginx static aliases. Runtime fallback files are a safety net, not a source of truth.

**Primary release contract:**

| Endpoint | Service | Format | Purpose |
|----------|---------|--------|---------|
| `GET /release.json` | API | JSON | Primary release marker for API service |
| `GET /api/release.json` | API | JSON | API release marker under /api prefix |
| `GET /release.json` | Web | JSON | Primary release marker for Web service |
| `GET <locale>/` HTML | Web | `<meta name="app-release-sha">` | Release marker embedded in HTML |

**JSON response shape:**
```json
{
  "service": "event-platform-api",
  "releaseSha": "<sha>",
  "environment": "<NODE_ENV>"
}
```

**HTML meta marker:**
```html
<meta name="app-release-sha" content="<sha>" />
```

**Legacy compatibility (temporary, not source of truth):**

| Endpoint | Service | Format | Notes |
|----------|---------|--------|-------|
| `GET /version.txt` | Web | Plain text | Static file, nginx alias fallback |
| `GET /version` | API | Plain text | Static file, nginx alias fallback |
| `GET /api/version` | API | Plain text | Compatibility path |

**Runtime fallback files** (`/opt/rdevents/runtime/`):

- `version.txt`, `version`, `release.json`
- These are nginx static aliases used as a safety net
- They are updated after application verification passes
- They are **not** the source of truth for deploy success

**Deploy success criteria:**

A deploy is successful only when:

1. `GET /release.json` on API (local and public) returns the new SHA
2. `GET /release.json` on Web (local and public) returns the new SHA
3. HTML at `/ru` contains `app-release-sha` meta with the new SHA

Version.txt and version files remain as legacy compatibility, but they are no longer the primary gate for deploy success.

### CI container-smoke job

The CI workflow includes a `container-smoke` job that runs after `docker-build`:

- Starts postgres via Docker Compose
- Runs database migrations
- Starts API and Web containers
- Verifies runtime contract:
  - API `/release.json` SHA matches `RELEASE_SHA`
  - Web `/release.json` SHA matches `RELEASE_SHA`
  - HTML meta `app-release-sha` matches `RELEASE_SHA`
  - `/health` and `/ready` endpoints respond correctly
  - `/ru` and `/ru/events` pages respond correctly

The `container-smoke` job is a required check in `required-checks`. This ensures the containerized application passes runtime verification before any production deploy.

**Required status checks for branch protection:**

- `Lint`
- `Shell validation`
- `Typecheck`
- `Test`
- `Build`
- `Docker Build`
- `Container Smoke`
- `Required Checks`

### Legacy compatibility markers

The following endpoints remain enabled as legacy compatibility:

- `GET /version.txt` — Web static file (nginx alias to `/opt/rdevents/runtime/version.txt`)
- `GET /version` — API static file (nginx alias to `/opt/rdevents/runtime/version`)
- `GET /api/version` — API compatibility path

These are **not** the source of truth and are no longer the primary release gate. They may return stale values briefly during deploy if nginx reload timing is unfavorable. Always use the primary release contract endpoints above for release verification.

## Manual Recovery Script

File: `manual-deploy.sh`

This script provides a single-command fallback deploy path for the VPS. It performs the same critical production order as the workflow:

- clones the target ref into a temporary staging directory, defaulting to `production`
- resolves the exact release SHA from the staged source
- replaces `/opt/rdevents/app` with the staged release contents
- builds production images
- starts postgres and waits for health
- creates a pre-migration database backup
- runs `prisma migrate deploy`
- recreates API and web containers
- updates `/opt/rdevents/runtime/version.txt`, `/opt/rdevents/runtime/version`, and `/opt/rdevents/runtime/release.json`
- runs `nginx -t`
- runs `systemctl reload nginx`
- verifies the four required SHA endpoints before reporting success

Example:

```bash
cd /opt/rdevents/app
bash ./manual-deploy.sh
```

Deploy a specific ref:

```bash
cd /opt/rdevents/app
bash ./manual-deploy.sh production
```

Override the repository URL if the server should pull from a different remote:

```bash
cd /opt/rdevents/app
REPO_URL=git@github.com:SRinatR/RDevents.git bash ./manual-deploy.sh production
```

## GitHub Environment

Create GitHub Environment `production`.

Recommended settings:

- Required reviewers: enabled for the responsible release owner or release group
- Deployment branch policy: only `production`
- Environment secrets stored only in this environment

Repository settings must be configured so that `production` has custom deployment branch policy `production` and required reviewer `SRinatR`.

Required environment secrets:

- `PROD_HOST`
- `PROD_PORT`
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_ENV_FILE`

`PROD_ENV_FILE` must contain a `DATABASE_URL` with the Docker Compose service name as host, not `127.0.0.1` or `localhost`. Prisma connects from inside the `api` container, so it must resolve `postgres` via the compose network:

```
DATABASE_URL=postgresql://event_platform_user:event_platform_password@postgres:5432/event_platform?schema=public
```

The deploy workflow validates this before running migrations and aborts if the host is not `postgres:5432`.

### Production .env Contract

The production `.env` (`PROD_ENV_FILE`) must contain the following variables. This contract is enforced by the deploy workflow preflight check, the manual deploy script, and the API runtime startup guard.

**Database (compose network only):**

```bash
# These three must be consistent — docker-compose.prod.yml uses them for the postgres service.
POSTGRES_DB=event_platform
POSTGRES_USER=event_platform_user
POSTGRES_PASSWORD=<secure-password>

# DATABASE_URL uses @postgres:5432 — the compose service name, not 127.0.0.1 or localhost.
# This URL is consumed by the api container inside the compose network; it must resolve
# `postgres` via Docker's internal DNS. External access to postgres does not affect this URL.
DATABASE_URL=postgresql://event_platform_user:<password>@postgres:5432/event_platform?schema=public
```

**Why `postgres:5432` and not `127.0.0.1` or `localhost`:**

From inside any container in `docker-compose.prod.yml`, the service name `postgres` resolves to the database container via Docker's internal DNS. `127.0.0.1` and `localhost` inside a container refer to the container itself, not the database — Prisma will fail with `P1001: Can't reach database server at 127.0.0.1:5432`.

The `DATABASE_URL` in production is exclusively an intra-compose-network address. External postgres access (e.g. `psql` from the host or a remote client) uses a different connection path and does not affect the runtime `DATABASE_URL`.

## Branch Protection

Repository settings must be configured so that:

### `main`

- Require a pull request before merging
- Require at least 1 approval for the normal contributor flow
- Require status checks to pass before merging
- Required checks:
  - `Lint`
  - `Shell validation`
  - `Typecheck`
  - `Test`
  - `Build`
  - `Docker Build`
  - `Container Smoke`
  - `Required Checks`
- Block direct push
- Do not allow force pushes
- Do not allow branch deletion
- Dismiss stale approvals when new commits are pushed
- Do not allow bypassing for regular contributors
- Owner/admin bypass is enabled for emergency operations

### `production`

`production` must be stricter than `main`.

Recommended configuration:

- Require a pull request before merging
- Only accept release PRs from `main`
- Require at least 2 approvals or approval from the release owner group
- Require status checks to pass before merging
- Required checks:
  - `Lint`
  - `Shell validation`
  - `Typecheck`
  - `Test`
  - `Build`
  - `Docker Build`
  - `Container Smoke`
  - `Required Checks`
- Restrict who can push to matching branches when the repository is in an organization
- Restrict who can dismiss reviews
- Block direct push
- Do not allow force pushes
- Do not allow branch deletion
- Require conversation resolution before merging
- Require signed commits if the team uses signed commits consistently
- Owner/admin bypass is enabled for emergency release operations

The `Required Checks` aggregator job is included in required checks and confirms all individual jobs passed.

## Release Process

1. Developer creates `feature/*`, `fix/*`, or `hotfix/*`.
2. Developer opens a PR to `main`.
3. CI runs on the PR.
4. PR is reviewed and merged to `main` only after `Lint`, `Shell validation`, `Typecheck`, `Test`, `Build`, `Docker Build`, `Container Smoke`, and `Required Checks` are green.
5. When a release is approved, open PR `main -> production`.
6. `production` PR goes through stricter review and required checks.
7. Merge to `production`.
8. Push to `production` starts `Deploy production`.
9. GitHub Environment `production` can require approval before the deploy job receives production secrets.
10. Deploy fails if SSH, Docker Compose, or any smoke check fails.

## Failure Triage

CI errors are in workflow `CI`.

- `Lint` failures are ESLint violations or dependency install failures.
- `Shell validation` failures are host script syntax errors or redaction smoke test failures.
- `Typecheck` failures are TypeScript or dependency install failures.
- `Test` failures are Vitest failures, test database startup failures, Prisma client generation failures, or dependency install failures.
- `Build` failures are production build failures.
- `Docker Build` failures are Docker image build failures.
- `Container Smoke` failures are runtime contract failures inside the Docker Compose topology.
- `Required Checks` failures mean at least one upstream job did not pass.
- CI never means production deployment failed.

Deploy errors are in workflow `Deploy production`.

- `Validate production ref` means the workflow was started from the wrong branch.
- `Prepare SSH`, `Upload archive`, or `Write env file on server` means infrastructure or secret configuration failed.
- `Deploy on server` means the server-side deploy script failed. The failure message indicates the exact stage:
  - *Postgres did not become healthy* — postgres container failed to start or pass its health check; existing api/web containers were not stopped by the deploy workflow.
  - *pg_dump* error or empty backup file — backup failed; existing api/web containers were not stopped by the deploy workflow.
  - *production DATABASE_URL must use host 'postgres:5432'* — `DATABASE_URL` in `$DEPLOY_ROOT/.env` contains `127.0.0.1`, `localhost`, or any host other than `postgres:5432`. Fix the `PROD_ENV_FILE` secret in the GitHub `production` environment and re-run the deploy.
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

### Docker Compose networking rule

Inside the API container, `127.0.0.1` and `localhost` do not reach the database. Postgres is available at the service name `postgres` from any container in the compose network.

Production `DATABASE_URL` must use `@postgres:5432`:
```
DATABASE_URL=postgresql://event_platform_user:event_platform_password@postgres:5432/event_platform?schema=public
```

Using `127.0.0.1` or `localhost` in production causes Prisma to fail with `P1001: Can't reach database server at 127.0.0.1:5432`.

### Standard production compose commands

Always use explicit absolute paths and the correct compose file:

```bash
cd /opt/rdevents/app

# Start postgres (from compose network)
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml up -d postgres

# Run migrations (from compose network)
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml \
  run --rm --no-deps --entrypoint sh api -lc 'cd /app/services/api && pnpm exec prisma migrate deploy'

# Start app containers
docker compose --env-file /opt/rdevents/.env -f docker-compose.prod.yml up -d api web
```

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

## Operator Scripts

Canonical operator scripts are in `scripts/ops/`. These scripts provide repeatable, tested recovery paths.

### `scripts/ops/prod-smoke.sh`

Smoke test after deploy or as a periodic health check.

```bash
cd /opt/rdevents/app
bash ./scripts/ops/prod-smoke.sh [sha]
```

- Without arguments: checks `/health`, `/ready`, and prints current release SHAs
- With SHA argument: additionally verifies web and API return the expected SHA

### `scripts/ops/prod-force-switch-latest.sh`

Force recreate containers when images are already built but containers are stale.

```bash
cd /opt/rdevents/app
bash ./scripts/ops/prod-force-switch-latest.sh <sha>
```

This script:
1. Runs `prisma migrate deploy` (one-off container)
2. Runs `docker compose up -d --force-recreate --remove-orphans api web`
3. Verifies `/release.json` on both local endpoints

**Use this only when images are already built and you need to switch containers without a full re-deploy.**

## Deploy State and Artifact Reference

### `deploy-state.json`

Location: `/opt/rdevents/runtime/deploy-state.json`

Written by the deploy workflow after each stage transition. Format:

```json
{
  "releaseSha": "ad2459585ab33709e7b66d0bc036e2010dd4cd52",
  "status": "success",
  "stage": "success",
  "ts": "2026-04-24T11:30:00.000Z"
}
```

**Stage values in order of execution:**

| Stage | Meaning |
|-------|---------|
| `init` | Deploy started, archive unpacked |
| `build-images` | `docker compose build` in progress |
| `capture-built-image-ids` | Built image IDs captured for verification |
| `migrate` | `prisma migrate deploy` running |
| `recreate-api-web` | `docker compose up -d --force-recreate` executed |
| `wait-api-healthy` | Polling api container health |
| `wait-web-healthy` | Polling web container health |
| `verify-running-image-ids` | Verifying running containers use built images |
| `local-verification` | Local SHA endpoint verification |
| `sync-runtime-fallback` | Writing `/opt/rdevents/runtime/` fallback files |
| `reload-nginx` | `systemctl reload nginx` executed |
| `public-verification` | Public HTTPS endpoint verification |
| `finalize-success` | Writing `.release-commit` |
| `success` | All checks passed |
| `<stage_name>` + `failed` | Stage failed (status = `failed`) |

### Server artifacts

| Path | Contents |
|------|----------|
| `/opt/rdevents/runtime/deploy-state.json` | Current deploy state |
| `/opt/rdevents/app/.release-commit` | Deployed commit SHA |
| `/opt/rdevents/deploy-logs/` | Per-deploy log files |
| `/opt/rdevents/backups/` | Pre-migration DB backups |

### GitHub Actions post-deploy summary

After a successful deploy, the `Deploy production` workflow includes a `Read deploy result from server` step that shows:

- `deploy-state.json` (final state)
- `.release-commit` (deployed SHA)
- Running Docker image IDs for `app-api-1` and `app-web-1`
- Public release JSON from `https://rdevents.uz/release.json` and `https://api.rdevents.uz/release.json`

## Troubleshooting Scenarios

### New images built, running containers are old

Symptoms: Docker images were rebuilt successfully, but public endpoints return old SHA.

Cause: Containers were not restarted after image build, or `docker compose up -d` was not executed.

Resolution:

```bash
cd /opt/rdevents/app
bash ./scripts/ops/prod-force-switch-latest.sh <expected_sha>
```

### `.release-commit` is missing

Symptoms: File `/opt/rdevents/app/.release-commit` does not exist after deploy.

Cause: Deploy failed at `finalize-success` stage or was interrupted.

Resolution:
1. Check `deploy-state.json` for the failed stage
2. Check deploy logs in `/opt/rdevents/deploy-logs/`
3. If migration and images are fine, write the file manually:

   ```bash
   cd /opt/rdevents/app
   printf '%s\n' "<sha>" > .release-commit
   ```

4. Then run smoke test:

   ```bash
   bash ./scripts/ops/prod-smoke.sh <sha>
   ```

### Public release endpoint returns old SHA

Symptoms: `curl https://rdevents.uz/release.json` or `https://api.rdevents.uz/release.json` returns stale SHA.

Cause: Nginx is serving cached or old runtime fallback files, or containers are running old images.

Resolution:
1. Verify containers are running correct images:

   ```bash
   docker inspect app-api-1 --format 'api={{.Image}}'
   docker inspect app-web-1 --format 'web={{.Image}}'
   ```

2. Check `.release-commit` matches expected SHA

3. Reload nginx:

   ```bash
   sudo systemctl reload nginx
   ```

4. Wait 10 seconds and retry public endpoints

5. If still stale, check `/opt/rdevents/runtime/release.json` on server:

   ```bash
   cat /opt/rdevents/runtime/release.json
   ```

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
