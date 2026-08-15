import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'

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

import type { PlayMetric } from '@klank/platform-api'
import { useKlankStore } from './store.js'

const makePlaylist = (overrides: Partial<import('./store.js').Playlist> = {}): import('./store.js').Playlist => ({
  id: crypto.randomUUID(),
  name: 'Test',
  paths: [],
  createdAt: Date.now(),
  ...overrides,
})

const resetPlaylists = (playlists: import('./store.js').Playlist[] = []) => {
  useKlankStore.setState({ playlists, activePlaylistId: null, activePlaylistIndex: null })
}

// ── Helper: fully reset relevant store slices before each deleteTab test ───────
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

describe('deleteTab', () => {
  beforeEach(() => resetForDelete())

  // ── Issue #4: stale open tab ───────────────────────────────────────────────

  it('issue #4: clears tab.path to "" when the deleted path is currently open', () => {
    // Given: the deleted tab is the open tab
    // When: deleteTab is called with that path
    // Then: tab.path becomes ""
    const path = '/tabs/Artist - Song.tab.txt'
    resetForDelete({ tab: { path, fontSize: 12, transpose: 0, scrollSpeed: 1, isScrolling: false, details: '', link: '' } })

    useKlankStore.getState().deleteTab(path)

    expect(useKlankStore.getState().tab.path).toBe('')
  })

  it('issue #4: leaves tab.path unchanged when a different (non-open) tab is deleted', () => {
    // Given: a different tab is open
    // When: deleteTab is called for some other path
    // Then: the open tab.path is untouched
    const openPath = '/tabs/Artist - Open.tab.txt'
    const otherPath = '/tabs/Artist - Other.tab.txt'
    resetForDelete({ tab: { path: openPath, fontSize: 12, transpose: 0, scrollSpeed: 1, isScrolling: false, details: '', link: '' } })

    useKlankStore.getState().deleteTab(otherPath)

    expect(useKlankStore.getState().tab.path).toBe(openPath)
  })

  // ── tabSettingByPath cleanup ──────────────────────────────────────────────

  it('removes the deleted path from tabSettingByPath', () => {
    // Given: a settings entry exists for the path
    // When: deleteTab is called
    // Then: tabSettingByPath no longer contains that path
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
    // Given: settings exist for both a deleted and an unrelated path
    // When: deleteTab is called for one path
    // Then: the other entry survives unchanged
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

  // ── Path removed from ALL playlists ──────────────────────────────────────

  it('removes the path from all playlists, not just the active one', () => {
    // Given: the path appears in two different playlists (active and inactive)
    // When: deleteTab is called
    // Then: the path is absent from both playlists' paths arrays
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

  // ── Issue #3: activePlaylistIndex drift — property tests ──────────────────

  it('issue #3: decrements activePlaylistIndex when removed path is before current index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),   // playlist length
        fc.integer({ min: 1, max: 7 }),   // removedPos (< currentIndex)
        fc.integer({ min: 0, max: 7 }),   // offset so currentIndex > removedPos
        (length, removedPos, offset) => {
          const adjustedLength = Math.min(length, 8)
          const adjustedRemoved = removedPos % adjustedLength
          const currentIndex = Math.min(adjustedRemoved + 1 + (offset % (adjustedLength - adjustedRemoved - 1 || 1)), adjustedLength - 1)

          // Guard: removedPos strictly before currentIndex
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
        fc.integer({ min: 2, max: 8 }),   // playlist length
        fc.integer({ min: 0, max: 7 }),   // currentIndex
        (length, rawIndex) => {
          const adjustedLength = Math.min(length, 8)
          const currentIndex = rawIndex % adjustedLength
          // Remove the path AT currentIndex (worst-case: at-index removal)
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
    // Given: active playlist with exactly one path, index 0
    // When: that path is deleted
    // Then: activePlaylistIndex is null
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
    // Given: path exists only in a non-active playlist; active index is 1
    // When: deleteTab is called
    // Then: activePlaylistIndex remains 1
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

  // ── Issue #2: setTabPath resurrects deleted settings ──────────────────────

  it('issue #2: setTabPath(neighbor) then deleteTab(oldPath) leaves no tabSettingByPath[oldPath]', () => {
    // Given: the "to-be-deleted" tab is open with custom settings;
    //        a neighbor tab has its own settings
    // When: setTabPath(neighbor) is called first (snapshots old tab into tabSettingByPath),
    //       then deleteTab(oldPath) is called
    // Then: tabSettingByPath must NOT contain the old (deleted) path
    const oldPath = '/tabs/Artist - DeleteMe.tab.txt'
    const neighborPath = '/tabs/Artist - Neighbor.tab.txt'

    resetForDelete({
      tab: { path: oldPath, fontSize: 16, transpose: 3, scrollSpeed: 2, isScrolling: false, details: '', link: '' },
      tabSettingByPath: {
        [neighborPath]: { fontSize: 10, transpose: 0, scrollSpeed: 1 },
      },
      // No baseDirectory / fileService so the write side-effect is a no-op
    })

    // This is the handler order the UI uses: navigate away first, then clean up
    useKlankStore.getState().setTabPath(neighborPath)
    useKlankStore.getState().deleteTab(oldPath)

    expect(useKlankStore.getState().tabSettingByPath).not.toHaveProperty(oldPath)
  })
})
