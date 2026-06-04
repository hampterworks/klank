---
name: ci-pipeline-optimize
description: Audits and optimizes .github/workflows/ci.yml for duration, caching, SHA pinning, and reliability. Use after any change to .github/workflows/ or when CI is slow or flaky.
---

# ci-pipeline-optimize

## When to use

- After editing `.github/workflows/ci.yml`
- When CI duration is unexpectedly long
- When CI is flaky on intermittent test failures

## Procedure

1. Read `.github/workflows/ci.yml` in full.
2. Check for unpinned actions — prefer SHA-pinned actions over tag-only references.
3. Check for missing `cancel-in-progress` on PR triggers:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```
4. Check that `pnpm install` uses `--frozen-lockfile` for reproducible installs in CI.
5. Check that `nx run-many` uses `--parallel` flag where applicable.
6. Check for missing Rust/Cargo cache step (use `actions/cache` for `~/.cargo` and `apps/klank/src-tauri/target`).
7. Check that `on.push` branch list matches active development branches (`refactor`, not `master`).
8. Apply safe fixes (SHA pinning, `cancel-in-progress`, `--frozen-lockfile`).
9. For risky restructuring, describe the change and ask before applying.

## Known issues in klank's ci.yml

- `on.push` references `master` branch but active development is on `refactor`
- Actions may not be SHA-pinned
- Missing `cancel-in-progress` concurrency block
- May use `npm ci` instead of `pnpm install --frozen-lockfile`
