---
name: agentkit-generate
description: Regenerates per-agent native files (AGENTS.md, CLAUDE.md, .claude, .github, .cursor, .junie) from .agentkit/ and keeps them in sync. Use after editing .agentkit/ or when generated files drift.
---

# Generating native agent files

`.agentkit/` is the single source of truth; the per-agent files are generated and committed.

## Steps

1. Edit content under `.agentkit/` only.
2. Run `pnpm generate` to rewrite the native files (stale files are pruned automatically).
3. Run `pnpm check` to confirm everything is in sync (this is the CI gate).
4. Commit the `.agentkit/` change **and** the regenerated outputs together.

## Fan-out (what goes where)

- Global instructions → `AGENTS.md` (universal) + `CLAUDE.md` (`@AGENTS.md` import).
- Path-scoped instructions → `.claude/rules`, `.github/instructions`, `.cursor/rules`, `.junie/rules`.
- Subagents → `.claude/agents`, `.github/agents`, `.junie/agents`. Commands → `.claude/commands`,
  `.github/prompts`, `.cursor/commands`. Hooks → `.claude/settings.json`. MCP → `.mcp.json`, `.junie/mcp`.

## Gotchas

- Never hand-edit a file with the GENERATED banner - `pnpm check` will fail and your edit is overwritten.
- Output is byte-stable; if a diff appears noisy, regenerate rather than tweaking by hand.
