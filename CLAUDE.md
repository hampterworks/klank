Read `AGENTS.md` first — project briefing, build/test commands, and boundaries. For why the agent setup is shaped the way it is (seven invariants): `docs/agents/ARCHITECTURE.md`. To extend safely: invoke `add-skill`, `add-role`, or `add-hook`; before any commit touching `.claude/`, `.github/agents/`, or `docs/agents/`: `audit-agent-setup`.

---

## Role Detection

Match the task to the role before starting. Read the role file before writing any code.

| Task type | Role | Read first |
|-----------|------|------------|
| Task spans ≥ 2 roles, "plan", "kick off", "coordinate" | Orchestrator | `docs/agents/roles/orchestrator.md` |
| New React component, CSS module, route, Tauri IPC frontend call, `apps/klank/app/` or `libs/ui/` | Frontend Engineer | `docs/agents/roles/frontend-engineer.md` |
| Rust command, Tauri capability, plugin, `Cargo.toml`, any file under `apps/klank/src-tauri/` | Tauri Engineer | `docs/agents/roles/tauri-engineer.md` |
| Guitar tab parsing, chord transposition, tab format, UG scraper, `chords.ts`, `download.ts` | Music Theory Expert | `docs/agents/roles/music-theory-expert.md` |
| NX config, Vite config, `pnpm-workspace.yaml`, `tsconfig.base.json`, CI/CD, scaffolding a new lib | Platform Engineer | `docs/agents/roles/platform-engineer.md` |
| Vitest tests, `@testing-library/react`, test structure, pre-ship audit | Tester | `docs/agents/roles/tester.md` |
| README, `AGENTS.md`, `CLAUDE.md`, role files, inline docs, any `.md` for humans | Documentation Specialist | `docs/agents/roles/documentation-specialist.md` |
| UI layout, user flows, accessibility, music app UX patterns | UX Designer | `docs/agents/roles/ux-designer.md` |

---

## Critical Constraints

Silent failures — the hardest bugs to diagnose:

- **Never add default exports** — TypeScript named exports only throughout all libs and app code.
- **Never rename `transpose`, `fontSize`, `scrollSpeed` in `TabSetting`** — persisted in `klank-storage`; renaming silently drops all user settings.
- **Tab files must use `.tab.txt` extension** — `fs.ts` filter and `mapTreeStructure` depend on this exact string.
- **Tauri capabilities must be declared in `apps/klank/src-tauri/capabilities/`** — never bypass with `dangerouslyAllowedUri` or inline CSP overrides.
- **NX path aliases must match `tsconfig.base.json §paths`** — `@klank/ui`, `@klank/store`, `@klank/platform-api`; crossing lib boundaries with relative imports breaks the build silently in some configurations.
- **Every Rust command must appear in `generate_handler![]` in `lib.rs`** — an unregistered command compiles cleanly but is silently unreachable from JS.
- **Never import `@tauri-apps/*` directly in `apps/klank/app/` components** — wrap all platform calls in `@klank/platform-api`.
- **Never edit `libs/ui/` without Frontend Engineer role** — shared component changes cascade to all consumers without type errors.

---

## Skills

Auto-triggered procedure-skills live under `.claude/skills/`. See `docs/agents/agent-setup.md §Skill Catalogue` for the full list and trigger conditions. Hooks live under `.claude/hooks/`; registration in `.claude/settings.json`.

Multi-role tasks: invoke the Orchestrator before delegating.
