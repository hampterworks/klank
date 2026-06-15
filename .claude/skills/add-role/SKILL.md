---
name: add-role
description: Creates a new self-contained subagent identity in .claude/agents/ and its .github/agents/ Copilot mirror. Use when introducing a new expert identity to the klank agent system.
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
5. Mirror to `.github/agents/<name>.agent.md`: same `name`, `description`, `model` frontmatter (omit `tools`) and the **identical** identity body.
6. Run `agentkit-doctor`; then confirm the `.claude/agents/` and `.github/agents/` copies stay identical (`description`/`model`) - `agentkit-doctor` does not check mirror parity.

## Failure modes

- **Identity exceeds 60 lines** → tighten the Process and Hard Constraints; move deep domain reference to a `docs/agents/<name>-notes.md` Tier-3 file.
- **Mirror drifts** → `agentkit-doctor` does not check mirror parity; keep the `.claude/agents/` and `.github/agents/` copies' `description`/`model` identical by hand (or guard it with a hook via `add-hook`).
- **Body is a redirect** → inline the full identity; a stub that points at another doc is the split-identity smell.
