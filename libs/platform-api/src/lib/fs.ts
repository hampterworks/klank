import { DirEntry } from '@tauri-apps/plugin-fs'

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
 * Stored in `tab-settings.json` in the app's local data directory.
 */
export type PerTabSettings = {
  fontSize: number
  transpose: number
  scrollSpeed: number
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

type LegacyKlankEntry = {
  fontSize: number
  transpose: number
  scrollSpeed: number
  [key: string]: unknown
}

const createTauriFileService = async (): Promise<FileService> => {
  const { BaseDirectory, readDir, readTextFile, writeTextFile, create, exists } = await import(
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
    const osRelKey = relKey.replace(/\//g, sep)
    return `${baseDir.replace(/[/\\]$/, '')}${sep}${osRelKey}`
  }
  const { open } = await import('@tauri-apps/plugin-dialog')
  const processEntriesRecursively = async (
    parent: string,
    entries: FileTree,
    filter: (name: File) => boolean
  ): Promise<FileTree> => {
    return Promise.all(
      entries
        .filter((file) => filter(file))
        .flatMap(async (entry) => {
          const dir = await join(parent, entry.name)
          if (entry.isDirectory) {
            return {
              ...entry,
              path: dir,
              children: await processEntriesRecursively(
                dir,
                await readDir(dir, { baseDir: BaseDirectory.AppLocalData }),
                filter
              ),
            }
          }
          return {
            ...entry,
            path: dir,
          }
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
        console.log(target, filename)
        const localPath = await join(target ?? '', filename)
        const file = await create(localPath)
        await file.write(new TextEncoder().encode(data))
        await file.close()
        console.log(`File written to ${localPath}`)
        return localPath
      } catch (error) {
        console.log(error)
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

    async readTabSettings(baseDirectory) {
      try {
        const settingsPath = await join(baseDirectory, SETTINGS_FILE)

        // Migrate from legacy .klankrc.json when it still has entries.
        // Runs even if .klank-settings.json already exists — merges without
        // overwriting newer settings. Blanks .klankrc.json on success so this
        // only runs once.
        const legacyPath = await join(baseDirectory, LEGACY_RC_FILE)
        if (await exists(legacyPath)) {
          try {
            const legacyContent = await readTextFile(legacyPath)
            const legacy = JSON.parse(legacyContent) as Record<string, LegacyKlankEntry>
            if (Object.keys(legacy).length > 0) {
              const normBase = baseDirectory.replace(/\\/g, '/').replace(/\/$/, '')
              const migrated: Record<string, PerTabSettings> = {}
              for (const [absPath, entry] of Object.entries(legacy)) {
                const normPath = absPath.replace(/\\/g, '/')
                const relKey = normPath.startsWith(normBase + '/')
                  ? normPath.slice(normBase.length + 1)
                  : normPath
                migrated[relKey] = {
                  fontSize: entry.fontSize,
                  transpose: entry.transpose,
                  scrollSpeed: entry.scrollSpeed,
                }
              }
              // Merge with existing settings — legacy entries fill gaps, newer ones win
              let existing: Record<string, PerTabSettings> = {}
              try {
                const existingContent = await readTextFile(settingsPath)
                existing = JSON.parse(existingContent) as Record<string, PerTabSettings>
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
        // Convert relative keys back to absolute paths
        return Object.fromEntries(
          Object.entries(raw).map(([rel, val]) => [toAbsPath(rel, baseDirectory), val])
        )
      } catch {
        return {}
      }
    },

    async writeTabSetting(tabPath, settings, baseDirectory) {
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
    },
  }
}

/**
 * Creates and returns a `FileService` backed by Tauri's FS and dialog plugins.
 * Must be called from within a Tauri webview context (`__TAURI_INTERNALS__` must exist).
 */
export const createFileService = async (
  mode: 'tauri' | 'server' = 'tauri'
): Promise<FileService> => {
  const serviceFactory = createTauriFileService
  const service = await serviceFactory()

  return {
    ...service,
  }
}
