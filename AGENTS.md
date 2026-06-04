Read the role file in `docs/agents/roles/` matching your task before writing any code.

---

## Build & Test

```
pnpm dev                              # Vite dev server only (React, no Tauri shell), port 4200
pnpm tauri:dev                        # Full Tauri desktop app with Rust backend + hot reload
pnpm build                            # Production Vite build (nx build klank)
pnpm test                             # Vitest across all libs (nx run-many -t test)
pnpm lint                             # ESLint across workspace (nx run-many -t lint)
pnpm nx run-many -t typecheck         # TypeScript type-check across all projects

# Per-lib
pnpm nx test @klank/ui
pnpm nx test @klank/store
pnpm nx test @klank/platform-api

# Tauri release bundle
pnpm nx run klank:tauri:build
```

## Project Structure

```
apps/klank/app/                     React Router 7 app — routes, components, root layout
apps/klank/app/components/menu/     Left sidebar: directory tree, search bar
apps/klank/app/components/player/   Center pane: tab display, toolbar, playback controls
apps/klank/src-tauri/src/lib.rs     Rust commands — scrape_ug, deliver_ug_html, report_ug_error
apps/klank/src-tauri/capabilities/  Tauri permission declarations (JSON) — one file per window
libs/ui/src/                        Shared React components (@klank/ui)
libs/store/src/lib/store.ts         Zustand store with persisted TabSetting (@klank/store)
libs/platform-api/src/lib/          FileService, chords, download, sort, userAgent (@klank/platform-api)
docs/agents/                        Agent instructional context
.claude/agents/                     Agent bridge files (subagent definitions)
.claude/skills/                     Procedure-skills
.github/agents/                     GitHub Copilot mirrors
```

## Code Style

- TypeScript named exports only — never `export default` in any lib or app file
- CSS modules (`.module.css`) — no global style additions
- Zustand via `useKlankStore` from `@klank/store` for all persistent data
- `useState` for ephemeral UI state only (toggles, hover, focus)
- Tab file extension: `.tab.txt` (filter enforced in `libs/platform-api/src/lib/fs.ts`)
- Tauri IPC: always wrap in `@klank/platform-api`, never import `@tauri-apps/*` directly in app components
- Path aliases: `@klank/ui` · `@klank/store` · `@klank/platform-api` — defined in `tsconfig.base.json §paths`
- Never use relative imports across lib boundaries

## Boundaries

- **Never add default exports** — breaks tree-shaking and named re-exports across libs
- **Never edit `libs/ui/` without Frontend Engineer role** — shared component changes cascade to all consumers
- **Never bypass Tauri capabilities** — declare in `apps/klank/src-tauri/capabilities/*.json`; no `dangerouslyAllowedUri` hacks
- **Never register a Rust command outside `generate_handler![]` in `lib.rs`** — unregistered commands compile but are silently unreachable from JS
- **Never use relative imports across lib boundaries** — use `@klank/*` path aliases from `tsconfig.base.json`
- **Never rename `transpose`, `fontSize`, `scrollSpeed` in `TabSetting`** — they are persisted in `klank-storage` in localStorage
- **Never import `@tauri-apps/*` directly in `apps/klank/app/` components** — wrap in `@klank/platform-api`

## Per-Role Context Loading

| Role | Load | Skip |
|------|------|------|
| Orchestrator | role file | all other role files |
| Frontend Engineer | role file | `tauri-engineer.md`, `tester.md` |
| Tauri Engineer | role file | `frontend-engineer.md`, `tester.md` |
| Music Theory Expert | role file, `libs/platform-api/src/lib/chords.ts`, `libs/platform-api/src/lib/download.ts` | UI role files |
| Platform Engineer | role file, `nx.json`, `tsconfig.base.json` | all other role files |
| Tester | role file | design and music docs |
| Documentation Specialist | role file, `docs/agents/agent-setup.md` | all other docs |
| UX Designer | role file | `tauri-engineer.md`, `tester.md` |
