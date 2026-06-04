---
name: audit-agent-setup
description: Runs 8 consistency checks across the klank agent setup — mirror parity, frontmatter shape, skill cross-references, role detection rows, model alignment, skill catalogue drift, stale references, and description quality. Use before any commit under .claude/, .github/agents/, or docs/agents/.
---

# audit-agent-setup

## When to use

- Before committing any change to `.claude/`, `.github/agents/`, or `docs/agents/`
- After running `add-role` or `add-skill`
- As part of Documentation Specialist's pre-commit step

## Procedure

Run each check in order; fix all failures before committing.

1. **Mirror parity** — every `.claude/skills/<n>/SKILL.md` has a matching `.github/agents/<n>.agent.md`. Every `.claude/agents/<n>.md` has a matching `.github/agents/<n>.agent.md`.
2. **Frontmatter shape** — every `SKILL.md` has `name` (kebab-case, ≤ 64 chars) and `description` (≤ 1024 chars, leading verb). Every `.claude/agents/<n>.md` has `name`, `description`, `model`, and either `tools` or `disallowedTools`.
3. **Skill cross-refs** — every role file's `## Skills used` bullet resolves to a real `.claude/skills/<n>/` directory.
4. **Role Detection rows** — every `.claude/agents/<n>.md` has a corresponding row in `CLAUDE.md §Role Detection` that names the same `docs/agents/roles/<n>.md` path.
5. **Model alignment** — the `model:` field is identical in `.claude/agents/<n>.md` and `.github/agents/<n>.agent.md` for every role and skill.
6. **Skill Catalogue parity** — every row in `agent-setup.md §Skill Catalogue` exists as `.claude/skills/<n>/SKILL.md` on disk; and every `.claude/skills/` directory has a catalogue row.
7. **Stale references** — every backtick-quoted file path in `.claude/`, `.github/agents/`, or `docs/agents/` markdown resolves on disk.
8. **Description quality** — every `SKILL.md` description leads with a third-person verb; first sentence ≤ 200 chars.

See `references/checks.md` for verbose explanations and fix-up examples.

## Failure modes

- **Check 1 fails** → create the missing mirror file using `add-skill` or `add-role`.
- **Check 7 false positives** → paths with `<` or `>` are patterns, not real paths — skip them.
