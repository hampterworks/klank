# @klank/ui

Shared React component library for klank. Consumed by `apps/klank` and any future packages in the monorepo.

**Important**: never edit this library without the Frontend Engineer role. Component changes cascade to all consumers without producing TypeScript errors at the call sites.

## Import

```ts
import { Button, FileTreeView, Sheet } from '@klank/ui'
```

## Components

| Component | Purpose |
|-----------|---------|
| `Button` | Versatile button; icon-only, label-only, or both; size variants: small / medium / large |
| `IncrementButton` | Value spinner with +/− controls and min/max bounds |
| `Input` | Text input with optional left/right icon slots |
| `Searchbar` | Menu collapse toggle + search filter input |
| `FileTreeView` | Artist-grouped collapsible file browser with search highlight and active item scroll |
| `Toolbar` | Sidebar toolbar: folder picker, refresh, settings, go-to-tab, random, download |
| `SheetToolbar` | Player controls: font size, transpose, scroll speed, play/stop, edit mode toggle |
| `Sheet` | Tab file renderer: chord highlighting, transposition, auto-scroll (transform-based, `requestAnimationFrame`) |
| `ThemeProvider` | Injects CSS custom properties for Light/Dark theme |
| `ToolTip` | Cursor-following hover tooltip |

## Icons

All exported as named SVG components:

PlayIcon, StopIcon, LogoIcon, DownloadIcon, RefreshIcon, SettingsIcon, ShuffleIcon, TargetIcon, FolderIcon, ThemeIcon, FileIcon, ChevronIcon, SearchIcon, MoveLeftIcon, FontSizeIcon, PlusIcon, MinIcon, TransposeIcon, EditIcon, CloseIcon, SpeedIcon

## Styling

- All styles use CSS Modules (`.module.css`). No global style additions are permitted.
- Components consume CSS custom properties (`--background`, `--text`, `--border`, `--selected`, etc.).
- Place `ThemeProvider` at the app root to supply those properties for Light and Dark themes.
