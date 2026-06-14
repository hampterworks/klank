# Klank

Klank is a Tauri desktop application for viewing, downloading, and editing guitar tabs stored as local `.tab.txt` files. It provides a two-pane layout: a collapsible file-browser sidebar on the left and a tab-display player on the right.

## Features

- Browse and search a local directory of `.tab.txt` files grouped by artist
- Full-text search with highlighted matches in the file tree
- Chord highlighting within tab content with hover fingering diagrams (guitar/bass selectable)
- Semitone transposition with chromatic chord rewriting
- Auto-scroll with adjustable speed
- Playlists — create named playlists, add tabs, reorder with drag-and-drop, and navigate sequentially; persisted to `.klank-settings.json` in the tab directory
- Download tabs directly from Ultimate Guitar via built-in scraper
- Right-click context menu on file tree entries for tab deletion (with confirmation modal)
- Light and Dark theme including icons and native chrome
- App version displayed on the Settings page
- Metronome — look-ahead Web Audio scheduler with BPM control, tap-tempo, time signature, accent, and subdivisions; beat indicator updates live. Press `m` to open, arrow keys to nudge BPM, `Esc` to close.
- Tuner — plays reference tones for each open string (guitar standard / drop-D / half-step-down, bass standard / 5-string); listen-only, no microphone required. Press `t` to open.
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
> Output artifacts land in `apps/klank/src-tauri/target/release/bundle/`.

For monorepo structure, lib boundaries, naming conventions, and code-style constraints, see `AGENTS.md`.
