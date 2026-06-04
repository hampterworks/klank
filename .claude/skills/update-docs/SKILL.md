---
name: update-docs
description: Updates README files and human-readable documentation to reflect recent code or config changes. Use after any structural change — new lib, new Tauri command, changed path alias, new route — to keep docs current.
---

# update-docs

## When to use

- After adding a new lib (update `AGENTS.md §Project Structure`)
- After adding a new Tauri command (update `docs/agents/roles/tauri-engineer.md §Process` if it changes the workflow)
- After changing `tsconfig.base.json §paths` (update `AGENTS.md §Code Style`)
- After adding a new route (update any docs that describe navigation)
- When a README still shows Nx boilerplate instead of real project information

## Procedure

1. Run `git diff --name-only HEAD~1..HEAD` to scope the change.
2. For each structural change, identify the corresponding doc using `docs/agents/agent-setup.md §Update Matrix`.
3. Update the doc: no prose paragraphs in `AGENTS.md` or `CLAUDE.md` — tables and bullets only.
4. For root `README.md`: ensure it describes what klank actually is, how to run it, and the lib structure. The Nx boilerplate is not acceptable.
5. If agent setup files changed, run `audit-agent-setup`.

## Failure modes

- **README still shows Nx boilerplate** → rewrite the README to describe klank; include the dev commands from `AGENTS.md §Build & Test`.
- **AGENTS.md exceeds 150 lines** → identify prose sections and convert to bullet tables; move deep detail to a `docs/` Tier-3 file.
