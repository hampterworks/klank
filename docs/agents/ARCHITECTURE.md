Seven invariants the optimisations in this system depend on. Violating any one of them causes silent failures or audit drift.

---

## 1. Three-tier progressive disclosure

CLAUDE.md and AGENTS.md are always loaded. Subagent identities in `.claude/agents/` load when that subagent is invoked. Skill bodies load when the skill triggers; skill `references/` subdirs load only when explicitly read. Never inline that deeper content in tier-1 files.

## 2. Identity vs procedure

Subagent identities describe *who* acts and *what* they produce. Skill files describe *how* to do one procedure. A subagent whose body inlines a multi-step procedure should extract it to a skill.

## 3. One fact, one home

Build commands live in `AGENTS.md`. Field names that are persisted live in `libs/store/src/lib/store.ts`. The `.tab.txt` extension filter lives in `libs/platform-api/src/lib/fs.ts`. The `@klank/*` path aliases live in `tsconfig.base.json §paths`. Never duplicate these facts - reference them.

## 4. Hooks enforce, docs document

When a constraint can be checked mechanically (file extension, export style, capability path), it belongs in a `.claude/hooks/<name>.ts` script registered in `.claude/settings.json`. A doc bullet alone is not enforcement. Use the `add-hook` skill to bootstrap.

## 5. Self-contained identities, one home per skill

Each role identity lives in two self-contained native files - `.claude/agents/<name>.md` (Claude) and `.github/agents/<name>.agent.md` (Copilot) - with identical `description` and `model`. The body *is* the identity, routed by `description`; never a redirect to a parallel doc, and never a hand-maintained role-routing table in `CLAUDE.md`/`AGENTS.md`. Skills live once, in `.claude/skills/<name>/`; Claude, Copilot, and Cursor auto-discover that directory and Junie imports it - never mirror a skill into `.github/agents/`. Run `agentkit-doctor` before any commit touching these trees.

## 6. Token budgets

`CLAUDE.md` ≤ 150 lines. `AGENTS.md` ≤ 150 lines. Subagent identities ≤ 60 lines. Skill bodies ≤ 150 lines (extract to `references/` above that). These budgets ensure tier-1 files fit in the context window without crowding out code.

## 7. TypeScript-only hooks

When hooks are added they must be `.ts` files run via `npx tsx`, never shell scripts. This keeps hook logic type-safe and testable. See `add-hook` skill for the bootstrapping procedure.
