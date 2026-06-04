# Klank

Klank is a Tauri desktop application for viewing, downloading, and editing guitar tabs stored as local `.tab.txt` files. It provides a two-pane layout: a collapsible file-browser sidebar on the left and a tab-display player on the right.

## Features

- Browse and search a local directory of `.tab.txt` files grouped by artist
- Full-text search with highlighted matches in the file tree
- Chord highlighting within tab content
- Semitone transposition with chromatic chord rewriting
- Auto-scroll with adjustable speed
- Download tabs directly from Ultimate Guitar via built-in scraper
- Light and Dark theme
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

For monorepo structure, lib boundaries, naming conventions, and code-style constraints, see `AGENTS.md`.
