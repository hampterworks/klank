# @klank/store

Zustand 5 store with Redux DevTools integration and localStorage persistence for the klank app.

- Storage key: `klank-storage` in `localStorage`
- Import: `import { useKlankStore } from '@klank/store'`

## State Fields

| Field | Type | Persisted | Default | Notes |
|-------|------|-----------|---------|-------|
| `baseDirectory` | `string \| undefined` | No | `undefined` | Active tab directory |
| `serverMode` | `boolean \| undefined` | No | `undefined` | Ephemeral; true when not in Tauri |
| `fileService` | `FileService \| undefined` | No | `undefined` | Ephemeral; never persisted |
| `mode` | `"Read" \| "Edit"` | Yes | `"Read"` | Current editor mode |
| `theme` | `"Light" \| "Dark"` | Yes | `"Light"` | App theme |
| `ui.isMenuExtended` | `boolean` | Yes | `true` | Sidebar collapse state |
| `tab.path` | `string` | Yes | `""` | Currently open tab file path |
| `tab.fontSize` | `number` | Yes | `12` | Display font size (clamped 0–22) |
| `tab.transpose` | `number` | Yes | `0` | Semitone offset |
| `tab.scrollSpeed` | `number` | Yes | `1` | Auto-scroll speed (range 1–10) |
| `tab.isScrolling` | `boolean` | No | `false` | Ephemeral playback state |
| `tab.details` | `string` | Yes | `""` | Tab metadata string |
| `tab.link` | `string \| undefined` | Yes | `undefined` | Source URL |
| `tabSettingByPath` | `Record<string, TabSetting>` | Yes | `{}` | Per-file saved settings (prepared, not yet wired) |

## Critical Warning

**Never rename `transpose`, `fontSize`, or `scrollSpeed`.** These keys are written directly to `klank-storage` in localStorage. Renaming them silently drops all persisted user settings on next load.

## Usage Pattern

```ts
const { tab, setTabTranspose } = useKlankStore()
```
