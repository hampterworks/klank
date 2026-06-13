Specialist work routes to the subagents in `.claude/agents/` (Copilot: `.github/agents/`) automatically by their `description`. Read the matching subagent's identity before writing any code; invoke the Orchestrator first for multi-role tasks.

---

## Build & Test

```
pnpm dev                              # Vite dev server only (React, no Tauri shell), port 4200
pnpm tauri:dev                        # Full Tauri desktop app with Rust backend + hot reload
pnpm tauri:android:dev                # Run on Android (emulator/device); CI builds via .github/workflows/build-android.yml
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
apps/klank/app/                     React Router 7 app - routes, components, root layout
apps/klank/app/components/menu/     Left sidebar: directory tree, search bar
apps/klank/app/components/player/   Center pane: tab display, toolbar, playback controls
apps/klank/src-tauri/src/lib.rs     Rust entry - registers scrape_ug + git_* commands
apps/klank/src-tauri/src/import/    Tab-import pipeline (stages, orchestrator, progress)
apps/klank/src-tauri/src/git.rs     In-app git engine (libgit2) - git_pull/commit/push/clone/…
apps/klank/src-tauri/capabilities/  Tauri permission declarations (JSON) - one file per window
libs/ui/src/                        Shared React components (@klank/ui)
libs/store/src/lib/store.ts         Zustand store with persisted TabSetting (@klank/store)
libs/platform-api/src/lib/          FileService, git (invoke-based), chords, download, userAgent (@klank/platform-api)
docs/agents/                        Agent architecture + setup conventions
.claude/agents/                     Subagent identities (self-contained, routed by description)
.claude/skills/                     Procedure-skills (auto-discovered by Claude, Copilot, Cursor)
.github/agents/                     Copilot subagent mirrors (same identities)
```

## Code Style

- TypeScript named exports only - never `export default` in any lib or app file
- CSS modules (`.module.css`) - no global style additions
- Zustand via `useKlankStore` from `@klank/store` for all persistent data
- `useState` for ephemeral UI state only (toggles, hover, focus)
- Tab file extension: `.tab.txt` (filter enforced in `libs/platform-api/src/lib/fs.ts`)
- Tauri IPC: always wrap in `@klank/platform-api`, never import `@tauri-apps/*` directly in app components
- Path aliases: `@klank/ui` · `@klank/store` · `@klank/platform-api` - defined in `tsconfig.base.json §paths`
- Never use relative imports across lib boundaries

## Boundaries

- **Never add default exports** - breaks tree-shaking and named re-exports across libs
- **Never edit `libs/ui/` without Frontend Engineer role** - shared component changes cascade to all consumers
- **Never bypass Tauri capabilities** - declare in `apps/klank/src-tauri/capabilities/*.json`; no `dangerouslyAllowedUri` hacks
- **Never register a Rust command outside `generate_handler![]` in `lib.rs`** - unregistered commands compile but are silently unreachable from JS
- **Never use relative imports across lib boundaries** - use `@klank/*` path aliases from `tsconfig.base.json`
- **Never rename `transpose`, `fontSize`, `scrollSpeed` in `TabSetting`** - they are persisted in `klank-storage` in localStorage
- **Never import `@tauri-apps/*` directly in `apps/klank/app/` components** - wrap in `@klank/platform-api`

## Gotchas

- Each subagent in `.claude/agents/` is a self-contained identity routed by `description` - there is no role-routing table to keep in sync.
- The `.github/agents/` copies are the same identities for Copilot; when you edit a subagent, update both files' `description` and `model`.
- Skills live once under `.claude/skills/` - never mirror them into `.github/agents/`; Copilot and Cursor auto-discover the directory and Junie imports it.
