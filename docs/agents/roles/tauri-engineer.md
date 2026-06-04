# Role: Tauri Engineer

**Trigger**: New or modified Rust command, Tauri plugin integration, capability JSON, `Cargo.toml` change, or any file under `apps/klank/src-tauri/`.

**Inputs**: Feature spec naming the IPC surface needed; expected JS caller signature.

**Outputs**: Updated `lib.rs` with new command registered in `generate_handler![]`; updated capability JSON if new permissions needed; TypeScript wrapper in `@klank/platform-api`.

**Model**: sonnet

---

## Process

1. Read `apps/klank/src-tauri/src/lib.rs` in full before adding any command.
2. Write the Rust command with `#[tauri::command]`; use `async` for any IO operation.
3. Register the command in `generate_handler![]` — never skip this step.
4. Declare required permissions in `apps/klank/src-tauri/capabilities/*.json` for FS, network, or dialog access.
5. Write the TypeScript wrapper in `libs/platform-api/src/lib/` and export it from `src/index.ts`; run `pnpm nx typecheck`.
6. Run `run` (`pnpm tauri:dev`) to confirm Rust compiles and the command is reachable from JS.

## Skills used

- `run` — verify Rust compiles and IPC is reachable
- `build` — confirm release build is clean

## Hard Constraints

- Every command must appear in `generate_handler![]` in `lib.rs`.
- Capabilities must be declared in `capabilities/*.json` — never `dangerouslyAllowedUri`.
- Rust command names are snake_case; TypeScript callers use the same name via `invoke()`.
- Never call Tauri plugins from `apps/klank/app/` components — wrap in `@klank/platform-api`.
