import { DirEntry } from '@tauri-apps/plugin-fs'
import { isTauri } from './platform'

/** A directory entry that may recursively contain children. */
export type RecursiveDirEntry =
  | {
      name: string
      isDirectory: false
      isFile: boolean
      isSymlink: boolean
      path: string
    }
  | {
      name: string
      isDirectory: true
      isFile: false
      isSymlink: false
      path: string
      children: RecursiveDirEntry[]
    }

type File = RecursiveDirEntry | DirEntry

export type FileTree = File[]

/**
 * A parsed tab file entry derived from the `Artist - Song.tab.txt` filename convention.
 * `song` is undefined when the filename has no ` - ` separator.
 */
export type FileEntry = {
  name: string
  path: string
  artist: string
  song?: string
}

/**
 * The three user-adjustable settings saved per tab file.
 * Stored in `.klank-settings.json` in the active tab directory.
 */
export type PerTabSettings = {
  fontSize: number
  transpose: number
  scrollSpeed: number
}

/**
 * Per-song play tracking, keyed by absolute file path.
 * `playCount` is the number of completed play-throughs; `lastPlayedAt` is an
 * epoch-millisecond timestamp of the most recent play.
 */
export type PlayMetric = {
  playCount: number
  lastPlayedAt: number
}

/**
 * A named, ordered collection of tab files.
 * Persisted under the reserved `"playlists"` key in `.klank-settings.json`;
 * paths are stored relative to the base directory in the file, but the
 * `FileService` API exposes them as absolute paths.
 */
export type Playlist = {
  id: string
  name: string
  /** Ordered list of full file-system paths to .tab.txt files. */
  paths: string[]
  createdAt: number
}

/**
 * Platform-agnostic interface for all file system operations used by klank.
 * The Tauri implementation is created via `createFileService()`.
 */
export type FileService = {
  /** Recursively reads `dir`, applying `filter` to each entry before descending. */
  readDirectoryRecursively: (
    dir: string,
    filter: (name: File) => boolean
  ) => Promise<FileTree>
  /** Reads a `.tab.txt` file and returns its content as a UTF-8 string. */
  readTabFile: (path: string) => Promise<string>
  /** Returns the app's local data directory — used as the default tab directory. */
  getBaseDirectoryPath: () => Promise<string>
  /**
   * Writes `data` to a new file named `filename` inside `target`.
   * Returns the full path of the written file, or an error message string on failure.
   */
  writeTabFile: (
    filename: string,
    target: string,
    data: string,
  ) => Promise<string>
  /** Opens the OS native folder-picker dialog. Returns the selected path or null. */
  getDirectoryPath: () => Promise<string | null>
  /** Returns true if `path` exists on the file system. */
  pathExists: (path: string) => Promise<boolean>
  /**
   * Reads `.klank-settings.json` from `baseDirectory`.
   * Keys in the returned map are absolute paths (baseDirectory + separator + relative key).
   * Returns an empty object when the file does not yet exist.
   */
  readTabSettings: (baseDirectory: string) => Promise<Record<string, PerTabSettings>>
  /**
   * Persists the settings for a single tab into `.klank-settings.json` in `baseDirectory`.
   * Keys are stored as paths relative to `baseDirectory` (forward-slash separated, portable).
   * The file is sorted by key on every write to produce minimal git diffs.
   */
  writeTabSetting: (tabPath: string, settings: PerTabSettings, baseDirectory: string) => Promise<void>
  /**
   * Permanently deletes a tab file from disk.
   * Throws on failure (permission denied, file locked); callers may treat a
   * missing file ("No such file" / os error 2) as success.
   */
  deleteTabFile: (path: string) => Promise<void>
  /**
   * Removes the entry for `tabPath` from `.klank-settings.json` in `baseDirectory`.
   * Keys are stored relative to `baseDirectory` (forward-slash separated), so the
   * incoming path is normalised the same way `writeTabSetting` does.
   * Silently succeeds when the file or the entry does not exist.
   */
  deleteTabSetting: (tabPath: string, baseDirectory: string) => Promise<void>
  /**
   * Reads the playlists stored under the reserved `"playlists"` key in
   * `.klank-settings.json` in `baseDirectory`. Playlist paths are returned
   * as absolute paths. Returns an empty array when the file or the key
   * does not exist.
   */
  readPlaylists: (baseDirectory: string) => Promise<Playlist[]>
  /**
   * Persists all playlists under the reserved `"playlists"` key in
   * `.klank-settings.json` in `baseDirectory`, leaving per-tab entries
   * untouched. Playlist paths are stored relative to `baseDirectory`
   * (forward-slash separated, portable).
   */
  writePlaylists: (playlists: Playlist[], baseDirectory: string) => Promise<void>
  /**
   * Reads the per-song play metrics stored under the reserved `"playMetrics"`
   * key in `.klank-settings.json` in `baseDirectory`. Keys in the returned map
   * are absolute paths. Returns an empty object when the file or the key does
   * not exist.
   */
  readPlayMetrics: (baseDirectory: string) => Promise<Record<string, PlayMetric>>
  /**
   * Persists all play metrics under the reserved `"playMetrics"` key in
   * `.klank-settings.json` in `baseDirectory`, leaving per-tab entries and
   * playlists untouched. Keys are stored relative to `baseDirectory`
   * (forward-slash separated, portable).
   */
  writePlayMetrics: (playMetricByPath: Record<string, PlayMetric>, baseDirectory: string) => Promise<void>
}

/**
 * Flattens a recursive directory tree into a list of `FileEntry` objects.
 *
 * Only files with a `.tab.txt` extension are included. The filename (minus the
 * extension) is split on ` - ` to derive `artist` and `song`:
 * `"Radiohead - Creep.tab.txt"` → `{ artist: "Radiohead", song: "Creep" }`.
 */
export const mapTreeStructure = (
  files: (DirEntry | RecursiveDirEntry)[]
): FileEntry[] => {
  return files
    ?.flatMap((file: DirEntry | RecursiveDirEntry) => {
      if ('path' in file) {
        if (file.isDirectory && file.children.length !== 0) {
          return mapTreeStructure(file.children)
        } else if (file.isFile) {
          const fileName = file.name.replace(/\.tab\.txt$/, '')

          return {
            name: fileName,
            path: file.path,
            artist: fileName.split(' - ')[0],
            song: fileName.split(' - ')[1],
          }
        }
      }

      return undefined
    })
    .filter(Boolean) as FileEntry[]
}

const SETTINGS_FILE = '.klank-settings.json'
const LEGACY_RC_FILE = '.klankrc.json'
// Reserved top-level keys in .klank-settings.json. Cannot collide with tab
// entries because tab keys always end in `.tab.txt`.
const PLAYLISTS_KEY = 'playlists'
const PLAY_METRICS_KEY = 'playMetrics'
// Every reserved key must be skipped when reading per-tab settings, otherwise
// its non-PerTabSettings value would be mapped as if it were a tab entry.
const RESERVED_KEYS = new Set<string>([PLAYLISTS_KEY, PLAY_METRICS_KEY])

type LegacyKlankEntry = {
  fontSize: number
  transpose: number
  scrollSpeed: number
  [key: string]: unknown
}

const createTauriFileService = async (): Promise<FileService> => {
  const { readDir, readTextFile, writeTextFile, create, exists, remove } = await import(
    '@tauri-apps/plugin-fs'
  )
  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')

  const toRelativeKey = (absPath: string, baseDir: string) => {
    const norm = absPath.replace(/\\/g, '/')
    const normBase = baseDir.replace(/\\/g, '/').replace(/\/$/, '')
    return norm.startsWith(normBase + '/') ? norm.slice(normBase.length + 1) : norm
  }

  const toAbsPath = (relKey: string, baseDir: string) => {
    const sep = baseDir.includes('\\') ? '\\' : '/'
    // Already an absolute path (Windows drive letter or Unix root) — just normalise separator
    if (/^[A-Za-z]:/.test(relKey) || relKey.startsWith('/')) {
      return relKey.replace(/\//g, sep)
    }
    const osRelKey = relKey.replace(/\//g, sep)
    return `${baseDir.replace(/[/\\]$/, '')}${sep}${osRelKey}`
  }
  const { open } = await import('@tauri-apps/plugin-dialog')

  // All mutations of .klank-settings.json are read-modify-write cycles on the
  // same file. Callers fire them without awaiting (e.g. deleting a tab kicks
  // off writeTabSetting, writePlaylists, and deleteTabSetting concurrently),
  // so they must be serialized or whichever writer read the file first
  // silently clobbers the others' changes on completion.
  let settingsFileLock: Promise<unknown> = Promise.resolve()
  const withSettingsLock = <T>(task: () => Promise<T>): Promise<T> => {
    const run = settingsFileLock.then(task, task)
    settingsFileLock = run.catch(() => undefined)
    return run
  }
  // On mobile the tab directory is the app's private data root, which also holds
  // the WebView profile, HTTP/code caches, prefs, logs, etc. Tabs live alongside
  // these, so the scan must NOT descend into them: the Chromium cache tree is
  // huge and, on some devices, a `readDir` inside it throws — which used to
  // reject the whole scan and leave the file tree empty after the cache grew
  // (a relaunch-only, device-specific failure). A user-chosen tab folder on
  // desktop never contains these names, so skipping them is a no-op there.
  const INTERNAL_DIRS = new Set([
    'app_webview', 'cache', 'code_cache', 'shared_prefs',
    'no_backup', 'logs', 'app_textures', 'files',
  ])

  const processEntriesRecursively = async (
    parent: string,
    entries: FileTree,
    filter: (name: File) => boolean
  ): Promise<FileTree> => {
    const kept = entries.filter(
      (file) =>
        filter(file) &&
        !(file.isDirectory && (INTERNAL_DIRS.has(file.name) || file.name.startsWith('.')))
    )
    return Promise.all(
      kept.map(async (entry) => {
        const dir = await join(parent, entry.name)
        if (entry.isDirectory) {
          // A subdirectory we can't read must never fail the whole scan — skip
          // it (no children) so every other tab still loads.
          let children: FileTree = []
          try {
            children = await processEntriesRecursively(dir, await readDir(dir), filter)
          } catch {
            children = []
          }
          return { ...entry, path: dir, children }
        }
        return { ...entry, path: dir }
      })
    )
  }

  return {
    async writeTabFile(
      filename: string,
      target: string,
      data: string
    ): Promise<string> {
      try {
        const localPath = await join(target ?? '', filename)
        const file = await create(localPath)
        await file.write(new TextEncoder().encode(data))
        await file.close()
        return localPath
      } catch (error) {
        console.error('Failed to write tab file:', error)
        return error instanceof Error ? error.message : 'Unknown error occurred'
      }
    },

    async pathExists(path) {
      return await exists(path)
    },

    async readDirectoryRecursively(
      dir: string,
      filter: (name: File) => boolean
    ) {
      const entries = await readDir(dir)
      return await processEntriesRecursively(dir, entries, filter)
    },

    async readTabFile(path) {
      return await readTextFile(path)
    },

    async getBaseDirectoryPath() {
      return await appLocalDataDir()
    },

    async getDirectoryPath(){
      return await open({
        multiple: false,
        directory: true,
      })
    },

    readTabSettings(baseDirectory) {
      // Under the lock because the legacy migration below writes the settings file.
      return withSettingsLock(async () => {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)

        // Migrate from legacy .klankrc.json when it still has entries.
        // The old app may have stored .klankrc.json in a different directory than
        // the tab files themselves, so we detect the actual tab directory from the
        // paths inside the file rather than assuming they share baseDirectory.
        // Writes .klank-settings.json into the detected tab directory with relative
        // keys, then blanks .klankrc.json so migration only runs once.
        const legacyPath = await join(baseDirectory, LEGACY_RC_FILE)
        if (await exists(legacyPath)) {
          try {
            const legacyContent = await readTextFile(legacyPath)
            const legacy = JSON.parse(legacyContent) as Record<string, LegacyKlankEntry>
            const rawKeys = Object.keys(legacy).filter(k => k.endsWith('.tab.txt'))

            if (rawKeys.length > 0) {
              // Normalise all paths to forward slashes for processing
              const normKeys = rawKeys.map(k => k.replace(/\\/g, '/'))

              // Find the longest common directory prefix across all tab paths
              const dirs = normKeys.map(k => k.substring(0, k.lastIndexOf('/')))
              let tabDir = dirs[0]
              for (const dir of dirs.slice(1)) {
                while (tabDir && dir !== tabDir && !dir.startsWith(tabDir + '/')) {
                  tabDir = tabDir.substring(0, tabDir.lastIndexOf('/'))
                }
              }

              // Build relative-keyed settings. Keys are relative to tabDir (the
              // common prefix detected from the old paths), which preserves any
              // subdirectory structure even if the repo has moved to a new machine.
              // Filenames that were already relative, or whose old prefix can't be
              // stripped, fall back to just the basename.
              const migrated: Record<string, PerTabSettings> = {}
              for (const [rawKey, entry] of Object.entries(legacy)) {
                if (!rawKey.endsWith('.tab.txt')) continue
                const normKey = rawKey.replace(/\\/g, '/')
                let relKey = normKey
                if (tabDir && normKey.startsWith(tabDir + '/')) {
                  relKey = normKey.slice(tabDir.length + 1)
                } else {
                  // Path is from a different machine or location — use just the filename
                  relKey = normKey.slice(normKey.lastIndexOf('/') + 1)
                }
                migrated[relKey] = {
                  fontSize: entry.fontSize,
                  transpose: entry.transpose,
                  scrollSpeed: entry.scrollSpeed,
                }
              }

              // Always write to settingsPath (baseDirectory/.klank-settings.json).
              // Writing to the detected osTabDir was wrong when the repo has moved
              // machines, because the old absolute paths no longer match baseDirectory.
              let existing: Record<string, PerTabSettings> = {}
              try {
                const existingContent = await readTextFile(settingsPath)
                const existingRaw = JSON.parse(existingContent) as Record<string, PerTabSettings>
                // Skip stale absolute-path keys left by an earlier buggy migration
                existing = Object.fromEntries(
                  Object.entries(existingRaw).filter(([k]) => !/^[A-Za-z]:/.test(k) && !k.startsWith('/'))
                )
              } catch { /* file doesn't exist yet */ }

              const merged = { ...migrated, ...existing }
              const sorted = Object.fromEntries(
                Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))
              )
              await writeTextFile(settingsPath, JSON.stringify(sorted, null, 2))
              await writeTextFile(legacyPath, '{}')
            }
          } catch (err) {
            console.error('Failed to migrate .klankrc.json:', err)
          }
        }

        const content = await readTextFile(settingsPath)
        const raw = JSON.parse(content) as Record<string, PerTabSettings>
        // Convert relative keys back to absolute paths, skipping reserved keys
        // (playlists and playMetrics are read via their own methods instead)
        return Object.fromEntries(
          Object.entries(raw)
            .filter(([rel]) => !RESERVED_KEYS.has(rel))
            .map(([rel, val]) => [toAbsPath(rel, baseDirectory), val])
        )
      } catch {
        return {}
      }
      })
    },

    writeTabSetting(tabPath, settings, baseDirectory) {
      return withSettingsLock(async () => {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)
        // Read current file, merge, sort keys, write back
        let current: Record<string, PerTabSettings> = {}
        try {
          const content = await readTextFile(settingsPath)
          current = JSON.parse(content) as Record<string, PerTabSettings>
        } catch { /* file doesn't exist yet */ }

        const relKey = toRelativeKey(tabPath, baseDirectory)
        current[relKey] = settings

        const sorted = Object.fromEntries(
          Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
        )
        await writeTextFile(settingsPath, JSON.stringify(sorted, null, 2))
      } catch (error) {
        console.error('Failed to write tab setting:', error)
      }
      })
    },

    async deleteTabFile(path) {
      await remove(path)
    },

    async readPlaylists(baseDirectory) {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)
        const content = await readTextFile(settingsPath)
        const raw = JSON.parse(content) as Record<string, unknown>
        const stored = raw[PLAYLISTS_KEY]
        if (!Array.isArray(stored)) return []
        return (stored as Playlist[]).map((playlist) => ({
          ...playlist,
          paths: playlist.paths.map((rel) => toAbsPath(rel, baseDirectory)),
        }))
      } catch {
        return []
      }
    },

    writePlaylists(playlists, baseDirectory) {
      return withSettingsLock(async () => {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)
        // Read current file, replace the playlists key, sort keys, write back
        let current: Record<string, unknown> = {}
        try {
          const content = await readTextFile(settingsPath)
          current = JSON.parse(content) as Record<string, unknown>
        } catch { /* file doesn't exist yet */ }

        current[PLAYLISTS_KEY] = playlists.map((playlist) => ({
          ...playlist,
          paths: playlist.paths.map((abs) => toRelativeKey(abs, baseDirectory)),
        }))

        const sorted = Object.fromEntries(
          Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
        )
        await writeTextFile(settingsPath, JSON.stringify(sorted, null, 2))
      } catch (error) {
        console.error('Failed to write playlists:', error)
      }
      })
    },

    async readPlayMetrics(baseDirectory) {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)
        const content = await readTextFile(settingsPath)
        const raw = JSON.parse(content) as Record<string, unknown>
        const stored = raw[PLAY_METRICS_KEY]
        if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return {}
        return Object.fromEntries(
          Object.entries(stored as Record<string, PlayMetric>)
            .map(([rel, val]) => [toAbsPath(rel, baseDirectory), val])
        )
      } catch {
        return {}
      }
    },

    writePlayMetrics(playMetricByPath, baseDirectory) {
      return withSettingsLock(async () => {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)
        // Read current file, replace the playMetrics key, sort keys, write back
        let current: Record<string, unknown> = {}
        try {
          const content = await readTextFile(settingsPath)
          current = JSON.parse(content) as Record<string, unknown>
        } catch { /* file doesn't exist yet */ }

        const metrics = Object.fromEntries(
          Object.entries(playMetricByPath)
            .map(([abs, val]): [string, PlayMetric] => [toRelativeKey(abs, baseDirectory), val])
            .sort(([a], [b]) => a.localeCompare(b))
        )
        current[PLAY_METRICS_KEY] = metrics

        const sorted = Object.fromEntries(
          Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
        )
        await writeTextFile(settingsPath, JSON.stringify(sorted, null, 2))
      } catch (error) {
        console.error('Failed to write play metrics:', error)
      }
      })
    },

    deleteTabSetting(tabPath, baseDirectory) {
      return withSettingsLock(async () => {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)
        const content = await readTextFile(settingsPath)
        const current = JSON.parse(content) as Record<string, PerTabSettings>

        const relKey = toRelativeKey(tabPath, baseDirectory)
        if (!(relKey in current)) return
        delete current[relKey]

        const sorted = Object.fromEntries(
          Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
        )
        await writeTextFile(settingsPath, JSON.stringify(sorted, null, 2))
      } catch (error) {
        console.error('Failed to delete tab setting:', error)
      }
      })
    },
  }
}

// ── HTTP (server-mode) implementation ─────────────────────────────────────────

/** `GET /api/version` payload; `root` is the tabs dir used as the base directory. */
type VersionResponse = { version: string; mode: string; root: string }

// The version response is immutable for a session, so fetch it once and reuse
// it for every getBaseDirectoryPath call.
let versionCache: Promise<VersionResponse> | undefined
const fetchVersion = (): Promise<VersionResponse> => {
  if (!versionCache) {
    versionCache = fetch('/api/version').then((r) => r.json() as Promise<VersionResponse>)
  }
  return versionCache
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Reads the `{error}` message from a failed response, falling back to the status. */
const errorMessage = async (res: Response): Promise<string> => {
  try {
    const json = (await res.json()) as { error?: string }
    if (json.error) return json.error
  } catch {
    // Body was not the documented `{error}` JSON — fall through to the status.
  }
  return `Request failed with ${res.status}`
}

/** Recursively re-applies the caller's `filter`, matching the Tauri scan's observable output. */
const applyFilter = (
  entries: RecursiveDirEntry[],
  filter: (file: File) => boolean
): FileTree =>
  entries
    .filter(filter)
    .map((entry) =>
      entry.isDirectory ? { ...entry, children: applyFilter(entry.children, filter) } : entry
    )

/**
 * A `FileService` backed by the klank-server HTTP API (`/api/...`). All paths on
 * the wire are absolute container paths, so no rel↔abs conversion happens here —
 * the server owns it, matching the desktop absolute-path semantics.
 */
const createHttpFileService = async (): Promise<FileService> => ({
  async readDirectoryRecursively(_dir, filter) {
    const res = await fetch('/api/tree')
    if (!res.ok) throw new Error(await errorMessage(res))
    return applyFilter((await res.json()) as RecursiveDirEntry[], filter)
  },

  async readTabFile(path) {
    const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`)
    if (!res.ok) throw new Error(await errorMessage(res))
    return ((await res.json()) as { content: string }).content
  },

  async getBaseDirectoryPath() {
    return (await fetchVersion()).root
  },

  async writeTabFile(filename, target, data) {
    try {
      const res = await fetch('/api/file', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ filename, target, content: data }),
      })
      if (!res.ok) return await errorMessage(res)
      return ((await res.json()) as { path: string }).path
    } catch (error) {
      console.error('Failed to write tab file:', error)
      return error instanceof Error ? error.message : 'Unknown error occurred'
    }
  },

  // No native folder picker in a browser; callers fall back to the default dir.
  async getDirectoryPath() {
    return null
  },

  async pathExists(path) {
    const res = await fetch(`/api/exists?path=${encodeURIComponent(path)}`)
    return ((await res.json()) as { exists: boolean }).exists
  },

  async readTabSettings() {
    // The server keys settings by absolute path already; baseDirectory is unused.
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return {}
      return (await res.json()) as Record<string, PerTabSettings>
    } catch {
      return {}
    }
  },

  async writeTabSetting(tabPath, settings) {
    try {
      await fetch('/api/settings/tab', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ path: tabPath, settings }),
      })
    } catch (error) {
      console.error('Failed to write tab setting:', error)
    }
  },

  async deleteTabFile(path) {
    const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    // A missing file is treated as success, matching the desktop caller contract.
    if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res))
  },

  async deleteTabSetting(tabPath) {
    try {
      await fetch(`/api/settings/tab?path=${encodeURIComponent(tabPath)}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to delete tab setting:', error)
    }
  },

  async readPlaylists() {
    try {
      const res = await fetch('/api/playlists')
      if (!res.ok) return []
      return (await res.json()) as Playlist[]
    } catch {
      return []
    }
  },

  async writePlaylists(playlists) {
    try {
      await fetch('/api/playlists', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(playlists),
      })
    } catch (error) {
      console.error('Failed to write playlists:', error)
    }
  },

  async readPlayMetrics() {
    try {
      const res = await fetch('/api/play-metrics')
      if (!res.ok) return {}
      return (await res.json()) as Record<string, PlayMetric>
    } catch {
      return {}
    }
  },

  async writePlayMetrics(playMetricByPath) {
    try {
      await fetch('/api/play-metrics', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(playMetricByPath),
      })
    } catch (error) {
      console.error('Failed to write play metrics:', error)
    }
  },
})

/**
 * Creates a `FileService` for the current runtime: Tauri's FS + dialog plugins
 * inside a webview, or the klank-server HTTP API in a plain browser.
 */
export const createFileService = async (): Promise<FileService> =>
  isTauri() ? createTauriFileService() : createHttpFileService()
