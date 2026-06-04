# Audit Checks — Detailed Reference

## Check 1: Mirror Parity

For every `.claude/agents/<name>.md` there must be a `.github/agents/<name>.agent.md`.
For every `.claude/skills/<name>/SKILL.md` there must be a `.github/agents/<name>.agent.md`.

**Fix**: Create the missing mirror with the same `name`, `description`, and `model` frontmatter. Use `add-role` or `add-skill` which create both files in one pass.

## Check 2: Frontmatter Shape

Agent bridges (`.claude/agents/*.md`) must have: `name`, `description`, `model`, and one of `tools` or `disallowedTools`.
Skill files (`SKILL.md`) must have: `name` (kebab-case, ≤ 64 chars) and `description` (≤ 1024 chars).

**Fix**: Add the missing field. If `description` exceeds limits, trim or move detail to a Tier-3 reference.

## Check 3: Skill Cross-References

In each `docs/agents/roles/*.md`, the `## Skills used` section lists skills by name. Each name must resolve to a real directory at `.claude/skills/<name>/`.

**Fix**: Either create the missing skill directory with a SKILL.md, or remove the stale reference from the role file.

## Check 4: Role Detection Rows

Every `.claude/agents/<name>.md` must have a row in `CLAUDE.md §Role Detection` that names `docs/agents/roles/<name>.md` as the "Read first" path.

**Fix**: Add the missing row to `CLAUDE.md §Role Detection`.

## Check 5: Model Alignment

The `model:` field in `.claude/agents/<name>.md` must exactly match the `model:` field in `.github/agents/<name>.agent.md`.

**Fix**: Sync the model field. The `.claude/agents/` file is the source of truth.

## Check 6: Skill Catalogue Parity

`docs/agents/agent-setup.md §Skill Catalogue` must have one row per skill. The skill name in each row must resolve to `.claude/skills/<name>/SKILL.md` on disk.

**Fix (row missing)**: Add the row using the exact skill name. **Fix (file missing)**: Create the skill or remove the stale row.

## Check 7: Stale References

Any backtick-quoted file path in a `.claude/`, `.github/agents/`, or `docs/agents/` markdown file must resolve on disk relative to the repo root. Paths containing `<` or `>` are patterns — skip them.

**Fix**: Update the path to match the current file location, or remove the reference.

## Check 8: Description Quality

Every `SKILL.md` frontmatter `description` must begin with a third-person verb (Runs, Creates, Scaffolds, Updates). First sentence must be ≤ 200 chars.

**Fix**: Rewrite to start with a third-person verb. Move detail about *how* into the skill body.
