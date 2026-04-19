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
- `Build`: installs dependencies and runs `pnpm build`

Runtime policy:

- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
- project Node.js runtime is `24`
- pnpm is installed before `actions/setup-node` enables `cache: pnpm`
- `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` must not be used

Concurrency:

- old CI runs for the same PR or branch are cancelled with `cancel-in-progress: true`

Required status checks for branch protection:

- `Type check`
- `Build`

Use the exact check-run names reported by GitHub API. In the PR UI these checks are shown under the workflow as `CI / Type check` and `CI / Build`; branch protection stores the check names as `Type check` and `Build`. If GitHub UI shows old entries such as `CI/Build` or `CI/Type check`, remove them and select the current checks above.

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
- runs smoke checks for API, web, `/health`, `/ready`, and web root

### Deploy sequence

The deploy step on the server follows this exact order to keep the database safe:

1. **Unpack release** — extract the archive into `$APP_DIR`, write `.release-commit`.
2. **Build images** — `docker compose build` builds all new images before any running container is touched.
3. **Stop app containers** — `docker compose stop api web` stops the API and web containers. Postgres is left running; the `postgres_data` named volume is never removed.
4. **Start postgres** — `docker compose up -d postgres` ensures postgres is up.
5. **Wait for postgres healthy** — polls `docker compose ps --status healthy` for up to 60 seconds; aborts the deploy if postgres does not become healthy. This checks the Docker health check (`pg_isready -U <user> -d <db>`) rather than a bare TCP probe, confirming the correct user and database are accepting connections.
6. **Backup** — runs `pg_dump | gzip` inside the postgres container and writes the compressed dump to `$DEPLOY_ROOT/backups/pre-migrate-<timestamp>.sql.gz`. The deploy aborts if the backup fails.
7. **Migrate** — runs `pnpm prisma:deploy` inside a one-off API container (`docker compose run --rm --no-deps api`). The deploy aborts if any migration fails; postgres still holds the pre-migration data and the backup is available for restore. **Seed (`db:seed`) is never run here.**
8. **Start api and web** — `docker compose up -d --no-build api web` starts the app containers using the images built in step 2. This step is only reached if migration succeeded.
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

The production API container CMD is `node dist/main.js`. It never runs `prisma migrate deploy` on startup. Migrations are exclusively the responsibility of the deploy workflow.

Seed data (`db:seed`) must never be run in production as part of the deploy. It is a local development tool only.

The deploy workflow must not run from `main`, feature branches, or PRs.

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
4. PR is reviewed and merged to `main` only after `Type check` and `Build` are green.
5. When a release is approved, open PR `main -> production`.
6. `production` PR goes through stricter review and required checks.
7. Merge to `production`.
8. Push to `production` starts `Deploy production`.
9. GitHub Environment `production` can require approval before the deploy job receives production secrets.
10. Deploy fails if SSH, Docker Compose, or any smoke check fails.

## Failure Triage

CI errors are in workflow `CI`.

- `Type check` failures are TypeScript or dependency install failures.
- `Build` failures are production build failures.
- CI never means production deployment failed.

Deploy errors are in workflow `Deploy production`.

- `Validate production ref` means the workflow was started from the wrong branch.
- `Prepare SSH`, `Upload archive`, or `Write env file on server` means infrastructure or secret configuration failed.
- `Deploy on server` means the server-side deploy script failed. The failure message indicates the exact stage:
  - *Postgres did not become healthy* — postgres container failed to start or pass its health check; api and web were never started.
  - *pg_dump* error — backup failed; api and web were never started; database is unchanged.
  - *prisma migrate deploy* error — migration failed; api and web were never started; database is in the pre-migration state; restore from `$DEPLOY_ROOT/backups/` if needed.
  - Any other error after migration — api/web start failed but migration may have already been applied; check `docker compose ps` and logs on the server.
- `Smoke test - API container is running` / `Smoke test - Web container is running` — container did not reach running state within 60 s after `docker compose up`; check `docker compose ps` and logs on the server.
- `Smoke test - API health` / `Smoke test - API ready` — API process did not respond on port 4000 within 60 s; check API logs.
- `Smoke test - Web /ru` — web did not respond on port 3000 within 60 s; check web logs.

## Local Checks

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

## Required Confirmation Checklist

Before considering release governance complete, confirm in GitHub Settings:

- Branch protection for `main` is enabled.
- Branch protection for `production` is enabled and stricter than `main`.
- Direct push to `main` is blocked.
- Direct push to `production` is blocked.
- Required checks are exactly `Type check` and `Build`.
- GitHub Environment `production` exists.
- Environment `production` has the required reviewers or protection rules.
- Environment `production` contains `PROD_HOST`, `PROD_PORT`, `PROD_USER`, `PROD_SSH_KEY`, and `PROD_ENV_FILE`.
