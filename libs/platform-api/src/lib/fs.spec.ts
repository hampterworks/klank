import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

// ── Tauri plugin mocks ────────────────────────────────────────────────────────
// createTauriFileService does a dynamic import of these three modules, so we
// must mock them before importing createFileService.

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 'AppLocalData' },
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  create: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: vi.fn(),
  // join mirrors posix for test purposes
  join: vi.fn((...parts: string[]) => parts.join('/')),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

import * as pluginFs from '@tauri-apps/plugin-fs'
import { createFileService } from './fs.js'

const readTextFile = pluginFs.readTextFile as Mock
const writeTextFile = pluginFs.writeTextFile as Mock
const remove = pluginFs.remove as Mock
const exists = pluginFs.exists as Mock

// ── Helper to create a fresh FileService for every test ──────────────────────
const getService = () => createFileService()

describe('deleteTabFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls plugin remove with the exact path provided', async () => {
    // Given: a tab file path
    // When: deleteTabFile is called
    // Then: plugin-fs remove is called with that path
    remove.mockResolvedValue(undefined)
    const service = await getService()

    await service.deleteTabFile('/tabs/Artist - Song.tab.txt')

    expect(remove).toHaveBeenCalledWith('/tabs/Artist - Song.tab.txt')
  })

  it('propagates errors thrown by plugin remove', async () => {
    // Given: remove rejects (e.g. permission denied)
    // When: deleteTabFile is called
    // Then: the rejection propagates to the caller
    remove.mockRejectedValue(new Error('Permission denied'))
    const service = await getService()

    await expect(service.deleteTabFile('/tabs/Song.tab.txt')).rejects.toThrow('Permission denied')
  })
})

describe('deleteTabSetting', () => {
  const baseDirectory = '/tabs'
  const settingsPath = '/tabs/.klank-settings.json'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Issue #1: Windows path-key mismatch ─────────────────────────────────────

  it('issue #1: removes the forward-slash-keyed entry when given a backslash Windows absolute path', async () => {
    // Given: .klank-settings.json contains a forward-slash relative key
    //        "Artist - Song.tab.txt" for base dir C:\Users\foo\tabs
    // When: deleteTabSetting is called with a Windows backslash absolute path
    // Then: the entry is removed and writeTextFile is called without that key
    const winBase = 'C:\\Users\\foo\\tabs'
    const winPath = 'C:\\Users\\foo\\tabs\\Artist - Song.tab.txt'
    const existing = {
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      'Other - Keep.tab.txt': { fontSize: 12, transpose: 0, scrollSpeed: 1 },
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.deleteTabSetting(winPath, winBase)

    expect(writeTextFile).toHaveBeenCalledTimes(1)
    const [, writtenContent] = (writeTextFile as Mock).mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written).not.toHaveProperty('Artist - Song.tab.txt')
    // Unrelated entry is preserved
    expect(written).toHaveProperty('Other - Keep.tab.txt')
  })

  it('issue #1: removes an entry whose key requires forward-slash normalisation of a mixed path', async () => {
    // Given: base dir uses forward slashes, tab path uses mixed separators
    // When: deleteTabSetting is called
    // Then: the entry keyed by forward-slash relative path is removed
    const posixBase = '/home/user/tabs'
    const mixedPath = '/home/user/tabs/Sub/Artist - Song.tab.txt'
    const existing = {
      'Sub/Artist - Song.tab.txt': { fontSize: 11, transpose: 0, scrollSpeed: 1 },
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.deleteTabSetting(mixedPath, posixBase)

    const [, writtenContent] = (writeTextFile as Mock).mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written).not.toHaveProperty('Sub/Artist - Song.tab.txt')
  })

  // ── Settings file missing ────────────────────────────────────────────────────

  it('resolves without throwing when .klank-settings.json does not exist', async () => {
    // Given: readTextFile throws (file missing)
    // When: deleteTabSetting is called
    // Then: it resolves silently without calling writeTextFile
    readTextFile.mockRejectedValue(new Error('No such file'))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await expect(service.deleteTabSetting('/tabs/Artist - Song.tab.txt', baseDirectory)).resolves.toBeUndefined()
    expect(writeTextFile).not.toHaveBeenCalled()
  })

  // ── Key not present ──────────────────────────────────────────────────────────

  it('does not call writeTextFile when the key is not present in settings', async () => {
    // Given: .klank-settings.json exists but does not contain the target key
    // When: deleteTabSetting is called
    // Then: no write is performed (early return)
    const existing = {
      'Other - Keep.tab.txt': { fontSize: 12, transpose: 0, scrollSpeed: 1 },
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.deleteTabSetting('/tabs/NonExistent.tab.txt', baseDirectory)

    expect(writeTextFile).not.toHaveBeenCalled()
  })

  // ── Normal forward-slash path ────────────────────────────────────────────────

  it('removes the entry for a standard posix absolute path', async () => {
    // Given: .klank-settings.json has a relative key matching the posix path
    // When: deleteTabSetting is called with the absolute posix path
    // Then: the key is removed and the file is rewritten
    const tabPath = `${baseDirectory}/Artist - Song.tab.txt`
    const existing = {
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.deleteTabSetting(tabPath, baseDirectory)

    expect(writeTextFile).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenContent] = (writeTextFile as Mock).mock.calls[0] as [string, string]
    expect(writtenPath).toBe(settingsPath)
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written).not.toHaveProperty('Artist - Song.tab.txt')
  })

  it('writes the remaining entries sorted by key', async () => {
    // Given: multiple entries in the settings file
    // When: one entry is removed
    // Then: the remaining entries are written in sorted order
    const existing = {
      'Zebra - Song.tab.txt': { fontSize: 12, transpose: 0, scrollSpeed: 1 },
      'Apple - Song.tab.txt': { fontSize: 10, transpose: 1, scrollSpeed: 2 },
      'Mango - Delete.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.deleteTabSetting(`${baseDirectory}/Mango - Delete.tab.txt`, baseDirectory)

    const [, writtenContent] = (writeTextFile as Mock).mock.calls[0] as [string, string]
    const writtenKeys = Object.keys(JSON.parse(writtenContent) as Record<string, unknown>)
    expect(writtenKeys).toEqual([...writtenKeys].sort())
  })
})

// ── Playlists in .klank-settings.json ─────────────────────────────────────────

const makeStoredPlaylist = (overrides: Record<string, unknown> = {}) => ({
  id: 'playlist-1',
  name: 'Practice',
  paths: [] as string[],
  createdAt: 1718000000000,
  ...overrides,
})

describe('readPlaylists', () => {
  const baseDirectory = '/tabs'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array when the settings file does not exist', async () => {
    // Given: .klank-settings.json is missing
    // When: readPlaylists is called
    // Then: an empty array is returned without throwing
    readTextFile.mockRejectedValue(new Error('No such file'))

    const service = await getService()
    await expect(service.readPlaylists(baseDirectory)).resolves.toEqual([])
  })

  it('returns an empty array when the file has no playlists key', async () => {
    // Given: the file only contains per-tab entries
    // When: readPlaylists is called
    // Then: an empty array is returned
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    }))

    const service = await getService()
    await expect(service.readPlaylists(baseDirectory)).resolves.toEqual([])
  })

  it('converts stored relative paths to absolute paths', async () => {
    // Given: a stored playlist with forward-slash relative paths
    // When: readPlaylists is called
    // Then: paths are returned as absolute paths under baseDirectory
    const stored = makeStoredPlaylist({
      paths: ['Artist - Song.tab.txt', 'Sub/Other - Tune.tab.txt'],
    })
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      playlists: [stored],
    }))

    const service = await getService()
    const playlists = await service.readPlaylists(baseDirectory)

    expect(playlists).toHaveLength(1)
    expect(playlists[0]).toEqual({
      ...stored,
      paths: ['/tabs/Artist - Song.tab.txt', '/tabs/Sub/Other - Tune.tab.txt'],
    })
  })

  it('returns Windows-separated absolute paths for a backslash base directory', async () => {
    // Given: a Windows base directory and forward-slash relative keys in the file
    // When: readPlaylists is called
    // Then: paths use the base directory separator
    const winBase = 'C:\\Users\\foo\\tabs'
    readTextFile.mockResolvedValue(JSON.stringify({
      playlists: [makeStoredPlaylist({ paths: ['Sub/Artist - Song.tab.txt'] })],
    }))

    const service = await getService()
    const playlists = await service.readPlaylists(winBase)

    expect(playlists[0].paths).toEqual(['C:\\Users\\foo\\tabs\\Sub\\Artist - Song.tab.txt'])
  })
})

describe('writePlaylists', () => {
  const baseDirectory = '/tabs'
  const settingsPath = '/tabs/.klank-settings.json'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores playlists under the reserved key with relative paths, preserving tab entries', async () => {
    // Given: the file already contains per-tab entries
    // When: writePlaylists is called with absolute playlist paths
    // Then: tab entries survive and playlist paths are stored relative
    const existing = {
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writePlaylists(
      [{ id: 'p1', name: 'Practice', paths: ['/tabs/Artist - Song.tab.txt', '/tabs/Sub/Other - Tune.tab.txt'], createdAt: 1 }],
      baseDirectory
    )

    expect(writeTextFile).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    expect(writtenPath).toBe(settingsPath)
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written['Artist - Song.tab.txt']).toEqual(existing['Artist - Song.tab.txt'])
    expect(written['playlists']).toEqual([
      { id: 'p1', name: 'Practice', paths: ['Artist - Song.tab.txt', 'Sub/Other - Tune.tab.txt'], createdAt: 1 },
    ])
  })

  it('creates the settings file when it does not exist yet', async () => {
    // Given: .klank-settings.json is missing
    // When: writePlaylists is called
    // Then: a new file containing only the playlists key is written
    readTextFile.mockRejectedValue(new Error('No such file'))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writePlaylists([{ id: 'p1', name: 'Practice', paths: [], createdAt: 1 }], baseDirectory)

    const [, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    expect(JSON.parse(writtenContent)).toEqual({
      playlists: [{ id: 'p1', name: 'Practice', paths: [], createdAt: 1 }],
    })
  })

  it('replaces previously stored playlists instead of merging', async () => {
    // Given: the file already contains a different playlist
    // When: writePlaylists is called with a new list
    // Then: only the new list remains under the playlists key
    readTextFile.mockResolvedValue(JSON.stringify({
      playlists: [makeStoredPlaylist({ id: 'old', name: 'Old' })],
    }))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writePlaylists([{ id: 'new', name: 'New', paths: [], createdAt: 2 }], baseDirectory)

    const [, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as { playlists: Array<{ id: string }> }
    expect(written.playlists).toHaveLength(1)
    expect(written.playlists[0].id).toBe('new')
  })

  it('normalises Windows backslash playlist paths to relative forward-slash keys', async () => {
    // Given: a Windows base directory and backslash absolute paths
    // When: writePlaylists is called
    // Then: stored paths are relative and forward-slash separated
    readTextFile.mockRejectedValue(new Error('No such file'))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writePlaylists(
      [{ id: 'p1', name: 'Practice', paths: ['C:\\Users\\foo\\tabs\\Sub\\Artist - Song.tab.txt'], createdAt: 1 }],
      'C:\\Users\\foo\\tabs'
    )

    const [, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as { playlists: Array<{ paths: string[] }> }
    expect(written.playlists[0].paths).toEqual(['Sub/Artist - Song.tab.txt'])
  })
})

describe('readTabSettings with playlists present', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exists.mockResolvedValue(false) // no legacy .klankrc.json
  })

  it('skips the reserved playlists key and returns only tab entries', async () => {
    // Given: the file contains both tab entries and playlists
    // When: readTabSettings is called
    // Then: only tab entries are returned, keyed by absolute path
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      playlists: [makeStoredPlaylist()],
    }))

    const service = await getService()
    const settings = await service.readTabSettings('/tabs')

    expect(settings).toEqual({
      '/tabs/Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    })
  })
})

describe('tab-setting writes preserve playlists', () => {
  const baseDirectory = '/tabs'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writeTabSetting keeps an existing playlists entry intact', async () => {
    // Given: the file contains a playlists entry
    // When: a tab setting is written
    // Then: the playlists entry survives unchanged
    const stored = makeStoredPlaylist({ paths: ['Artist - Song.tab.txt'] })
    readTextFile.mockResolvedValue(JSON.stringify({ playlists: [stored] }))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writeTabSetting('/tabs/Artist - Song.tab.txt', { fontSize: 14, transpose: 2, scrollSpeed: 3 }, baseDirectory)

    const [, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written['playlists']).toEqual([stored])
    expect(written['Artist - Song.tab.txt']).toEqual({ fontSize: 14, transpose: 2, scrollSpeed: 3 })
  })

  it('deleteTabSetting keeps an existing playlists entry intact', async () => {
    // Given: the file contains a playlists entry and a tab entry
    // When: the tab entry is deleted
    // Then: the playlists entry survives unchanged
    const stored = makeStoredPlaylist({ paths: ['Artist - Song.tab.txt'] })
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      playlists: [stored],
    }))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.deleteTabSetting('/tabs/Artist - Song.tab.txt', baseDirectory)

    const [, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written).not.toHaveProperty('Artist - Song.tab.txt')
    expect(written['playlists']).toEqual([stored])
  })
})

// ── Play metrics in .klank-settings.json ──────────────────────────────────────

describe('readPlayMetrics', () => {
  const baseDirectory = '/tabs'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty object when the settings file does not exist', async () => {
    // Given: .klank-settings.json is missing
    // When: readPlayMetrics is called
    // Then: an empty object is returned without throwing
    readTextFile.mockRejectedValue(new Error('No such file'))

    const service = await getService()
    await expect(service.readPlayMetrics(baseDirectory)).resolves.toEqual({})
  })

  it('returns an empty object when the file has no playMetrics key', async () => {
    // Given: the file only contains per-tab entries
    // When: readPlayMetrics is called
    // Then: an empty object is returned
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    }))

    const service = await getService()
    await expect(service.readPlayMetrics(baseDirectory)).resolves.toEqual({})
  })

  it('converts stored relative keys to absolute paths', async () => {
    // Given: stored metrics keyed by forward-slash relative paths
    // When: readPlayMetrics is called
    // Then: keys are returned as absolute paths under baseDirectory
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      playMetrics: {
        'Artist - Song.tab.txt': { playCount: 3, lastPlayedAt: 1718000000000 },
        'Sub/Other - Tune.tab.txt': { playCount: 1, lastPlayedAt: 1718000000001 },
      },
    }))

    const service = await getService()
    const metrics = await service.readPlayMetrics(baseDirectory)

    expect(metrics).toEqual({
      '/tabs/Artist - Song.tab.txt': { playCount: 3, lastPlayedAt: 1718000000000 },
      '/tabs/Sub/Other - Tune.tab.txt': { playCount: 1, lastPlayedAt: 1718000000001 },
    })
  })
})

describe('writePlayMetrics', () => {
  const baseDirectory = '/tabs'
  const settingsPath = '/tabs/.klank-settings.json'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores metrics under the reserved key with relative keys, preserving tab entries and playlists', async () => {
    // Given: the file already contains per-tab entries and playlists
    // When: writePlayMetrics is called with absolute-path keys
    // Then: tab entries and playlists survive and metric keys are stored relative
    const existing = {
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      playlists: [makeStoredPlaylist()],
    }
    readTextFile.mockResolvedValue(JSON.stringify(existing))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writePlayMetrics(
      { '/tabs/Sub/Other - Tune.tab.txt': { playCount: 2, lastPlayedAt: 5 } },
      baseDirectory
    )

    expect(writeTextFile).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    expect(writtenPath).toBe(settingsPath)
    const written = JSON.parse(writtenContent) as Record<string, unknown>
    expect(written['Artist - Song.tab.txt']).toEqual(existing['Artist - Song.tab.txt'])
    expect(written['playlists']).toEqual(existing.playlists)
    expect(written['playMetrics']).toEqual({
      'Sub/Other - Tune.tab.txt': { playCount: 2, lastPlayedAt: 5 },
    })
  })

  it('replaces previously stored metrics instead of merging', async () => {
    // Given: the file already contains a different metric
    // When: writePlayMetrics is called with a new map
    // Then: only the new map remains under the playMetrics key
    readTextFile.mockResolvedValue(JSON.stringify({
      playMetrics: { 'Old - Song.tab.txt': { playCount: 9, lastPlayedAt: 1 } },
    }))
    writeTextFile.mockResolvedValue(undefined)

    const service = await getService()
    await service.writePlayMetrics({ '/tabs/New - Song.tab.txt': { playCount: 1, lastPlayedAt: 2 } }, baseDirectory)

    const [, writtenContent] = writeTextFile.mock.calls[0] as [string, string]
    const written = JSON.parse(writtenContent) as { playMetrics: Record<string, unknown> }
    expect(written.playMetrics).toEqual({ 'New - Song.tab.txt': { playCount: 1, lastPlayedAt: 2 } })
  })
})

describe('readTabSettings skips the reserved playMetrics key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exists.mockResolvedValue(false) // no legacy .klankrc.json
  })

  it('returns only tab entries when playMetrics is present', async () => {
    // Given: the file contains both tab entries and play metrics
    // When: readTabSettings is called
    // Then: only tab entries are returned, keyed by absolute path
    readTextFile.mockResolvedValue(JSON.stringify({
      'Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
      playMetrics: { 'Artist - Song.tab.txt': { playCount: 3, lastPlayedAt: 1 } },
    }))

    const service = await getService()
    const settings = await service.readTabSettings('/tabs')

    expect(settings).toEqual({
      '/tabs/Artist - Song.tab.txt': { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    })
  })
})

describe('readDirectoryRecursively', () => {
  const readDir = pluginFs.readDir as Mock
  const tabFilter = (f: { isDirectory: boolean; name: string }) =>
    f.isDirectory || f.name.endsWith('.tab.txt')
  const file = (name: string) => ({ name, isDirectory: false, isFile: true, isSymlink: false })
  const folder = (name: string) => ({ name, isDirectory: true, isFile: false, isSymlink: false })

  beforeEach(() => vi.clearAllMocks())

  // On mobile the base dir is the app sandbox root, which also holds the WebView
  // profile + caches. Descending into those is what used to throw and empty the
  // tree, so they must be skipped entirely.
  it('skips app-internal directories (app_webview/cache/...) instead of scanning them', async () => {
    readDir.mockImplementation(async (dir: string) => {
      if (dir === '/data/app') return [file('A - Song.tab.txt'), folder('cache'), folder('app_webview'), folder('set')]
      if (dir === '/data/app/set') return [file('B - Song.tab.txt')]
      throw new Error(`unexpected readDir into ${dir}`)
    })
    const service = await getService()

    const tree = JSON.stringify(await service.readDirectoryRecursively('/data/app', tabFilter))

    expect(tree).toContain('A - Song.tab.txt')
    expect(tree).toContain('B - Song.tab.txt')
    expect(readDir).not.toHaveBeenCalledWith('/data/app/cache')
    expect(readDir).not.toHaveBeenCalledWith('/data/app/app_webview')
  })

  // The actual bug: one unreadable subdir rejected the whole scan → empty tree.
  it('skips an unreadable subdirectory instead of failing the whole scan', async () => {
    readDir.mockImplementation(async (dir: string) => {
      if (dir === '/data/app') return [file('A - Song.tab.txt'), folder('broken'), folder('set')]
      if (dir === '/data/app/broken') throw new Error('EACCES')
      if (dir === '/data/app/set') return [file('B - Song.tab.txt')]
      return []
    })
    const service = await getService()

    const tree = JSON.stringify(await service.readDirectoryRecursively('/data/app', tabFilter))

    expect(tree).toContain('A - Song.tab.txt')
    expect(tree).toContain('B - Song.tab.txt')
  })
})
