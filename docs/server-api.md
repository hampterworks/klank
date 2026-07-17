# Klank Server API (frozen contract)

The `klank-server` binary (crate `crates/server`, container image `hampterworks/klank`) serves
the SPA and an HTTP/WebSocket API that mirrors the Tauri desktop backend. This document is the
wire contract between the Rust server and the HTTP service implementations in
`@klank/platform-api`. Both sides implement it independently — do not change shapes without
updating both.

## Runtime configuration (env)

| Variable | Default | Meaning |
|---|---|---|
| `KLANK_TABS_DIR` | `/data` | Tab library root and git working tree. Mounted volume. |
| `KLANK_CONFIG_DIR` | `/config` | Secrets/state: `git_token`, `ug_device_id`, `ug_last_stage`. Separate volume so the PAT can never be committed with the tabs repo. |
| `KLANK_STATIC_DIR` | `/app/static` | SPA build output served at `/`. |
| `KLANK_PORT` | `8080` | Listen port (binds `0.0.0.0`). |

## Path semantics

- All file paths on the wire are **absolute container paths under the tabs root**, using
  forward slashes: `/data/Radiohead - Creep.tab.txt`. This matches the desktop absolute-path
  semantics, so the frontend passes paths through verbatim (tree entries, settings keys,
  playlist paths all agree).
- `GET /api/version` reports the root; the frontend uses it as `baseDirectory`.
- **Traversal guard** (every handler that takes a path): reject paths containing `..`
  components or NUL; require the canonicalized path to remain prefixed by the canonicalized
  tabs root (defeats symlink escape). File mutations (write/delete) additionally require the
  `.tab.txt` extension. Violations → `400 {"error": "..."}`.
- On disk, `.klank-settings.json` keeps **relative, forward-slash, sorted** keys (unchanged —
  compatible with desktop clients sharing the same git repo). The server converts rel↔abs at
  the API boundary exactly like the Tauri TS implementation does.

## Errors

Unless a row says otherwise: success is 2xx with the documented JSON body; failures are
`400` (invalid path/params), `404` (missing file), or `500`, all with body `{"error": string}`.
Git mutation endpoints never use HTTP errors for git failures — those are carried inside
`GitResult`/`SyncResult` like the desktop commands.

## Endpoints

### Meta

| Method & path | Request | Response |
|---|---|---|
| `GET /api/version` | — | `{"version": string, "mode": "server", "root": string}` (`version` = crate version; `root` = tabs dir, e.g. `"/data"`) |

### Files & settings

| Method & path | Request | Response |
|---|---|---|
| `GET /api/tree` | — | `RecursiveDirEntry[]` — recursive; dirs + `*.tab.txt` files only; skips dot-dirs and `INTERNAL_DIRS`; unreadable subdirs degrade to `children: []` |
| `GET /api/file?path=` | — | `{"content": string}` |
| `PUT /api/file` | `{"filename": string, "target": string, "content": string}` (`target` = absolute dir under root) | `{"path": string}` — full path written |
| `DELETE /api/file?path=` | — | `204`. Deleting a missing file → `404` (client treats as success, matching desktop) |
| `GET /api/exists?path=` | — | `{"exists": boolean}` |
| `GET /api/settings` | — | `Record<absPath, PerTabSettings>` (reserved keys excluded) |
| `PUT /api/settings/tab` | `{"path": string, "settings": PerTabSettings}` | `204` |
| `DELETE /api/settings/tab?path=` | — | `204` (silently succeeds when absent) |
| `GET /api/playlists` | — | `Playlist[]` (paths absolute) |
| `PUT /api/playlists` | `Playlist[]` | `204` |
| `GET /api/play-metrics` | — | `Record<absPath, PlayMetric>` |
| `PUT /api/play-metrics` | `Record<absPath, PlayMetric>` | `204` |

Shapes (identical to `libs/platform-api/src/lib/fs.ts`):

```ts
RecursiveDirEntry =
  | { name: string; isDirectory: false; isFile: boolean; isSymlink: boolean; path: string }
  | { name: string; isDirectory: true; isFile: false; isSymlink: false; path: string; children: RecursiveDirEntry[] }
PerTabSettings = { fontSize: number; transpose: number; scrollSpeed: number }
PlayMetric     = { playCount: number; lastPlayedAt: number }
Playlist       = { id: string; name: string; paths: string[]; createdAt: number }
```

Settings writes are serialized server-side (single mutex over `.klank-settings.json`); the
legacy `.klankrc.json` migration runs on first settings read, as on desktop.

### Git

The repo is always `KLANK_TABS_DIR`; there is no `dir` parameter.

| Method & path | Request | Response |
|---|---|---|
| `GET /api/git/is-repo` | — | `{"value": boolean}` |
| `GET /api/git/status` | — | `GitChangedFile[]` = `{status, path}[]` |
| `POST /api/git/pull` | — | `GitResult` |
| `POST /api/git/commit` | `{"message": string}` | `GitResult` |
| `POST /api/git/push` | — | `GitResult` |
| `GET /api/git/unpushed` | — | `string[]` |
| `POST /api/git/sync` | — | `RawSyncResult` (snake_case, exactly the Rust `SyncResult` serde output; TS maps to camelCase as today) |
| `GET /api/git/branches` | — | `RawBranchInfo[]` = `{name, is_head, is_remote, upstream?}[]` |
| `POST /api/git/checkout` | `{"branch": string}` | `GitResult` |
| `POST /api/git/clone` | `{"url": string}` | `GitResult` (clones into the tabs dir; tolerates non-empty target like desktop) |
| `PUT /api/git/token` | `{"token": string}` (empty string clears) | `204` |
| `GET /api/git/has-token` | — | `{"value": boolean}` |
| `GET /api/git/is-authenticated` | — | `{"value": boolean}` (token only) |
| `GET /api/git/system-credentials-enabled` | — | `{"value": false}` (always — desktop-only feature) |
| `POST /api/git/use-system-credentials` | — | `GitResult` `{"success": false, "output": "", "error": "System git credentials are not available in server mode"}` |
| `POST /api/git/disable-system-credentials` | — | `204` (no-op) |

`GitResult = {"success": boolean, "output": string, "error"?: string}`.

### Import (Ultimate Guitar)

| Method & path | Request | Response |
|---|---|---|
| `POST /api/import` | `{"url": string}` | `200` NDJSON stream, `Content-Type: application/x-ndjson` |

The body is newline-delimited JSON. Zero or more progress lines — each a serialized
`ImportProgress` (`#[serde(tag = "type")]`):

```json
{"type":"StageStart","id":"ug_mobile_api","label":"UG app API","index":0,"total":2}
{"type":"StageFailed","id":"ug_mobile_api","label":"UG app API","reason":"..."}
{"type":"Succeeded","id":"ug_website","label":"UG website"}
```

followed by exactly one terminal line:

```json
{"done":{"content":"...","artist":"...","song":"..."}}
{"error":"reason"}
```

The server runs only the two headless stages (`ug_mobile_api`, `ug_website`); the hidden-webview
Cloudflare fallback is desktop-only. Invalid/non-UG URL → terminal `{"error": ...}` line (still 200).

### Jam

The server itself is the jam host: `/jam` is always mounted; `start`/`stop` toggle hosting
state (whether broadcasts flow and status reports hosting).

| Method & path | Request | Response |
|---|---|---|
| `POST /api/jam/start` | `{"name": string}` | `{"name": string}` — client derives `port`/`urls` from `window.location` |
| `POST /api/jam/stop` | — | `204` |
| `POST /api/jam/broadcast` | raw `JamSnapshot` JSON object | `204` |
| `GET /api/jam/status` | — | `{"hosting": boolean, "name": string \| null, "clients": number}` — client fills `port`/`urls` from `window.location` |
| `GET /api/jam/discover` | — | `[]` (mDNS is meaningless in a container) |
| `GET /jam` (WebSocket) | — | Guest socket: on connect receives the current snapshot, then rebroadcasts on every change; each frame is the snapshot JSON with `clients` injected (same protocol as desktop `jam-lite`/`connectJam`) |

### Static SPA

`GET /*` serves `KLANK_STATIC_DIR` with an `index.html` fallback for client-side routes.
`/api/*` and `/jam` take precedence.
