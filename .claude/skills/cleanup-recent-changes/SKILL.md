---
name: cleanup-recent-changes
description: Performs a senior-developer cleanup pass on recent code changes — removes smells, dead code, and bad patterns, then verifies the build and tests still pass. Use after any development session before committing.
---

# cleanup-recent-changes

## When to use

- After implementing a feature or bug fix, before committing
- When asked for "expert cleanup", "senior cleanup", or "clean up what I just wrote"
- Before opening a PR

## Procedure

1. Run `git diff HEAD` or `git diff HEAD~1..HEAD` to scope the change.
2. Read the changed files in full.
3. Apply the smell checklist from `references/checklist.md` — subtract before adding.
4. Run `pnpm lint` and fix all lint errors.
5. Run `pnpm nx run-many -t typecheck` — fix all type errors.
6. Run `run-tests` — all tests must pass.
7. Run `build` — production build must be clean.
8. If cleanup introduced non-trivial changes, do a second pass of steps 2–4.

## Failure modes

- **Cleanup breaks a test** → the cleanup changed semantics, not just style; revert the semantic change.
- **Lint rule conflicts with cleanup** → follow the lint rule; open an issue if the rule seems wrong.
- **Build succeeds but app behaviour changed** → run `run` to verify visually before committing.

## References

- `references/checklist.md` — klank-specific smell catalogue
