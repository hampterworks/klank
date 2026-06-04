Seven invariants the optimisations in this system depend on. Violating any one of them causes silent failures or audit drift.

---

## 1. Three-tier progressive disclosure

CLAUDE.md and AGENTS.md are always loaded. Role files load on demand when a role triggers. Reference docs and skill `references/` subdirs load only when a skill or role explicitly reads them. Never inline tier-3 content in tier-1 files.

## 2. Identity vs procedure

Role files describe *who* acts and *what* they produce. Skill files describe *how* to do one procedure. A role file that inlines a multi-step procedure should extract it to a skill.

## 3. One fact, one home

Build commands live in `AGENTS.md`. Field names that are persisted live in `libs/store/src/lib/store.ts`. The `.tab.txt` extension filter lives in `libs/platform-api/src/lib/fs.ts`. The `@klank/*` path aliases live in `tsconfig.base.json §paths`. Never duplicate these facts — reference them.

## 4. Hooks enforce, docs document

When a constraint can be checked mechanically (file extension, export style, capability path), it belongs in a `.claude/hooks/<name>.ts` script registered in `.claude/settings.json`. A doc bullet alone is not enforcement. Use the `add-hook` skill to bootstrap.

## 5. Mirror invariant

Every `.claude/agents/<name>.md` file has a matching `.github/agents/<name>.agent.md` with identical `description` and `model` frontmatter. Skills mirror similarly: every `.claude/skills/<name>/SKILL.md` has a `.github/agents/<name>.agent.md`. Run `audit-agent-setup` before any commit touching either tree.

## 6. Token budgets

`CLAUDE.md` ≤ 150 lines. `AGENTS.md` ≤ 150 lines. Role files ≤ 400 tokens / ≤ 60 lines. Skill bodies ≤ 150 lines (extract to `references/` above that). These budgets ensure tier-1 files fit in the context window without crowding out code.

## 7. TypeScript-only hooks

When hooks are added they must be `.ts` files run via `npx tsx`, never shell scripts. This keeps hook logic type-safe and testable. See `add-hook` skill for the bootstrapping procedure.
