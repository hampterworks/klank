---
name: agentkit-doctor
description: Diagnoses and safely fixes a repo's existing native agent files (CLAUDE.md, AGENTS.md, .cursor/rules, SKILL.md, hooks) against these rules. Use when auditing or cleaning up another repo's agent setup.
---

# Doctoring another repo's agent files

Apply this repo's rules to a *foreign* repo **in place** - without imposing the `.agentkit/`+generate
architecture. This is the portable "fix my agent setup" tool.

## Steps

1. `pnpm agentkit doctor <path-to-repo>` - discovers and lints the repo's native agent files
   (CLAUDE.md, AGENTS.md, `.cursor/rules`, `.github/instructions|prompts|agents`, `.claude/**`,
   `.junie/**`, `docs/agents/**` + `.agents/**` reference docs, stray `SKILL.md`).
2. Read the report. Classes:
   - **Auto-fixable (format only):** trailing whitespace, final newline, excess blank lines - apply with
     `pnpm agentkit doctor <path> --fix`.
   - **Errors (fix first):** e.g. `frontmatter-unparseable` (YAML that won't load - usually an unquoted
     value containing a colon-space) and `desc-xml`. These break tool loading; fix before anything else.
   - **Surfaced for confirmation (structural):** everything else. Confirm intent, then edit. See
     `references/rule-catalogue.md` for every rule, its severity, and what to do.
3. **Decompose split identities early.** A `split-identity` finding - redirect-stub subagents plus a
   hand-maintained routing table, usually shadowing a parallel `…/roles/*.md` doc - is the architecture
   to fix first, not a deviation to bank. Inline each identity into its agent file (routed by
   `description`), then delete the parallel docs and the table. Read repeated `pointer-body` +
   `routing-table` as this single fix; don't wait to be told.
4. Wire it in so it runs automatically going forward - see `references/automation.md` (CI + pre-commit).

## Highest-leverage findings

Fix these first: `split-identity` (decompose per step 3), `frontmatter-unparseable` (an unquoted
colon-space in a `description` breaks tool loading), and `routing-table`/`duplicate-block`
(hand-maintained tables that duplicate `description` routing). `references/rule-catalogue.md` lists every
rule, its severity, and the fix.

## Gotchas

- `--fix` never rewrites meaning (descriptions, ordering, removals); those are surfaced, not auto-applied.
- The doctor reuses the exact rule-set in `src/rules.ts`, so its findings match `validate`.
- It leaves the target repo's layout intact - use `agentkit install` (see `agentkit-install`) only if a team wants the full .agentkit/+CLI setup.
