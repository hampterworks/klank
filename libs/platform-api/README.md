# @klank/platform-api

Platform abstraction layer between the React app and Tauri IPC. All communication with the Tauri backend — file I/O, chord logic, tab downloads — is routed through this library.

## Modules

| Module | Exports | Purpose |
|--------|---------|---------|
| `fs.ts` | `FileService`, `createFileService()`, `mapTreeStructure()` | File I/O via Tauri FS plugin |
| `chord-symbol.ts` | `parseChordSymbol()`, `formatChordSymbol()`, `transposeChordSymbol()` | Structured chord-symbol parsing, formatting, and transposition |
| `chord-theory.ts` | `parseChordKey()`, `CHORD_INTERVALS`, `validateChordVariant()`, etc. | Pitch-class theory and chord-diagram validation |
| `chords.ts` | `transposeChord()`, `testChords()`, `isTablatureLine()`, etc. | Tab-text heuristics and string-level chord helpers |
| `sheet-lines.ts` | `classifySheetLine()` | Pure tab-sheet line classification for the renderer |
| `chord-diagrams.ts` | `loadChordDiagrams()`, `lookupChordDiagram()`, `normalizeChordKey()` | Chord diagram data loading and lookup |
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

## Chord Symbols

All chord interpretation flows through one model: `parseChordSymbol()` resolves a symbol's root and slash-bass notes to pitch classes (C = 0, shared with `chord-theory.ts`) and validates the quality suffix against a permissive grammar (maj, min, dim, aug, sus, add, extensions like 7/9/11/13, altered tones like `m7b5` or `7#9`, `6/9`, and the jazz symbols `-` minor, `+` augmented, `°` diminished, `ø` half-diminished). Output is always spelled in sharps: A, A#, B, C, C#, D, D#, E, F, F#, G, G#.

`transposeChord()` transposes a chord string by semitones, preserving the suffix verbatim and moving root and bass together; non-chord input is returned unchanged. `toTheoryChord()` bridges parsed symbols to the strict `chord-theory.ts` model, and `canonicalSuffix()` folds equivalent spellings (`D-7`, `Dmin7`, `DM7`, `Cø`) onto the canonical quality so chord-diagram lookups resolve regardless of spelling.

## UG Scraper

`getSheetFromUG(url)` invokes the Tauri `scrape_ug` Rust command, which opens a hidden webview with a 35-second timeout. The JS side listens for `deliver_ug_html`, parses the UG JSON from the `.js-store` element, strips `[ch]`/`[tab]` markers, and returns `{ data, filename }` or `undefined` on failure.
