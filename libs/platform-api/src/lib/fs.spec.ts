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
