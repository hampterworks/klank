import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Stub localStorage before store import — persist middleware reads it on init.
const localStorageData: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key] }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]) }),
  length: 0,
  key: vi.fn(() => null),
})

import type { FileService, Playlist } from '@klank/platform-api'
import { useKlankStore } from './store.js'

const makePlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  id: crypto.randomUUID(),
  name: 'Test',
  paths: [],
  createdAt: Date.now(),
  ...overrides,
})

const resetPlaylists = (playlists: Playlist[] = []) => {
  useKlankStore.setState({ playlists, activePlaylistId: null, activePlaylistIndex: null })
}

// ── Playlists persisted to .klank-settings.json ────────────────────────────────

describe('playlist write-through to the settings file', () => {
  const baseDirectory = '/tabs'
  let writePlaylists: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writePlaylists = vi.fn()
    resetPlaylists()
    useKlankStore.setState({
      baseDirectory,
      fileService: { writePlaylists } as unknown as FileService,
    })
  })

  afterEach(() => {
    useKlankStore.setState({ baseDirectory: undefined, fileService: undefined })
  })

  it('createPlaylist writes the updated playlist list and base directory', () => {
    useKlankStore.getState().createPlaylist('Practice')

    expect(writePlaylists).toHaveBeenCalledTimes(1)
    const [playlists, dir] = writePlaylists.mock.calls[0] as [Playlist[], string]
    expect(dir).toBe(baseDirectory)
    expect(playlists).toEqual(useKlankStore.getState().playlists)
  })

  it('deletePlaylist, renamePlaylist and reorderPlaylist write through', () => {
    const playlist = makePlaylist({ paths: ['/tabs/A.tab.txt', '/tabs/B.tab.txt'] })
    resetPlaylists([playlist])

    useKlankStore.getState().renamePlaylist(playlist.id, 'Renamed')
    useKlankStore.getState().reorderPlaylist(playlist.id, ['/tabs/B.tab.txt', '/tabs/A.tab.txt'])
    useKlankStore.getState().deletePlaylist(playlist.id)

    expect(writePlaylists).toHaveBeenCalledTimes(3)
    const [finalPlaylists] = writePlaylists.mock.calls[2] as [Playlist[]]
    expect(finalPlaylists).toEqual([])
  })

  it('addTabToPlaylist and removeTabFromPlaylist write through', () => {
    const playlist = makePlaylist()
    resetPlaylists([playlist])

    useKlankStore.getState().addTabToPlaylist(playlist.id, '/tabs/A.tab.txt')
    useKlankStore.getState().removeTabFromPlaylist(playlist.id, '/tabs/A.tab.txt')

    expect(writePlaylists).toHaveBeenCalledTimes(2)
    const [afterAdd] = writePlaylists.mock.calls[0] as [Playlist[]]
    expect(afterAdd[0].paths).toEqual(['/tabs/A.tab.txt'])
    const [afterRemove] = writePlaylists.mock.calls[1] as [Playlist[]]
    expect(afterRemove[0].paths).toEqual([])
  })

  it('deleteTab writes through only when a playlist contained the path', () => {
    const inPlaylist = '/tabs/Artist - In.tab.txt'
    const notInPlaylist = '/tabs/Artist - Out.tab.txt'
    resetPlaylists([makePlaylist({ paths: [inPlaylist] })])

    useKlankStore.getState().deleteTab(notInPlaylist)
    expect(writePlaylists).not.toHaveBeenCalled()

    useKlankStore.getState().deleteTab(inPlaylist)
    expect(writePlaylists).toHaveBeenCalledTimes(1)
    const [playlists] = writePlaylists.mock.calls[0] as [Playlist[]]
    expect(playlists[0].paths).toEqual([])
  })

  it('does not write when no base directory is set', () => {
    useKlankStore.setState({ baseDirectory: undefined })

    useKlankStore.getState().createPlaylist('Practice')

    expect(writePlaylists).not.toHaveBeenCalled()
  })

  it('setPlaylists hydration does not write back to the settings file', () => {
    useKlankStore.getState().setPlaylists([makePlaylist()])

    expect(writePlaylists).not.toHaveBeenCalled()
  })
})
