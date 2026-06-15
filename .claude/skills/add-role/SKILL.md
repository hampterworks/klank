---
name: add-role
description: Creates a new self-contained subagent identity in .claude/agents/ and its .github/agents/ (Copilot) and .junie/agents/ (Junie) mirrors. Use when introducing a new expert identity to the klank agent system.
---

# add-role

## When to use

- A new domain is emerging that doesn't fit any of the 8 existing roles
- A role is being split because its scope has grown too wide

## Procedure

1. Choose a kebab-case name (noun phrase: `mobile-engineer`, not `mobileDev`).
2. Pick model tier: `claude-opus-4-7` for planning-only roles with `disallowedTools`; `claude-sonnet-4-6` for implementation roles.
3. Determine tool scope: implementation roles get `tools: Read, Write, Edit, Bash, Glob, Grep`; planning-only roles get `disallowedTools: Write, Edit, Bash`.
4. Write `.claude/agents/<name>.md`: frontmatter (`name`, `description` ≤ 200 chars saying what + when, `model`, and `tools` or `disallowedTools`) followed by the self-contained identity body (≤ 60 lines): Trigger, Inputs, Outputs, Process (numbered), Skills used, Hard Constraints. The body is the real identity - never a redirect.
5. Mirror the **identical** identity body to both `.github/agents/<name>.agent.md` (frontmatter: `name`, `description`, `model`; omit `tools`) and `.junie/agents/<name>.md` (frontmatter: `name`, `description`).
6. Run `audit-agent-setup`.

## Failure modes

- **Identity exceeds 60 lines** → tighten the Process and Hard Constraints; move deep domain reference to a `docs/agents/<name>-notes.md` Tier-3 file.
- **Mirror drifts** → `audit-agent-setup` (mirror alignment) catches mismatched `description`/`model`; keep the `.claude/`, `.github/`, and `.junie/` copies identical.
- **Body is a redirect** → inline the full identity; a stub that points at another doc is the split-identity smell.
