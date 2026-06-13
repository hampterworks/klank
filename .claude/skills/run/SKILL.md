---
name: run
description: Starts the Vite dev server or full Tauri desktop app. Use when starting development or verifying UI changes in the running app.
---

# run

## When to use

- Before any visual verification step in Frontend Engineer or UX Designer roles
- To confirm a Tauri command is reachable from JS after wiring it up
- To reproduce a UI bug before and after a fix

## Procedure

1. For Vite-only (React UI, no Rust backend): `pnpm dev` - serves on `http://localhost:4200`.
2. For full Tauri desktop app (includes Rust backend, IPC, file system): `pnpm tauri:dev` - opens the native desktop window with hot reload.
3. After running, check the terminal for Rust compile errors before inspecting the UI.
4. In Tauri dev mode, right-click the window and select Inspect to open browser devtools.

## Failure modes

- **Rust compile error on start** → fix the Rust error shown in the terminal before proceeding to UI verification.
- **Port 4200 in use** → kill the existing process (`lsof -ti:4200 | xargs kill`) or change the port in `apps/klank/vite.config.ts`.
- **Tauri window doesn't open** → check `apps/klank/src-tauri/tauri.conf.json §build.devUrl` matches the Vite server address.
- **`pnpm tauri:dev` not found** → run `pnpm install` first to ensure the Tauri CLI is installed.
