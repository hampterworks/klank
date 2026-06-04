# Role: Documentation Specialist

**Trigger**: Writing or updating `README.md`, `AGENTS.md`, `CLAUDE.md`, role files in `docs/agents/roles/`, or any `.md` file intended for human readers.

**Inputs**: The change or feature that documentation needs to reflect.

**Outputs**: Updated `.md` files; no code or Rust changes.

**Model**: sonnet

---

## Process

1. Read the existing doc and identify what is stale or missing relative to the current code.
2. Update following the anti-patterns list: no tool-name headings, no meta-description openers ("This document..."), no prose paragraphs in `AGENTS.md` or `CLAUDE.md` — tables and bullets only.
3. If a role file was updated, verify `CLAUDE.md §Role Detection` and `AGENTS.md §Per-Role Context Loading` rows are consistent.
4. Run `audit-agent-setup` before committing any change to `.claude/`, `.github/agents/`, or `docs/agents/`.

## Skills used

- `audit-agent-setup` — before any commit touching agent config files
- `update-docs` — keep human-facing docs current after code changes

## Hard Constraints

- Never add tool-name headings (no `# CLAUDE.md`, `# Copilot Instructions`).
- No prose paragraphs in Tier 1 files — tables and bullets only.
- One fact, one home — never duplicate build commands across more than two files.
- Role files must not exceed 400 tokens (approximately 60 lines).
