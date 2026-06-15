---
name: audit-agent-setup
description: Checks klank's agent setup for consistency - mirror parity, frontmatter, cross-refs, stale paths, descriptions. Use before any commit under .claude/, .github/agents/, or docs/agents/.
---

# audit-agent-setup

## When to use

- Before committing any change to `.claude/`, `.github/agents/`, or `docs/agents/`
- After running `add-role` or `add-skill`
- As part of Documentation Specialist's pre-commit step

## Procedure

Run each check in order; fix all failures before committing.

1. **Mirror parity** - every `.claude/agents/<n>.md` has a matching `.github/agents/<n>.agent.md` and `.junie/agents/<n>.md`, and vice versa. Skills are **not** mirrored: flag any `.github/agents/<n>.agent.md` that shadows a `.claude/skills/<n>/` directory (Copilot auto-discovers skills).
2. **Frontmatter shape** - every `SKILL.md` has `name` (kebab-case, ≤ 64 chars) and `description` (≤ 1024 chars, leading verb). Every `.claude/agents/<n>.md` has `name`, `description`, `model`, and either `tools` or `disallowedTools`.
3. **Skill cross-refs** - every subagent's `## Skills used` bullet resolves to a real `.claude/skills/<n>/` directory.
4. **Self-contained identities** - every `.claude/agents/<n>.md` and `.github/agents/<n>.agent.md` body is a real identity, not a redirect (`Read … and follow`) to a parallel doc. There is no role-routing table in `CLAUDE.md`/`AGENTS.md`.
5. **Mirror alignment** - the identity body and `description` are identical across `.claude/agents/<n>.md`, `.github/agents/<n>.agent.md`, and `.junie/agents/<n>.md`; `model` matches between the `.claude/` and `.github/` copies (the `.junie/` copy carries only `name` + `description`).
6. **Skill Catalogue parity** - every row in `agent-setup.md §Skill Catalogue` exists as `.claude/skills/<n>/SKILL.md` on disk; and every `.claude/skills/` directory has a catalogue row.
7. **Stale references** - every backtick-quoted file path in `.claude/`, `.github/agents/`, or `docs/agents/` markdown resolves on disk.
8. **Description quality** - every subagent and `SKILL.md` description leads with a third-person verb, says what + when, and its first sentence is ≤ 200 chars.

See `references/checks.md` for verbose explanations and fix-up examples.

## Failure modes

- **Check 1 (missing role mirror)** → create it with `add-role`. **Check 1 (stray skill mirror)** → delete the `.github/agents/` stub; the skill stays in `.claude/skills/`.
- **Check 4 fails** → inline the identity into the subagent body; delete any parallel role doc and routing table.
- **Check 7 false positives** → paths with `<` or `>` are patterns, not real paths - skip them.
