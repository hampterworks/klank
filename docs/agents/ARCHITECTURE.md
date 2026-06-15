Invariants the optimisations in this system depend on. Violating any one causes silent failures or audit drift.

---

## 0. `.agentkit/` is the single source; native files are generated

All agent content is authored under `.agentkit/`. The native files every tool reads (`AGENTS.md`,
`CLAUDE.md`, `CATALOG.md`, `.claude/`, `.github/`, `.cursor/`, `.junie/`) are produced by the agentkit CLI
(`agentkit generate`, run from the romni/skills library; not vendored here) and must never be hand-edited -
an edit is overwritten on the next generate, and CI fails the `generate --check` gate when generated files
drift from `.agentkit/`.

## 1. Three-tier progressive disclosure

CLAUDE.md and AGENTS.md are always loaded. Subagent identities load when that subagent is invoked. Skill
bodies load when the skill triggers; skill `references/` subdirs load only when explicitly read. Never
inline deeper content in tier-1 files.

## 2. Identity vs procedure

Subagent identities describe *who* acts and *what* they produce. Skill files describe *how* to do one
procedure. A subagent whose body inlines a multi-step procedure should extract it to a skill.

## 3. One fact, one home

Build commands live in `.agentkit/instructions/overview.md`. Persisted field names live in
`libs/store/src/lib/store.ts`. The `.tab.txt` filter lives in `libs/platform-api/src/lib/fs.ts`. The
`@klank/*` path aliases live in `tsconfig.base.json §paths`. Never duplicate these facts - reference them.

## 4. Hooks enforce, docs document

When a constraint can be checked mechanically (file extension, export style, capability path), author a
hook under `.agentkit/hooks/<name>.yaml`; generation registers it in `.claude/settings.json`. A doc bullet
alone is not enforcement. Bootstrap a hook with `agentkit new hook <name>` (external CLI) or by hand.

## 5. One source per identity; mirrors are generated

Each subagent identity is authored once in `.agentkit/subagents/<name>.md`. Generation emits the Claude
copy (`.claude/agents/<name>.md`), the Copilot mirror (`.github/agents/<name>.agent.md`), and the Cursor
and Junie copies from that single source, so `description`/`model` parity is automatic - never hand-mirror
an identity. The body *is* the identity, routed by `description`; never a redirect to a parallel doc, and
never a hand-maintained role-routing table. Skills likewise live once under `.agentkit/skills/`.

## 6. Token budgets

`CLAUDE.md` <= 150 lines. `AGENTS.md` <= 150 lines. Subagent identities <= 60 lines. Skill bodies <= 150
lines (extract to `references/` above that). These keep tier-1 files in the context window without crowding
out code.

## 7. TypeScript-only hooks

Hooks run as `.ts` files via `tsx`, never shell scripts, so hook logic stays type-safe and testable.
