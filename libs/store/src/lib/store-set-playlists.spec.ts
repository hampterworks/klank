import { beforeEach, describe, expect, it } from 'vitest'

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

import type { Playlist } from '@klank/platform-api'
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

describe('setPlaylists hydration', () => {
  beforeEach(() => resetPlaylists())

  it('replaces all playlists', () => {
    resetPlaylists([makePlaylist({ name: 'Stale' })])
    const fromFile = [makePlaylist({ name: 'FromFile' })]

    useKlankStore.getState().setPlaylists(fromFile)

    expect(useKlankStore.getState().playlists).toEqual(fromFile)
  })

  it('keeps the active selection when the active playlist still exists', () => {
    const playlist = makePlaylist({ paths: ['/tabs/A.tab.txt', '/tabs/B.tab.txt'] })
    useKlankStore.setState({ playlists: [], activePlaylistId: playlist.id, activePlaylistIndex: 1 })

    useKlankStore.getState().setPlaylists([playlist])

    expect(useKlankStore.getState().activePlaylistId).toBe(playlist.id)
    expect(useKlankStore.getState().activePlaylistIndex).toBe(1)
  })

  it('clears the active selection when the active playlist is not in the loaded data', () => {
    useKlankStore.setState({ playlists: [], activePlaylistId: 'gone', activePlaylistIndex: 0 })

    useKlankStore.getState().setPlaylists([makePlaylist()])

    expect(useKlankStore.getState().activePlaylistId).toBeNull()
    expect(useKlankStore.getState().activePlaylistIndex).toBeNull()
  })

  it('clamps activePlaylistIndex when the loaded playlist is shorter', () => {
    const playlist = makePlaylist({ paths: ['/tabs/A.tab.txt'] })
    useKlankStore.setState({ playlists: [], activePlaylistId: playlist.id, activePlaylistIndex: 5 })

    useKlankStore.getState().setPlaylists([playlist])

    expect(useKlankStore.getState().activePlaylistIndex).toBe(0)
  })

  it('nulls activePlaylistIndex when the loaded active playlist is empty', () => {
    const playlist = makePlaylist({ paths: [] })
    useKlankStore.setState({ playlists: [], activePlaylistId: playlist.id, activePlaylistIndex: 2 })

    useKlankStore.getState().setPlaylists([playlist])

    expect(useKlankStore.getState().activePlaylistId).toBe(playlist.id)
    expect(useKlankStore.getState().activePlaylistIndex).toBeNull()
  })
})
