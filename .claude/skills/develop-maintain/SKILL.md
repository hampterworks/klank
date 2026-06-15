---
name: develop-maintain
description: Upgrades toolchain versions and migrates code to stricter types, removing escape hatches. Loads a stack reference (e.g. typescript). Use when bumping versions or migrating to stricter checks.
argument-hint: <stack>
---

# Maintaining and tightening a codebase

Upgrade and tighten in small, reviewable steps: enable one check at a time, fix a bounded set of errors, commit, repeat. Never flip every strict setting on a large codebase at once. Follow `dev-principles`: the toolchain's own check command plus a single config flag beat adding a migration framework.

Use when raising the toolchain/language version, moving an existing project toward strict, or stripping out escape hatches (`any`-equivalents, force-unwraps, unchecked casts). For a fresh config see `develop-configure`; for writing new idiomatic code see `develop-write`.

## Stack guidance

Load `references/typescript.md` for the target language's concrete syntax (add more stacks as reference files); with no file for the user's language, apply the guidance below and say so.

## Upgrading the toolchain version

1. Read the release notes between current and target versions; note breaking changes and new diagnostics (each release can surface new errors under existing flags).
2. Pin the toolchain to an exact or tightly-ranged version in dev dependencies; pin in CI for reproducibility.
3. Run the checker (no-emit / type-check only) and triage new errors - most are real bugs the newer checker now catches.
4. Update companion tooling that embeds a toolchain version (test runners, lint parsers, transpilers).
5. Adopt new strictness flags deliberately as separate commits; do not bundle a version bump with new strictness.

## Migrating to strict, incrementally

1. **Measure first.** Enable each candidate check alone and count the errors it produces. Zero/low-error checks go on immediately.
2. **Order by error count, ascending.** Land the cheap checks first; save the one that surfaces the most (usually null-safety) for last so earlier fixes are not redone.
3. **Per check:** enable, fix all errors, get a clean run, commit. Keep diffs small and reviewable; one check per PR on a big repo.
4. **Bound the blast radius** with include/exclude or split configs so strict applies to a subtree first, then widens. Avoid per-file migration plugins unless the repo is too large to flip a flag at once (extra tooling, per `dev-principles`).
5. **Track residual debt** with the checker's self-expiring suppression (one that errors once the underlying issue is fixed), never a silent blanket ignore that rots.
6. **Gate in CI** with the check command so a regression cannot reintroduce errors under the now-enabled check.

## Eliminating escape hatches safely

1. Find them: the checker surfaces implicit ones; grep for the explicit forms (`any`-equivalents, force-unwraps, unchecked casts).
2. Replace them at boundaries with an `unknown`-equivalent, then narrow with predicates or a validator before use (see `develop-write`).
3. Replace internal escape hatches with the real inferred or annotated type; let inference do the work where it can.
4. Where a cast is genuinely unavoidable (a validated factory, a well-known external shape), isolate it behind one small, named, commented function.
5. Once the count hits zero, forbid regressions with a lint rule.

## Gotchas

- Do not silence migration errors with a blanket ignore - that converts a tracked task into permanent hidden debt. Use a self-expiring suppression with a reason.
- Flipping all strictness on a big repo at once produces an unreviewable diff and stalls; incremental per-check PRs land.
- A version bump that "passes" only because errors were suppressed is not done; suppressions are debt, count them.
- Treat each new checker error after an upgrade as a likely latent bug, not noise to suppress.
