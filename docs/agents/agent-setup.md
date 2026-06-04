Read `ARCHITECTURE.md` for the invariants every file here depends on.

---

## Naming Conventions

**Roles**: kebab-case, noun phrase (`music-theory-expert`, not `musicTheory`).
**Skills**: kebab-case, `verb-object` form (`run-tests`, `update-docs`).
**Agent bridges**: match the role `name:` field exactly.
**GitHub mirrors**: `<name>.agent.md` in `.github/agents/`.

## Adding a New Role

Use the `add-role` skill. It creates the role file, agent bridge, GitHub mirror, and registers catalogue rows.

## Adding a New Skill

Use the `add-skill` skill. It creates the SKILL.md, GitHub mirror, and registers the catalogue row.

## Update Matrix

When this fact changes → update these files:

| Fact | Files to update |
|------|----------------|
| Build/test commands | `AGENTS.md`, `.github/copilot-instructions.md` |
| New `@klank/*` lib | `AGENTS.md §Project Structure`, `tsconfig.base.json §paths`, this file §Skill Catalogue if `new-lib` was used |
| New Tauri command | `docs/agents/roles/tauri-engineer.md §Process`, `AGENTS.md §Boundaries` if a new constraint |
| New role | role file, `.claude/agents/`, `.github/agents/`, `CLAUDE.md §Role Detection`, `AGENTS.md §Per-Role Context Loading`, this file §Skill Catalogue |
| New skill | `.claude/skills/`, `.github/agents/`, this file §Skill Catalogue, consuming role `## Skills used` |
| Hook added | `.claude/hooks/`, `.claude/settings.json`, this file §Hook Catalogue |
| Persisted field name changed | `libs/store/src/lib/store.ts`, `AGENTS.md §Boundaries`, consuming role Hard Constraints |

## Skill Catalogue

| Skill | Auto-trigger | Purpose |
|-------|-------------|---------|
| `run` | Yes | Start Vite dev server or Tauri desktop app |
| `run-tests` | Yes | Run Vitest per-lib or across workspace |
| `build` | Yes | Full NX build + typecheck + lint |
| `new-lib` | No | Scaffold a new NX library with correct config and path alias |
| `add-role` | No | Create new role file + agent bridge + mirrors + catalogue entries |
| `add-skill` | No | Create new skill SKILL.md + mirror + catalogue entry |
| `add-hook` | No | Add a new Claude Code hook to settings.json |
| `audit-agent-setup` | Yes — before any commit under `.claude/`, `.github/agents/`, or `docs/agents/` | 8 consistency checks for klank's agent system |
| `cleanup-recent-changes` | Yes — after development sessions | Senior-dev cleanup pass on recent changes |
| `update-dependencies` | No | pnpm workspace + Cargo.toml dependency upgrades |
| `ci-pipeline-optimize` | Yes — when `.github/workflows/` is touched | Audit and optimize the CI pipeline |
| `update-docs` | Yes — after any structural change | Keep README and human-readable docs current |

## Hook Catalogue

*(Empty — no hooks registered yet. Use `add-hook` to bootstrap the first one.)*

## Token Budget Reference

| File | Soft | Hard |
|------|------|------|
| `CLAUDE.md` | 100 lines | 150 lines |
| `AGENTS.md` | 100 lines | 150 lines |
| Role files | 400 tokens | 500 tokens |
| Skill bodies | 120 lines | 150 lines |
