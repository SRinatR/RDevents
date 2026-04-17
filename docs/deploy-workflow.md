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
- deploys with Docker Compose on the server
- writes `.release-commit` with the deployed commit SHA
- runs smoke checks for API, web, `/health`, `/ready`, and web root

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
- `Deploy on server` means Docker Compose deployment failed.
- `Smoke test ...` means deployment finished but the expected service check failed.

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
