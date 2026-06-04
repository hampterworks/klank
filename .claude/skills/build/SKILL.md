---
name: build
description: Runs the full NX build pipeline including TypeScript type-check and lint. Use before any PR or to verify structural changes.
---

# build

## When to use

- Before opening a PR
- After any structural change (new lib, config update, new path alias)
- To confirm a Tauri release bundle compiles cleanly

## Procedure

1. Full build + type-check + lint: `pnpm nx run-many -t build typecheck lint`
2. Single project: `pnpm nx build klank`
3. Tauri release bundle: `pnpm nx run klank:tauri:build` — produces platform-specific binary in `apps/klank/src-tauri/target/release/`.

## Failure modes

- **TypeScript error in a lib** → `pnpm nx typecheck @klank/<lib>` to isolate the project, then fix the type error.
- **Rust compile error** → `cd apps/klank/src-tauri && cargo build` for the full Rust error with line numbers.
- **`tsconfig.base.json` path alias missing** → add the `@klank/<name>` entry to `§paths` and a matching `references` entry in `tsconfig.json`.
- **NX cache issue** → `pnpm nx reset` clears the cache; then re-run.
