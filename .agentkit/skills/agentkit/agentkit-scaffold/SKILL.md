---
name: agentkit-scaffold
description: Creates a new agent-content item (skill, instruction, subagent, command, hook, or MCP) with correct layout and frontmatter. Use when adding content to a .agentkit/-based agent repo.
---

# Scaffolding agent content

Create a correctly-structured starting point for any content type, then fill it in.

## Steps

1. Pick the type: `skill`, `instruction`, `subagent`, `command`, `hook`, or `mcp`.
2. Run: `pnpm agentkit new <type> <kebab-name>` (creates the file under `.agentkit/<type>s/`).
3. Replace every `TODO` with real, terse content following `agentkit-authoring-principles`: a third-person
   `description` saying what + when (<=200 chars), summary and triggers first with `Gotchas` last, a
   `<domain>-<verb>` `name`, and only the content that earns its place.
4. Run `pnpm generate` then `pnpm validate`.

## Gotchas

- Names must be kebab-case `<domain>-<verb>` using the shortest concrete imperative verb (e.g.
  `develop-review`); a recognizable noun only where no clean verb exists. No `-ing` gerunds.
- A skill and a command cannot share a name - both become `/name` in Claude Code.
- Never create files directly under the generated dirs (`.claude/`, `.github/`, …); author in `.agentkit/`.
