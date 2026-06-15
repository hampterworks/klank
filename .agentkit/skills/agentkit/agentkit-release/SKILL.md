---
name: agentkit-release
description: Regenerates the CATALOG index and prepares a versioned release of the agent-content repo. Use when cutting a release or after a batch of content changes.
---

# Releasing

Cut a clean, in-sync release of the content library.

## Steps

1. `pnpm validate` and `pnpm check` are green; `pnpm budgets` is under the ceiling.
2. `pnpm agentkit catalog` to refresh `CATALOG.md` (the L0 routing index).
3. Bump the version and update the changelog with notable content additions/changes.
4. Tag the release; commit source + regenerated outputs together.

## Gotchas

- A release must be fully regenerated - never tag with drift (`pnpm check` failing).
- Keep `CATALOG.md` small: it is always-loaded routing, so it lists names + one-line descriptions only.
