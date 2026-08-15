import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { useKlankStore } from './store.js'
import { playlistNameArb, makePlaylist, resetPlaylists, pathArb, pathsArb } from './store-test-helpers.js'

describe('createPlaylist — property-based', () => {
  beforeEach(() => resetPlaylists())

  it('count always increases by 1', () => {
    fc.assert(fc.property(playlistNameArb, fc.integer({ min: 0, max: 5 }), (name, seed) => {
      const existing = Array.from({ length: seed }, () => makePlaylist())
      resetPlaylists(existing)
      useKlankStore.getState().createPlaylist(name)
      expect(useKlankStore.getState().playlists).toHaveLength(seed + 1)
    }))
  })

  it('new playlist always has the given name', () => {
    fc.assert(fc.property(playlistNameArb, (name) => {
      resetPlaylists()
      useKlankStore.getState().createPlaylist(name)
      const found = useKlankStore.getState().playlists.find((p) => p.name === name)
      expect(found).toBeDefined()
    }))
  })

  it('pre-existing playlists are not mutated', () => {
    fc.assert(fc.property(playlistNameArb, fc.integer({ min: 1, max: 4 }), (name, seed) => {
      const existing = Array.from({ length: seed }, () => makePlaylist())
      resetPlaylists(existing)
      useKlankStore.getState().createPlaylist(name)
      const after = useKlankStore.getState().playlists
      existing.forEach((ep) => {
        expect(after.find((p) => p.id === ep.id)).toEqual(ep)
      })
    }))
  })
})

describe('deletePlaylist — property-based', () => {
  it('count decreases by 1 and target is gone', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 4 }), (count, rawIdx) => {
      const playlists = Array.from({ length: count }, () => makePlaylist())
      resetPlaylists(playlists)
      const idx = rawIdx % count
      const target = playlists[idx]
      useKlankStore.getState().deletePlaylist(target.id)
      const after = useKlankStore.getState().playlists
      expect(after).toHaveLength(count - 1)
      expect(after.find((p) => p.id === target.id)).toBeUndefined()
    }))
  })

  it('non-target playlists are unchanged', () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 5 }), fc.integer({ min: 0, max: 4 }), (count, rawIdx) => {
      const playlists = Array.from({ length: count }, () => makePlaylist())
      resetPlaylists(playlists)
      const idx = rawIdx % count
      const target = playlists[idx]
      useKlankStore.getState().deletePlaylist(target.id)
      const after = useKlankStore.getState().playlists
      playlists.filter((p) => p.id !== target.id).forEach((ep) => {
        expect(after.find((p) => p.id === ep.id)).toEqual(ep)
      })
    }))
  })
})

describe('renamePlaylist — property-based', () => {
  it('only the target playlist name changes', () => {
    fc.assert(fc.property(playlistNameArb, fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 4 }), (newName, count, rawIdx) => {
      const playlists = Array.from({ length: count }, () => makePlaylist())
      resetPlaylists(playlists)
      const idx = rawIdx % count
      const target = playlists[idx]
      useKlankStore.getState().renamePlaylist(target.id, newName)
      const after = useKlankStore.getState().playlists
      const renamed = after.find((p) => p.id === target.id)
      expect(renamed?.name).toBe(newName)
      playlists.filter((p) => p.id !== target.id).forEach((ep) => {
        expect(after.find((p) => p.id === ep.id)).toEqual(ep)
      })
    }))
  })
})

describe('reorderPlaylist — property-based', () => {
  it('stores exactly the provided paths for the target playlist', () => {
    fc.assert(fc.property(pathsArb, (paths) => {
      const playlist = makePlaylist()
      resetPlaylists([playlist])
      useKlankStore.getState().reorderPlaylist(playlist.id, paths)
      const after = useKlankStore.getState().playlists.find((p) => p.id === playlist.id)
      expect(after?.paths).toEqual(paths)
    }))
  })

  it('only the target playlist is affected', () => {
    fc.assert(fc.property(pathsArb, (paths) => {
      const target = makePlaylist()
      const other = makePlaylist({ name: 'Other' })
      resetPlaylists([target, other])
      useKlankStore.getState().reorderPlaylist(target.id, paths)
      const afterOther = useKlankStore.getState().playlists.find((p) => p.id === other.id)
      expect(afterOther).toEqual(other)
    }))
  })
})
