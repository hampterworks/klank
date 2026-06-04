# Cleanup Smell Catalogue — Klank

Apply these checks in order during a cleanup pass. Subtract before adding.

## Exports

- [ ] `export default` anywhere in `libs/` or `apps/klank/app/` → replace with named export
- [ ] Barrel `src/index.ts` re-exporting a default → convert to named re-export

## Imports

- [ ] Relative import crossing a lib boundary (e.g. `../../libs/ui/...`) → replace with `@klank/<lib>` alias
- [ ] `@tauri-apps/*` imported directly in `apps/klank/app/` component → move call to `@klank/platform-api`
- [ ] Unused import → remove

## State

- [ ] `useState` used for persistent data (file path, tab settings, theme) → move to `useKlankStore`
- [ ] Direct Zustand store mutation outside a store action → wrap in an action or use `setState`

## CSS

- [ ] Global style added to `styles.css` or `root.tsx` → move to a `.module.css` file
- [ ] Inline `style={{...}}` for structural layout → move to `.module.css`

## Tauri / Rust

- [ ] Rust command written but not registered in `generate_handler![]` in `lib.rs` → register it
- [ ] Tauri capability missing for a plugin the command uses → add to `capabilities/*.json`
- [ ] `invoke()` called in a component directly (bypassing `platform-api`) → wrap in `platform-api`

## Music / Tab domain

- [ ] `transpose`, `fontSize`, or `scrollSpeed` renamed → revert; these are persisted field names
- [ ] Tab file extension hardcoded outside `libs/platform-api/src/lib/fs.ts` → centralise
- [ ] Chord name using non-standard spelling in display context → normalise to A, Bb, B, C, C#, D, Eb, E, F, F#, G, Ab

## General

- [ ] Dead code (commented-out blocks, unreachable branches) → delete
- [ ] `console.log` left in production code → remove or replace with `tauri_plugin_log`
- [ ] TODO comment without a linked issue → resolve or create an issue
