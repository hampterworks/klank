Read `ARCHITECTURE.md` for the invariants every file here depends on.

---

## Authoring model

All agent content is authored under `.agentkit/` and **generated** into the native files every tool reads
(`AGENTS.md`, `CLAUDE.md`, `CATALOG.md`, `.claude/`, `.github/`, `.cursor/`, `.junie/`). Never hand-edit a
generated file - edit the source under `.agentkit/` and regenerate.

- `.agentkit/skills/<group>/<name>/SKILL.md` - procedure skills (groups: `agentkit`, `cicd`, `design`, `develop`, `qa`, `klank`)
- `.agentkit/subagents/<name>.md` - subagent identities (one source -> Claude + Copilot + Cursor + Junie copies)
- `.agentkit/instructions/*.md` - global/path instructions; `overview.md` is klank's project briefing (becomes `AGENTS.md`)
- `.agentkit/commands/*.md`, `.agentkit/hooks/*.yaml`, `.agentkit/mcp/*.yaml` - commands, hooks, MCP servers

## Commands

The agentkit CLI is **not vendored** in this repo; it lives in the agentkit library (romni/skills). Run it
against klank - either with `agentkit` on your PATH from klank's root, or point the library's CLI at klank
with `--root`:

```
agentkit generate                         # regenerate all native files from .agentkit/
agentkit generate --check                 # verify native files are in sync (CI gate)
agentkit validate                         # schema + structure + budget checks
agentkit new skill <name> --group klank   # scaffold a new item (or use the agentkit-scaffold skill)

# or, from a checkout of the romni/skills library, without installing the CLI globally:
pnpm agentkit generate --root /path/to/klank
```

## Naming conventions

**Subagents**: kebab-case, noun phrase (`music-theory-expert`, not `musicTheory`).
**Skills**: kebab-case, `verb-object` form (`run-tests`, `update-docs`).

## Adding a role or skill

Use the `agentkit-scaffold` skill (or `agentkit new <type> <name>`), edit the generated source under
`.agentkit/`, then run `agentkit generate`. Generation writes the subagent to `.claude/agents/` **and**
its `.github/agents/` Copilot mirror from the single `.agentkit/subagents/` source - mirror parity is
automatic, never hand-maintained.

## Skill groups

`agentkit`, `cicd`, `design`, `develop`, `qa` come from the agentkit library. The `klank` group holds
klank-specific skills: `run`, `run-tests`, `build`, `new-lib`, `update-dependencies`, `update-docs`. The
full index is generated to `/CATALOG.md`.

Skills retired into agentkit equivalents: `cleanup-recent-changes` -> `develop-clean`, `ci-pipeline-optimize`
-> `cicd-harden`, `audit-agent-setup` -> `agentkit-doctor`, and `add-skill`/`add-role`/`add-hook` ->
`agentkit-scaffold`.

## Update matrix

When this fact changes -> update these `.agentkit/` sources, then `agentkit generate`:

| Fact | Source to update |
|------|------------------|
| Build/test commands | `.agentkit/instructions/overview.md` |
| New `@klank/*` lib | `.agentkit/instructions/overview.md §Project Structure`, `tsconfig.base.json §paths` |
| New Tauri command | `.agentkit/subagents/tauri-engineer.md`, `overview.md §Boundaries` if a new constraint |
| New role | `.agentkit/subagents/<name>.md` |
| New skill | `.agentkit/skills/<group>/<name>/SKILL.md`, consuming subagent `## Skills used` |
| Hook added | `.agentkit/hooks/<name>.yaml` |
| Persisted field name changed | `libs/store/src/lib/store.ts`, `overview.md §Boundaries`, consuming subagent Hard Constraints |

## Token budget reference

| File | Soft | Hard |
|------|------|------|
| `CLAUDE.md` | 100 lines | 150 lines |
| `AGENTS.md` | 100 lines | 150 lines |
| Subagent identities | 400 tokens | 60 lines |
| Skill bodies | 120 lines | 150 lines |
