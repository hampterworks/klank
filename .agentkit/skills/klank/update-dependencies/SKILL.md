---
name: update-dependencies
description: Upgrades pnpm workspace and Cargo.toml dependencies safely - detects breaking changes and runs tests. Use when dependencies need updating or a security advisory requires action.
---

# update-dependencies

## When to use

- Scheduled dependency maintenance
- A security advisory requires a specific package update
- A new feature requires a newer version of a dependency

## Procedure

**JavaScript / pnpm:**

1. Check outdated: `pnpm outdated`
2. For patch/minor updates (low risk): `pnpm update --recursive` then run `build` and `run-tests`.
3. For major version bumps: update one package at a time. Read the package's CHANGELOG for breaking changes before updating.
4. After all JS updates: `pnpm build` and `pnpm nx run-many -t typecheck test`.

**Rust / Cargo:**

5. Check outdated: `cd apps/klank/src-tauri && cargo outdated` (requires `cargo-outdated`).
6. For patch updates: edit `Cargo.toml` version constraints to allow the new version; `cargo update`.
7. For major Tauri updates: read the Tauri migration guide; update `tauri.conf.json`, capabilities JSON, and plugin registrations in `lib.rs` together.
8. After Rust updates: `cargo build` then `pnpm tauri:dev` to verify the app starts.

## Failure modes

- **Breaking API change in a JS dep** → check the package CHANGELOG; update call sites before updating the version.
- **Tauri plugin major version** → capabilities JSON format may change; read the plugin migration notes.
- **Peer dependency conflict** → use `pnpm why <package>` to trace the conflict; resolve by aligning versions.
- **Cargo.lock conflicts** → commit `Cargo.lock` for apps (not libs); resolve conflicts by running `cargo update`.
