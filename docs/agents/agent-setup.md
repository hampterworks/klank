Read `ARCHITECTURE.md` for the invariants every file here depends on.

---

## Naming Conventions

**Subagents**: kebab-case, noun phrase (`music-theory-expert`, not `musicTheory`).
**Skills**: kebab-case, `verb-object` form (`run-tests`, `update-docs`).
**Subagent mirrors**: `<name>.agent.md` in `.github/agents/` (Copilot) and `<name>.md` in `.junie/agents/` (Junie) - same `name` and body as the `.claude/agents/` subagent.

## Adding a New Role

Use the `add-role` skill. It writes the self-contained subagent identity in `.claude/agents/` and its `.github/agents/` (Copilot) and `.junie/agents/` (Junie) mirrors.

## Adding a New Skill

Use the `add-skill` skill. It creates the SKILL.md and registers the catalogue row. Skills are auto-discovered - never mirrored into `.github/agents/`.

## Update Matrix

When this fact changes → update these files:

| Fact | Files to update |
|------|----------------|
| Build/test commands | `AGENTS.md` |
| New `@klank/*` lib | `AGENTS.md §Project Structure`, `tsconfig.base.json §paths`, this file §Skill Catalogue if `new-lib` was used |
| New Tauri command | `.claude/agents/tauri-engineer.md §Process` (+ `.github/agents/` mirror), `AGENTS.md §Boundaries` if a new constraint |
| New role | `.claude/agents/<name>.md` + `.github/agents/<name>.agent.md` + `.junie/agents/<name>.md` (self-contained identity), this file §Skill Catalogue |
| New skill | `.claude/skills/<name>/`, this file §Skill Catalogue, consuming subagent `## Skills used` |
| Hook added | `.claude/hooks/`, `.claude/settings.json`, this file §Hook Catalogue |
| Persisted field name changed | `libs/store/src/lib/store.ts`, `AGENTS.md §Boundaries`, consuming subagent Hard Constraints |

## Skill Catalogue

| Skill | Auto-trigger | Purpose |
|-------|-------------|---------|
| `run` | Yes | Start Vite dev server or Tauri desktop app |
| `run-tests` | Yes | Run Vitest per-lib or across workspace |
| `build` | Yes | Full NX build + typecheck + lint |
| `new-lib` | No | Scaffold a new NX library with correct config and path alias |
| `add-role` | No | Create a subagent identity (`.claude/agents/` + `.github/agents/` + `.junie/agents/` mirrors) |
| `add-skill` | No | Create a new skill SKILL.md + catalogue entry |
| `add-hook` | No | Add a new Claude Code hook to settings.json |
| `audit-agent-setup` | Yes - before any commit under `.claude/`, `.github/agents/`, or `docs/agents/` | Consistency checks for klank's agent system |
| `update-dependencies` | No | pnpm workspace + Cargo.toml dependency upgrades |
| `update-docs` | Yes - after any structural change | Keep README and human-readable docs current |

The `develop-*`, `qa-*`, `cicd-*`, and `design-*` procedure skills (originally from agentkit) also live in
`.claude/skills/` and are auto-discovered; see `CATALOG.md` for the full index. Two former klank skills were
retired in favour of those: `cleanup-recent-changes` -> `develop-clean`, `ci-pipeline-optimize` ->
`cicd-harden`. These are hand-maintained native files - there is no generator or CLI.

## Hook Catalogue

*(Empty - no hooks registered yet. Use `add-hook` to bootstrap the first one.)*

## Token Budget Reference

| File | Soft | Hard |
|------|------|------|
| `CLAUDE.md` | 100 lines | 150 lines |
| `AGENTS.md` | 100 lines | 150 lines |
| Subagent identities | 400 tokens | 60 lines |
| Skill bodies | 120 lines | 150 lines |
