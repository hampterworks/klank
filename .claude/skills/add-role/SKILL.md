---
name: add-role
description: Creates a new role file, agent bridge, and GitHub Copilot mirror, then registers the role in CLAUDE.md and AGENTS.md. Use when introducing a new expert identity to the klank agent system.
---

# add-role

## When to use

- A new domain is emerging that doesn't fit any of the 8 existing roles
- A role is being split because its scope has grown too wide

## Procedure

1. Choose a kebab-case name (noun phrase: `mobile-engineer`, not `mobileDev`).
2. Pick model tier: `claude-opus-4-7` for planning-only roles with `disallowedTools`; `claude-sonnet-4-6` for implementation roles.
3. Determine tool scope: implementation roles get `tools: Read, Write, Edit, Bash, Glob, Grep`; planning-only roles get `disallowedTools: Write, Edit, Bash`.
4. Write `docs/agents/roles/<name>.md` following the role file structure (≤ 400 tokens): Trigger, Inputs, Outputs, Model, Process (numbered), Skills used, Hard Constraints.
5. Create `.claude/agents/<name>.md` with frontmatter + one pointer line: `Read \`docs/agents/roles/<name>.md\` and follow its process exactly.`
6. Mirror to `.github/agents/<name>.agent.md` with identical `name`, `description`, `model` frontmatter; body: `Read \`docs/agents/roles/<name>.md\` before starting.`
7. Add a row to `CLAUDE.md §Role Detection` and `AGENTS.md §Per-Role Context Loading`.
8. Run `audit-agent-setup`.

## Failure modes

- **Role file exceeds 400 tokens** → extract Hard Constraints to a `docs/agents/<name>-constraints.md` Tier-3 reference.
- **Mirror frontmatter differs** → `audit-agent-setup` check 5 will catch this; sync description and model.
- **Missing Role Detection row** → `audit-agent-setup` check 4 will catch this.
