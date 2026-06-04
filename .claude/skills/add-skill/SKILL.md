---
name: add-skill
description: Creates a new procedure-skill with SKILL.md, GitHub Copilot mirror, and catalogue entry. Use when adding any new auto-triggered procedure to the klank agent system.
---

# add-skill

## When to use

- A new procedure is needed that can be triggered automatically (build, verify, scaffold)
- An existing role's Process section is becoming a multi-step procedure worth extracting

## Procedure

1. Choose a kebab-case name in `verb-object` form (`update-docs`, `run-tests`; not `documentation-updater`).
2. Write the description ≤ 200 chars, third-person, leading with a verb: `Runs Vitest tests... Use after any code change.`
3. Create `.claude/skills/<name>/SKILL.md` with four sections: **When to use** (bullets), **Procedure** (numbered), **Failure modes** (bullets), **References** (if any).
4. If the body would exceed ~150 lines, extract detail to `.claude/skills/<name>/references/<detail>.md` and link from the skill.
5. Mirror to `.github/agents/<name>.agent.md` — same `name`, `description`, `model` (if set) frontmatter.
6. Add a row to `docs/agents/agent-setup.md §Skill Catalogue`.
7. Update the `## Skills used` list in any role file that should invoke the new skill.
8. Run `audit-agent-setup`.

## Failure modes

- **Skill body > 150 lines** → extract to `references/` subdir.
- **Mirror missing** → `audit-agent-setup` check 1 (mirror parity) will catch this.
- **Vague description** → first sentence must state *when* to use, not *how*.
