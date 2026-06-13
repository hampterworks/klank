# apps/klank

The Tauri application. Contains the React frontend under `app/` and the Rust backend under `src-tauri/`.

## Entry Points

| File | Role |
|------|------|
| `app/app.tsx` | Main component — initializes `FileService`, builds the directory tree |
| `app/root.tsx` | Root layout — wraps the app in `ThemeProvider` |
| `app/routes.tsx` | React Router 7 route config — index renders `App`, `/about` renders `About` |

## Layout

Two-pane layout:

- **Menu sidebar** (`components/menu/Menu.tsx`) — left pane, 400 px expanded, collapses to 52 px. Contains the logo, toolbar (folder picker, refresh, settings, go-to-tab, random, download), the artist-grouped file tree, and the search bar.
- **Player** (`components/player/Player.tsx`) — right pane, `1fr`. Contains `SheetToolbar` (font size, transpose, scroll speed, play/stop, edit mode toggle) and the `Sheet` tab renderer.

## FileService Initialization

On startup `app.tsx` calls `createFileService()` from `@klank/platform-api`, which reads `appLocalDataDir` from Tauri as the default base directory. The user can change the directory at any time via the folder-picker dialog in the toolbar.

## Tauri Backend

| Location | Contents |
|----------|----------|
| `src-tauri/src/lib.rs` | Three Rust commands: `scrape_ug`, `deliver_ug_html`, `report_ug_error` |
| `src-tauri/capabilities/` | Tauri capability declarations — never bypassed with `dangerouslyAllowedUri` |

Never import `@tauri-apps/*` packages directly inside `app/` components. All platform calls must go through `@klank/platform-api`.
