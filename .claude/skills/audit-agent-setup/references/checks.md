# Audit Checks — Detailed Reference

## Check 1: Mirror Parity

For every `.claude/agents/<name>.md` there must be a `.github/agents/<name>.agent.md`, and vice versa — these are the same role identity for Claude and Copilot.

Skills are **not** mirrored: Copilot and Cursor auto-discover `.claude/skills/` and Junie imports it. A `.github/agents/<name>.agent.md` whose `<name>` matches a `.claude/skills/<name>/` directory is a stray skill mirror.

**Fix (missing role mirror)**: create it with `add-role` (writes both files in one pass). **Fix (stray skill mirror)**: delete the `.github/agents/` stub.

## Check 2: Frontmatter Shape

Subagents (`.claude/agents/*.md`) must have: `name`, `description`, `model`, and one of `tools` or `disallowedTools`.
Skill files (`SKILL.md`) must have: `name` (kebab-case, ≤ 64 chars) and `description` (≤ 1024 chars).

**Fix**: Add the missing field. If `description` exceeds 200 chars, trim or move detail into the body.

## Check 3: Skill Cross-References

In each `.claude/agents/*.md`, the `## Skills used` section lists skills by name. Each name must resolve to a real directory at `.claude/skills/<name>/`.

**Fix**: Either create the missing skill directory with a SKILL.md, or remove the stale reference from the subagent.

## Check 4: Self-Contained Identities

Every `.claude/agents/<name>.md` and `.github/agents/<name>.agent.md` body must be a real identity (Trigger, Inputs, Outputs, Process, Skills used, Hard Constraints) — never a redirect such as `Read \`docs/agents/roles/<name>.md\` and follow its process`. There must be no hand-maintained role-routing table in `CLAUDE.md` or `AGENTS.md`; routing is by `description`.

**Fix**: Inline the identity into the subagent body; delete any parallel role doc and any routing table.

## Check 5: Mirror Alignment

The `description` and `model` fields in `.claude/agents/<name>.md` must exactly match `.github/agents/<name>.agent.md`. The `.claude/agents/` file is the source of truth.

**Fix**: Sync `description` and `model` across the two copies.

## Check 6: Skill Catalogue Parity

`docs/agents/agent-setup.md §Skill Catalogue` must have one row per skill. The skill name in each row must resolve to `.claude/skills/<name>/SKILL.md` on disk.

**Fix (row missing)**: Add the row using the exact skill name. **Fix (file missing)**: Create the skill or remove the stale row.

## Check 7: Stale References

Any backtick-quoted file path in a `.claude/`, `.github/agents/`, or `docs/agents/` markdown file must resolve on disk relative to the repo root. Paths containing `<` or `>` are patterns — skip them.

**Fix**: Update the path to match the current file location, or remove the reference.

## Check 8: Description Quality

Every subagent and `SKILL.md` frontmatter `description` must begin with a third-person verb (Runs, Creates, Scaffolds, Updates), say what it does and when to use it, and keep its first sentence ≤ 200 chars.

**Fix**: Rewrite to start with a third-person verb. Move detail about *how* into the body.
