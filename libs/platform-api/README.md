# @klank/platform-api

Platform abstraction layer between the React app and Tauri IPC. All communication with the Tauri backend — file I/O, chord logic, tab downloads — is routed through this library.

## Modules

| Module | Exports | Purpose |
|--------|---------|---------|
| `fs.ts` | `FileService`, `createFileService()`, `mapTreeStructure()` | File I/O via Tauri FS plugin |
| `chords.ts` | `transposeChord()`, `testChords()`, `isTablatureLine()`, etc. | Chord parsing and transposition |
| `download.ts` | `getSheetFromUG()` | Downloads tabs from Ultimate Guitar via Tauri scraper |
| `sort.ts` | `sortByArtist()` | Groups and sorts `FileEntry[]` by artist |
| `userAgent.ts` | `isMobile()` | Mobile device detection |

## Import

```ts
import { createFileService, transposeChord, getSheetFromUG } from '@klank/platform-api'
```

## File Conventions

- Only `.tab.txt` files are recognized; `fs.ts` filters all other extensions.
- Filenames must follow the pattern `Artist - Song.tab.txt`. `mapTreeStructure()` splits on ` - ` to extract artist and song name.

## Chord Transposition

`transposeChord()` uses a 12-note chromatic scale: A, A#, B, C, C#, D, D#, E, F, F#, G, G#. Supports accidentals, slash bass notes, and chord quality suffixes (maj, min, dim, sus, add, etc.).

## UG Scraper

`getSheetFromUG(url)` invokes the Tauri `scrape_ug` Rust command, which opens a hidden webview with a 35-second timeout. The JS side listens for `deliver_ug_html`, parses the UG JSON from the `.js-store` element, strips `[ch]`/`[tab]` markers, and returns `{ data, filename }` or `undefined` on failure.
