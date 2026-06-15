---
name: qa-vet
description: Evaluates and maintains third-party dependencies across their lifecycle - adoption vetting, health and security audits, updates, pruning. Use when adding or auditing a dependency.
---

# Dependency lifecycle management

Govern third-party dependencies from adoption to retirement: vet before adding, keep healthy while in use, remove when no longer justified. Applies `dev-principles` ("dependencies are a liability") and `security-principles` ("secure the supply chain") to the dependency graph itself.

Use when evaluating a new dependency or auditing existing ones for health, security, and necessity. For bumping toolchain versions and migrating code see `develop-maintain`; for CI runner and action updates see `cicd-maintain`.

## Evaluate before adopting

1. **Justify existence.** Can the standard library or an already-present dependency do it? The cheapest dependency is the one not added; reject when the need is trivial or one-off.
2. **Vet health.** Release recency and cadence, open-issue triage, maintainer count and bus factor, real adoption, and an actual changelog. Abandoned or single-maintainer-critical is a risk.
3. **Vet security and license.** `pnpm audit`-clean (or the stack's equivalent), no known unpatched CVEs, license compatible with the project, transitive weight reasonable.
4. **Weigh cost.** Install/bundle size, transitive count, native build steps, supply-chain surface. Pin to a current stable version with an immutable lockfile entry.
5. **Record the decision.** One line on why this one over the alternatives, so the next person does not re-litigate it.

## Maintain while in use

1. **Track advisories.** Watch CVEs and deprecations on what is installed; a security advisory is priority work, not backlog.
2. **Update deliberately.** Read the changelog, batch low-risk patch/minor bumps, isolate majors for migration. Each bump goes green through the suite before merge - a dependency update is a behavior change.
3. **Keep the lockfile honest.** Single source of truth, no drift, no unpinned ranges in production.
4. **Prune routinely.** Remove unused and redundant dependencies; collapse two libraries doing one job. Dead dependencies are live attack surface.
5. **Track end-of-life.** Flag dependencies nearing EOL or going unmaintained and plan replacement before it becomes forced.

## Adopt / keep / drop

- **Adopt** - justified need, healthy, audit-clean, license-compatible, cost acceptable.
- **Keep** - in use, maintained, no unpatched advisories, still the simplest option.
- **Drop** - unused, redundant, abandoned, or the need is gone; remove it and reclaim the surface.

## Gotchas

- "It is just one small package" still adds transitive weight, a supply-chain entry point, and a maintenance tail; count the whole tree, not the one line.
- A green build after an update is necessary, not sufficient; behavior and security can change without a test failing.
- Pinning and never updating is its own risk - stale dependencies accumulate unpatched CVEs. Pin and patch, do not pin and forget.
- Popularity is not health; a high-download package can be unmaintained. Check the cadence, not the star count.
- Unused dependencies are not free; they widen attack surface and slow installs. Prune them.
