# Klank

Klank is a Tauri desktop application for viewing, downloading, and editing guitar tabs stored as local `.tab.txt` files. It provides a two-pane layout: a collapsible file-browser sidebar on the left and a tab-display player on the right.

## Features

- Browse and search a local directory of `.tab.txt` files grouped by artist
- Full-text search with highlighted matches in the file tree
- Chord highlighting within tab content with hover fingering diagrams (guitar/bass selectable)
- Semitone transposition with chromatic chord rewriting
- Harmony panel — scale and mode browser with fretboard diagrams, diatonic chord-scale lookup, and chord-diagram rendering for guitar/bass
- Auto-scroll with adjustable speed
- Playlists — create named playlists, add tabs, reorder with drag-and-drop, and navigate sequentially; persisted to `.klank-settings.json` in the tab directory
- Jam mode — host a LAN session that broadcasts the active tab, transpose, and live scroll position to other devices on the network
- Download tabs directly from Ultimate Guitar via built-in scraper
- In-app git sync — pull/commit/push the tab directory from the Settings panel, with token or system-credential authentication
- Right-click context menu on file tree entries for tab deletion (with confirmation modal)
- Light and Dark theme including icons and native chrome
- App version displayed on the Settings page
- Metronome — look-ahead Web Audio scheduler with BPM control, tap-tempo, time signature, accent, and subdivisions; beat indicator updates live. Press `m` to open, arrow keys to nudge BPM, `Esc` to close.
- Tuner — plays reference tones for each open string (guitar standard / drop-D / half-step-down, bass standard / 5-string); listen-only, no microphone required. Press `t` to open.
- Android build, alongside desktop, via Tauri's mobile target
- Keyboard shortcuts for navigation and playback

## Tech Stack

- Tauri 2 (Rust backend)
- React 19
- React Router 7
- Vite 7
- NX monorepo
- pnpm

## Prerequisites

- Node.js 20+
- Rust 1.77+
- pnpm 10+

## Quick Start

```sh
pnpm install
pnpm tauri:dev
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server only (React, no Tauri shell), port 4200 |
| `pnpm tauri:dev` | Full Tauri desktop app with hot reload |
| `pnpm tauri:android:dev` | Run on Android (emulator/device) |
| `pnpm build` | Production Vite build |
| `pnpm test` | Vitest across all libs |
| `pnpm lint` | ESLint across workspace |
| `pnpm nx run-many -t typecheck` | TypeScript type-check across all projects |

## Building for Release

| Command | Description |
|---------|-------------|
| `pnpm tauri:build` | Release build for the current platform (all configured bundle targets) |
| `pnpm tauri:build:windows` | Windows-specific release build — produces NSIS installer (`.exe`) and MSI package (`.msi`) |

> **Windows prerequisites**: The NSIS and MSI bundlers require [NSIS](https://nsis.sourceforge.io/) and the [WiX Toolset](https://wixtoolset.org/) to be installed and available on `PATH`. Tauri will prompt with install instructions if they are missing.
>
> **Updater signing**: `createUpdaterArtifacts` is enabled, so desktop release builds require the updater signing key in `TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). CI provides them from repository secrets; for a local bundle, export them or temporarily set `bundle.createUpdaterArtifacts` to `false` in `tauri.conf.json`.
>
> Output artifacts land in `apps/klank/src-tauri/target/release/bundle/`.

## Docker (server build)

The Docker image is a self-contained Klank **server**: a single `klank-server` binary
(no Tauri/GUI) that serves the SPA plus the full HTTP/WebSocket API (`/api/*`) and jam host
(`/jam`) on port `8080`. It mirrors the desktop backend — file access, settings, git sync,
tab imports, and LAN jam all work against a mounted tab library. See
[`docs/server-api.md`](docs/server-api.md) for the wire contract.

**Quick start**

```sh
docker run -d -p 8080:8080 \
  -v ./data:/data \
  -v klank-config:/config \
  hampterworks/klank
# http://localhost:8080
```

**Environment**

| Variable | Default | Meaning |
|---|---|---|
| `KLANK_TABS_DIR` | `/data` | Tab library root and git working tree (mounted volume). |
| `KLANK_CONFIG_DIR` | `/config` | Secrets/state: git token, UG device id (separate volume). |
| `KLANK_STATIC_DIR` | `/app/static` | SPA build output served at `/`. |
| `KLANK_PORT` | `8080` | Listen port (binds `0.0.0.0`). |

**Volumes**

- `/data` — your tab library and its git repository. Bind-mount a host directory here.
- `/config` — server secrets and state. The git personal access token (PAT) is stored here,
  **never** in the tabs repo, so it can't be committed and pushed to your remote. Use a named
  volume (or a directory you don't commit) for `/config`.

**Compose**

```sh
docker compose up --build   # builds the image and starts the klank service
```

`docker-compose.yml` mounts `./data` for the tab library and a named `klank-config` volume for
secrets, and restarts the container unless stopped.

**CI publishing**

`.github/workflows/docker.yml` pushes to Docker Hub on pushes to the default branch as `<DOCKERHUB_USERNAME>/klank:latest`, plus `sha-*` and branch tags. Requires repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (a Docker Hub access token with Read/Write scope, not the account password).

For monorepo structure, lib boundaries, naming conventions, and code-style constraints, see `AGENTS.md`.
