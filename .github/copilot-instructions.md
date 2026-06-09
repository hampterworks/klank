Klank is a Tauri + React 19 monorepo for viewing guitar tab files and scraping tabs from Ultimate Guitar.

## Commands

```
pnpm dev              # Vite dev server, port 4200
pnpm tauri:dev        # Full Tauri desktop app
pnpm build            # Production build
pnpm test             # Vitest across all libs
pnpm lint             # ESLint across workspace
pnpm nx run-many -t typecheck
```

## Roles

Specialist subagents live in `.github/agents/*.agent.md`, each routed by its `description` — pick the matching one by task. For work spanning ≥ 2 roles, start with the Orchestrator.

## Constraints

- Named exports only — never `export default`
- CSS modules only — no global styles
- `useKlankStore` for persistent state, `useState` for ephemeral only
- Tab files: `.tab.txt` extension only
- Tauri capabilities in `apps/klank/src-tauri/capabilities/*.json` — no CSP bypasses
- Rust commands must be in `generate_handler![]` in `lib.rs`
- Never import `@tauri-apps/*` directly in app components — use `@klank/platform-api`
- Never rename `transpose`, `fontSize`, `scrollSpeed` in `TabSetting` — persisted in localStorage
- Path aliases: `@klank/ui`, `@klank/store`, `@klank/platform-api` — never relative cross-lib imports
