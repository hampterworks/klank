---
name: agentkit-install
description: Installs or updates a chosen subset of this library into a target repo, picking domains, detecting agents, reconciling files. Use when setting up or syncing agentkit, not for authoring content.
---

# Installing agentkit into a target repo

Set up (or update) a curated subset of this library in another repository. The agent drives the choices via
the questions below; the `agentkit install` CLI does the writing non-interactively and reports JSON.

## Steps

1. Inspect the target first: `pnpm agentkit discover <path> --json`. Report back the detected agents,
   whether `AGENTS.md`/`CLAUDE.md` already exist, any prior install (`agentkitVersion`), and the doctor
   findings - these are the reconciliation proposal.
2. Ask the user, via `AskUserQuestion`, for:
   - **Domains** (multi-select): develop, design, cicd, qa. The agentkit upkeep bundle is always
     installed; show it as fixed. Each domain pulls its skills plus the principles those skills cite.
   - **Agents**: Claude is always on; offer the detected extras (copilot, cursor, junie) for confirm.
   - **`--with-cli`?** Off by default (consumer install). On = also vendor the agentkit CLI + a `.agentkit/`
     skeleton so the target can author and re-generate locally.
3. Preview with `pnpm agentkit install <path> --select <domains> --agents <ids> [--with-cli] --dry-run --json`
   and show the diff (`add`/`replace`/`remove`) and any `conflicts`.
4. On confirmation, run the same command without `--dry-run`. If it halts on user-file conflicts, resolve
   each with the user (keep their file, or re-run with `--force` to back it up to `.agentkit/backups/` and
   overwrite). Then report the manifest version and that **sync = re-running this install** later.

## Gotchas

- Re-install overwrites managed files and removes the managed files of any deselected domain; never
  hand-edit a managed file (`.claude/skills/*`, generated `AGENTS.md`/`CATALOG.md`) - it will be replaced.
- User files and non-managed regions are never touched: an existing `CLAUDE.md` is augmented in place with a
  marker-guarded `@AGENTS.md` import, and a colliding user file is backed up, not clobbered.
- There is no sync command inside the target; you re-run `agentkit install` from this library to update.
  `--with-cli` keeps a vendored CLI in `.agentkit/cli/`; omit it and the target stays a pure consumer.
- `agentkit-doctor` is the in-place upkeep skill for a target that has only native files (no `.agentkit/`);
  the `.agentkit/`-authoring agentkit skills assume `--with-cli`. This skill installs all of them.
