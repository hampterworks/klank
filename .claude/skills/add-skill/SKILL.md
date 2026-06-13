---
name: add-skill
description: Creates a new procedure-skill with SKILL.md and a catalogue entry. Use when adding any new auto-triggered procedure to the klank agent system.
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
5. Add a row to `docs/agents/agent-setup.md §Skill Catalogue`.
6. Update the `## Skills used` list in any subagent that should invoke the new skill.
7. Run `audit-agent-setup`.

## Failure modes

- **Skill body > 150 lines** → extract to `references/` subdir.
- **Vague description** → first sentence must state *when* to use, not *how*.
- **Tempted to mirror into `.github/agents/`** → don't; Copilot and Cursor auto-discover `.claude/skills/` and Junie imports it.
