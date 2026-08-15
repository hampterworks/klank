import { beforeEach, describe, expect, it } from 'vitest'
import { useKlankStore } from './store.js'
import { makePlaylist, resetPlaylists } from './store-test-helpers.js'

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
