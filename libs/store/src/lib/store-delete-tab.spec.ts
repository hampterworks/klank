import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { Playlist } from './store.js'
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

describe('deleteTab', () => {
  const resetForDelete = (overrides: Partial<Parameters<typeof useKlankStore.setState>[0]> = {}) => {
    useKlankStore.setState({
      playlists: [],
      activePlaylistId: null,
      activePlaylistIndex: null,
      tabSettingByPath: {},
      tab: {
        path: '',
        fontSize: 12,
        transpose: 0,
        scrollSpeed: 1,
        isScrolling: false,
        details: '',
        link: '',
      },
      ...overrides,
    })
  }

  beforeEach(() => resetForDelete())

  it('issue #4: clears tab.path to "" when the deleted path is currently open', () => {
    const path = '/tabs/Artist - Song.tab.txt'
    resetForDelete({ tab: { path, fontSize: 12, transpose: 0, scrollSpeed: 1, isScrolling: false, details: '', link: '' } })

    useKlankStore.getState().deleteTab(path)

    expect(useKlankStore.getState().tab.path).toBe('')
  })

  it('issue #4: leaves tab.path unchanged when a different (non-open) tab is deleted', () => {
    const openPath = '/tabs/Artist - Open.tab.txt'
    const otherPath = '/tabs/Artist - Other.tab.txt'
    resetForDelete({ tab: { path: openPath, fontSize: 12, transpose: 0, scrollSpeed: 1, isScrolling: false, details: '', link: '' } })

    useKlankStore.getState().deleteTab(otherPath)

    expect(useKlankStore.getState().tab.path).toBe(openPath)
  })

  it('removes the deleted path from tabSettingByPath', () => {
    const path = '/tabs/Artist - Song.tab.txt'
    resetForDelete({
      tabSettingByPath: {
        [path]: { fontSize: 14, transpose: 2, scrollSpeed: 3 },
        '/tabs/Artist - Other.tab.txt': { fontSize: 12, transpose: 0, scrollSpeed: 1 },
      },
    })

    useKlankStore.getState().deleteTab(path)

    expect(useKlankStore.getState().tabSettingByPath).not.toHaveProperty(path)
  })

  it('preserves unrelated tabSettingByPath entries when a path is deleted', () => {
    const deletedPath = '/tabs/Artist - Deleted.tab.txt'
    const otherPath = '/tabs/Artist - Keep.tab.txt'
    const otherSettings = { fontSize: 10, transpose: -2, scrollSpeed: 5 }
    resetForDelete({
      tabSettingByPath: {
        [deletedPath]: { fontSize: 14, transpose: 2, scrollSpeed: 3 },
        [otherPath]: otherSettings,
      },
    })

    useKlankStore.getState().deleteTab(deletedPath)

    expect(useKlankStore.getState().tabSettingByPath[otherPath]).toEqual(otherSettings)
  })

  it('removes the path from all playlists, not just the active one', () => {
    const path = '/tabs/Artist - Shared.tab.txt'
    const playlistA = makePlaylist({ paths: [path, '/tabs/Artist - B.tab.txt'] })
    const playlistB = makePlaylist({ paths: ['/tabs/Artist - C.tab.txt', path] })
    resetForDelete({ playlists: [playlistA, playlistB], activePlaylistId: playlistA.id })

    useKlankStore.getState().deleteTab(path)

    const state = useKlankStore.getState()
    state.playlists.forEach((p) => {
      expect(p.paths).not.toContain(path)
    })
  })

  it('issue #3: decrements activePlaylistIndex when removed path is before current index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 1, max: 7 }),
        fc.integer({ min: 0, max: 7 }),
        (length, removedPos, offset) => {
          const adjustedLength = Math.min(length, 8)
          const adjustedRemoved = removedPos % adjustedLength
          const currentIndex = Math.min(adjustedRemoved + 1 + (offset % (adjustedLength - adjustedRemoved - 1 || 1)), adjustedLength - 1)

          if (adjustedRemoved >= currentIndex) return

          const paths = Array.from({ length: adjustedLength }, (_, i) => `/tabs/Song${i}.tab.txt`)
          const playlist = makePlaylist({ paths })
          resetForDelete({
            playlists: [playlist],
            activePlaylistId: playlist.id,
            activePlaylistIndex: currentIndex,
          })

          useKlankStore.getState().deleteTab(paths[adjustedRemoved])

          const newIndex = useKlankStore.getState().activePlaylistIndex
          expect(newIndex).toBe(currentIndex - 1)
        }
      )
    )
  })

  it('issue #3: clamps activePlaylistIndex to newLength-1 when removed path is at/after current index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.integer({ min: 0, max: 7 }),
        (length, rawIndex) => {
          const adjustedLength = Math.min(length, 8)
          const currentIndex = rawIndex % adjustedLength
          const removedPos = currentIndex

          const paths = Array.from({ length: adjustedLength }, (_, i) => `/tabs/Song${i}.tab.txt`)
          const playlist = makePlaylist({ paths })
          resetForDelete({
            playlists: [playlist],
            activePlaylistId: playlist.id,
            activePlaylistIndex: currentIndex,
          })

          useKlankStore.getState().deleteTab(paths[removedPos])

          const newIndex = useKlankStore.getState().activePlaylistIndex
          const newLength = adjustedLength - 1
          if (newLength === 0) {
            expect(newIndex).toBeNull()
          } else {
            expect(newIndex).toBeLessThanOrEqual(newLength - 1)
            expect(newIndex).toBeGreaterThanOrEqual(0)
          }
        }
      )
    )
  })

  it('issue #3: sets activePlaylistIndex to null when the playlist becomes empty', () => {
    const path = '/tabs/Artist - Only.tab.txt'
    const playlist = makePlaylist({ paths: [path] })
    resetForDelete({
      playlists: [playlist],
      activePlaylistId: playlist.id,
      activePlaylistIndex: 0,
    })

    useKlankStore.getState().deleteTab(path)

    expect(useKlankStore.getState().activePlaylistIndex).toBeNull()
  })

  it('issue #3: does not change activePlaylistIndex when the path is not in the active playlist', () => {
    const pathInOther = '/tabs/Artist - Other.tab.txt'
    const activePaths = ['/tabs/Artist - A.tab.txt', '/tabs/Artist - B.tab.txt']
    const activePl = makePlaylist({ paths: activePaths })
    const otherPl = makePlaylist({ paths: [pathInOther] })
    resetForDelete({
      playlists: [activePl, otherPl],
      activePlaylistId: activePl.id,
      activePlaylistIndex: 1,
    })

    useKlankStore.getState().deleteTab(pathInOther)

    expect(useKlankStore.getState().activePlaylistIndex).toBe(1)
  })

  it('issue #2: setTabPath(neighbor) then deleteTab(oldPath) leaves no tabSettingByPath[oldPath]', () => {
    const oldPath = '/tabs/Artist - DeleteMe.tab.txt'
    const neighborPath = '/tabs/Artist - Neighbor.tab.txt'

    resetForDelete({
      tab: { path: oldPath, fontSize: 16, transpose: 3, scrollSpeed: 2, isScrolling: false, details: '', link: '' },
      tabSettingByPath: {
        [neighborPath]: { fontSize: 10, transpose: 0, scrollSpeed: 1 },
      },
    })

    useKlankStore.getState().setTabPath(neighborPath)
    useKlankStore.getState().deleteTab(oldPath)

    expect(useKlankStore.getState().tabSettingByPath).not.toHaveProperty(oldPath)
  })
})
