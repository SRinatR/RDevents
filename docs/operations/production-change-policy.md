# Production Change Policy (RDevents)

## Purpose

This policy defines how to ship changes safely to production with minimal blast radius, explicit rollback paths, and measurable go/no-go criteria.

## Core principles

1. **Rollback-first**: every production change must include a tested rollback plan.
2. **Small batches**: avoid combining schema-breaking, API contract, and UI behavior changes in one release.
3. **Feature flags by default**: risky behavior should be dark-launched and enabled gradually.
4. **Observe before expand**: canary and post-deploy observation window are mandatory for medium/high risk changes.
5. **No undocumented changes**: deployment-impacting behavior must be documented before release.

## Change categories

### C0 — Config-only
Examples: toggling existing feature flag, environment variable correction.

Required:
- peer review by 1 engineer;
- rollback instruction in PR;
- 15 min monitoring window.

### C1 — Code change, no schema impact
Examples: bugfix in API handler, UI visual adjustment, logging changes.

Required:
- peer review by 1 engineer;
- smoke tests pass;
- rollback commit identified;
- 30 min monitoring window.

### C2 — Schema-compatible release
Examples: additive columns/tables, backward-compatible API fields.

Required:
- peer review by 2 engineers (including backend owner);
- expand/contract migration plan;
- feature flag or compatibility guard;
- canary rollout;
- 60 min monitoring window.

### C3 — Schema-breaking / high-risk
Examples: dropping columns, changing auth/session semantics, critical routing changes.

Required:
- RFC approved by tech lead;
- staged rollout plan (at least 2 releases);
- explicit rollback procedure tested in staging;
- on-call owner present during rollout;
- 120 min monitoring window.

## Mandatory PR checklist

Every PR targeting production path must include:
- Change category (C0..C3)
- Blast radius (which users/endpoints)
- Feature flag name and default state
- Data migration plan (if any)
- Rollback plan (exact command/commit)
- Validation plan (health, ready, release markers, business checks)

## Release gate

A release is blocked unless all are true:
- CI checks pass;
- required reviewers approved;
- rollback plan present;
- deploy runbook steps acknowledged by deployer;
- post-deploy monitor owner assigned.

## Rollout strategy

1. Deploy in dark mode (flag off) where possible.
2. Enable for internal/admin users first.
3. Expand to partial audience (canary).
4. Expand to full audience only if SLI remains within thresholds.

## Rollback triggers

Immediate rollback if any occurs:
- sustained 5xx increase above baseline threshold;
- auth success rate drop;
- registration success rate drop;
- failed health/ready/release marker checks;
- data integrity risk signals.

## Coordination protocol (3+ simultaneous programmers)

- Keep one **Release Captain** per deployment window.
- Use ownership map by domain:
  - Auth/Profile
  - Events/Teams
  - Admin/Backoffice
  - Infra/Deploy
- Freeze cross-domain refactors during active incident or hotfix window.
- Merge order:
  1) infrastructure/observability,
  2) additive backend contracts,
  3) frontend consumers,
  4) cleanup/removal.

## Definition of done for production-safe changes

A change is considered done only when:
- code merged;
- production verification completed;
- monitoring window passed;
- docs/runbooks updated.
