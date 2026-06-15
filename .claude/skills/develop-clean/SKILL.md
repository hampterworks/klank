---
name: develop-clean
description: Cleans up code at a chosen intensity/latitude over a scope (diff/area/repo) - simplify, de-cruft. Loads a stack reference. Use when tidying, not reviewing or strictness upgrades (develop-maintain).
argument-hint: "<scope: diff|area|repo> <intensity: light|standard|exhaustive> <latitude: none|safe|free>"
---

# Cleaning up code

Improve existing code's quality without changing what it does (unless explicitly allowed), at a dial-able effort and risk. This is the active application of `dev-principles` (least code) to code that already exists - cut the bloat, keep the guardrail.

Use to tidy or refactor existing code. To find what to fix see `develop-review`; for version/strictness upgrades see `develop-maintain`; for new code see `develop-write`.

## Parameters

Confirm all three before starting; if unspecified, default to `diff` / `standard` / `safe` and say so.

- **Scope** - how much code: `diff` (the current PR/change), `area` (a module or directory), or `repo` (the whole codebase). Larger scope is worked in reviewable batches, not one diff.
- **Intensity** - how hard to look:
  - `light` - obvious quick wins only: dead code, unused imports/vars, formatting the formatter missed, trivial renames.
  - `standard` - plus de-duplicate, simplify expressions and control flow, tighten types locally (behavior-preserving narrowing; project-wide strict-flag migration is `develop-maintain`), small local extractions, swap a hand-rolled bit for a stdlib or existing helper.
  - `exhaustive` - every smell: naming, cohesion, comments, error handling, micro-redundancy; examine each line. Slow and thorough.
- **Latitude** - how much structure may change:
  - `none` - in place only; no signature, public API, or file-structure changes. Smallest diff, lowest risk.
  - `safe` - behavior-preserving refactors: extract/inline/move within existing boundaries, rename internals; public API unchanged.
  - `free` - anything, including API, structure, or dependency changes, provided the tests prove behavior is preserved.

## Process

1. **Confirm the three dials** (the stack is auto-detected from the code). State the defaults if the user did not.
2. **Establish a green baseline.** Run the tests and type-check/build first - no baseline, no cleanup, because you cannot prove you preserved behavior. If tests are missing, add characterization tests first (see `qa-test`) or drop to `light`/`none`.
3. **Load `references/typescript.md`** for the stack's concrete cleanups.
4. **Apply within the latitude, in small reviewable commits.** Never exceed the requested intensity - no gold-plating.
5. **Re-run tests after each batch;** behavior must stay identical. Under `free`, an intentional API change updates its tests and is called out, not hidden.
6. **Stop at the chosen intensity** and report what changed and what was deliberately left (and why).

## Gotchas

- Changing behavior under `none`/`safe` is a bug, not a cleanup; a behavior fix is `develop-write`/`develop-review` work - surface it, do not smuggle it in.
- A giant unreviewable diff defeats the purpose; batch by file or concern even at `repo`/`exhaustive`.
- Cleanup without a test baseline is gambling - characterize first or stay at `light`/`none`.
- Gold-plating past the requested intensity spends review and risk the user did not ask for; honor the dial.
- This is not feature work or a version upgrade - route those to `develop-write` / `develop-maintain`.
