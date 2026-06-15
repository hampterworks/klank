# Klank

> Cross-tool agent instructions for this repository.


## Project briefing

Specialist work routes to the subagents in `.claude/agents/` (Copilot: `.github/agents/`) automatically by their `description`. Read the matching subagent's identity before writing any code; invoke the Orchestrator first for multi-role tasks.

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
libs/audio/src/                     Metronome + tuner logic and Web Audio engines (@klank/audio)
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
- Tab file extension: `.tab.txt` (filter enforced in `libs/platform-api/src/lib/fs.ts`; `mapTreeStructure` also depends on this exact string)
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

## Development principles (least code, fewest deps)

When writing or changing code in this codebase or in any code-producing skill, default to the
**least code that solves the problem** - think like the laziest senior dev in the room:

- **YAGNI.** Question whether the code, file, or abstraction needs to exist at all. Delete before you add;
  the best code is the code you never wrote.
- **Reach low first.** Standard library and native platform features before a dependency; one line before
  fifty; compose existing helpers before writing new ones.
- **Dependencies are a liability.** Prefer zero new ones. Add a dependency only when it is justified,
  official or very widely trusted, pinned to a current stable version, and `pnpm audit`-clean.
- **Smallest diff wins.** Match surrounding style; the change a reviewer can hold in their head beats the
  clever one.
- **Lazy, not negligent.** Minimalism never trades away correctness or safety: keep input validation at
  trust boundaries, security (see `security-principles`), accessibility, error handling, and data
  integrity. Deleting code is not deleting the safeguard - cut the bloat, not the guardrail.
- **Pin the scope, then deliver it whole.** For non-trivial work, interrogate scope, acceptance, and the
  owner's hard constraints up front (batched) instead of discovering them through rework; and when the
  agreed scope is "all of it", finish the tail too - do not quietly defer a nit or re-scope. If something
  should be cut, ask; never decide it silently.

## Design principles (minimalism and impact)

When doing design or product work, optimize for **minimalism and impact**:

- **Least interaction.** The fewest steps and the smallest surface that achieve the user's goal; remove
  before adding, and a sensible default beats a configurable option.
- **Maximum effect.** Spend the user's attention where it pays off; cut everything that does not earn its
  place.
- **One adaptive design, not many.** Design mobile-first and let a single responsive layout reflow to
  every viewport, input, and device - fluid grids, touch-friendly targets, content prioritized over
  chrome. One design that adapts beats separate per-device mockups.
- **Consistent and legible.** Reuse patterns, labels, and components; make visual weight match importance
  so the one primary action is obvious. Consistency lowers cognitive load; hierarchy guides the eye.
- **Aim for the wow.** Design for a moment of delight, but never at the cost of clarity or accessibility -
  minimalism serves the user, it is not decoration.

## Security principles (least privilege, distrust input)

When building or reviewing anything that touches access, input, dependencies, or secrets, default to:

- **Least privilege, default-deny.** Grant the minimum scope, permission, and access on the narrowest
  surface for the shortest time; deny by default and add only what is needed.
- **Distrust the outside.** Validate and encode every input at trust boundaries; never interpolate
  untrusted data into a shell, query, or template; treat third-party code and data as hostile until proven safe.
- **Secure the supply chain.** Pin dependencies to immutable digests, prefer official and maintained
  sources, and keep secrets out of code, logs, and artifacts.
- **Assume breach, shrink the blast radius.** Scope secrets and credentials (short-lived where possible),
  fail safe, and design so one compromise cannot cascade.

## Review principles (critique with a fix)

When reviewing anything - code, a design, a test plan, agent content - critique to improve it, not to
display taste:

- **Critique against the goal, not taste.** Judge by the requirements and the user's cost; separate
  must-fix from preference, and let tooling own style.
- **Every finding gets a fix and a reason.** No complaint without a concrete proposed change tied to a real cost.
- **Rate severity and lead with it.** Sort findings by impact and call out the top few; an unranked list
  gets ignored.
- **Verify before you opine.** Walk the real path or run it first; a static read misses the defects that matter.
