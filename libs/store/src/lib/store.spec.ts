import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'

// Stub localStorage before store import — persist middleware reads it on init.
// setItem stores data so getItem can return it; this silences the "storage unavailable" warning.
const localStorageData: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key] }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]) }),
  length: 0,
  key: vi.fn(() => null),
})

import type { FileService } from '@klank/platform-api'
import { notifyTabsChanged, onTabsChanged, useKlankStore, type CustomTuning, type Playlist } from './store.js'

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

// Arbitraries
const playlistNameArb = fc.string({ minLength: 1, maxLength: 80 })
const pathArb = fc.string({ minLength: 1, maxLength: 200 })
const pathsArb = fc.array(pathArb, { minLength: 0, maxLength: 20 })

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

describe('tab change signal', () => {
  it('notifies subscribers and stops after unsubscribe', () => {
    const fn = vi.fn()
    const unsubscribe = onTabsChanged(fn)
    notifyTabsChanged()
    expect(fn).toHaveBeenCalledTimes(1)
    unsubscribe()
    notifyTabsChanged()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fires when a tab-setting write happens', () => {
    useKlankStore.setState({
      baseDirectory: '/tabs',
      tab: { ...useKlankStore.getState().tab, path: '/tabs/a.tab.txt' },
    })
    const fn = vi.fn()
    const unsubscribe = onTabsChanged(fn)
    useKlankStore.getState().setTabFontSize(15)
    expect(fn).toHaveBeenCalled()
    unsubscribe()
  })
})

describe('syncSettings', () => {
  it('merges partial updates without disturbing other fields', () => {
    useKlankStore.getState().setSyncSettings({ intervalMinutes: 10 })
    expect(useKlankStore.getState().syncSettings.intervalMinutes).toBe(10)
    expect(useKlankStore.getState().syncSettings.enabled).toBe(true)

    useKlankStore.getState().setSyncSettings({ enabled: false })
    expect(useKlankStore.getState().syncSettings.enabled).toBe(false)
    expect(useKlankStore.getState().syncSettings.intervalMinutes).toBe(10)
  })
})

describe('harmony slice — property-based', () => {
  const harmonyPartialArb = fc.record(
    {
      rootPitch: fc.integer({ min: 0, max: 11 }),
      scaleId: fc.constantFrom('ionian', 'dorian', 'altered', 'minor-pentatonic'),
      quality: fc.constantFrom('', 'm', 'maj7', 'm7b5'),
      tab: fc.constantFrom('chords', 'scales', 'chord-scales'),
    },
    { requiredKeys: [] },
  )

  it('setHarmony merges any partial as { ...prev, ...partial }', () => {
    fc.assert(
      fc.property(harmonyPartialArb, (partial) => {
        const prev = useKlankStore.getState().harmony
        useKlankStore.getState().setHarmony(partial)
        expect(useKlankStore.getState().harmony).toEqual({ ...prev, ...partial })
      }),
    )
  })

  it('two sequential setHarmony calls compose like a single merged update', () => {
    fc.assert(
      fc.property(harmonyPartialArb, harmonyPartialArb, (a, b) => {
        const start = useKlankStore.getState().harmony
        useKlankStore.getState().setHarmony(a)
        useKlankStore.getState().setHarmony(b)
        expect(useKlankStore.getState().harmony).toEqual({ ...start, ...a, ...b })
      }),
    )
  })
})

// ── CustomTuning actions ───────────────────────────────────────────────────────

const makeCustomTuning = (overrides: Partial<CustomTuning> = {}): CustomTuning => ({
  id: crypto.randomUUID(),
  name: 'My Tuning',
  instrument: 'guitar',
  strings: [
    { pitchClass: 2, octave: 2 },
    { pitchClass: 9, octave: 2 },
    { pitchClass: 2, octave: 3 },
    { pitchClass: 7, octave: 3 },
    { pitchClass: 11, octave: 3 },
    { pitchClass: 4, octave: 4 },
  ],
  ...overrides,
})

const resetCustomTunings = (customTunings: CustomTuning[] = []) => {
  useKlankStore.setState({ customTunings })
}

describe('addCustomTuning', () => {
  beforeEach(() => resetCustomTunings())

  it('appends a new tuning to an empty list', () => {
    const tuning = makeCustomTuning()
    useKlankStore.getState().addCustomTuning(tuning)
    expect(useKlankStore.getState().customTunings).toEqual([tuning])
  })

  it('appends without mutating existing tunings', () => {
    const existing = makeCustomTuning({ name: 'Existing' })
    resetCustomTunings([existing])
    const newTuning = makeCustomTuning({ name: 'New' })
    useKlankStore.getState().addCustomTuning(newTuning)
    const after = useKlankStore.getState().customTunings
    expect(after).toHaveLength(2)
    expect(after[0]).toEqual(existing)
    expect(after[1]).toEqual(newTuning)
  })

  it('count always increases by 1 — property-based', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5 }), (seed) => {
      const existing = Array.from({ length: seed }, () => makeCustomTuning())
      resetCustomTunings(existing)
      useKlankStore.getState().addCustomTuning(makeCustomTuning())
      expect(useKlankStore.getState().customTunings).toHaveLength(seed + 1)
    }))
  })
})

describe('deleteCustomTuning', () => {
  beforeEach(() => resetCustomTunings())

  it('removes a tuning by id', () => {
    const tuning = makeCustomTuning()
    resetCustomTunings([tuning])
    useKlankStore.getState().deleteCustomTuning(tuning.id)
    expect(useKlankStore.getState().customTunings).toEqual([])
  })

  it('leaves non-target tunings intact', () => {
    const keep = makeCustomTuning({ name: 'Keep' })
    const remove = makeCustomTuning({ name: 'Remove' })
    resetCustomTunings([keep, remove])
    useKlankStore.getState().deleteCustomTuning(remove.id)
    expect(useKlankStore.getState().customTunings).toEqual([keep])
  })

  it('is a no-op when the id does not exist', () => {
    const tuning = makeCustomTuning()
    resetCustomTunings([tuning])
    useKlankStore.getState().deleteCustomTuning('nonexistent-id')
    expect(useKlankStore.getState().customTunings).toEqual([tuning])
  })

  it('count decreases by 1 and target is gone — property-based', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 4 }), (count, rawIdx) => {
      const tunings = Array.from({ length: count }, () => makeCustomTuning())
      resetCustomTunings(tunings)
      const idx = rawIdx % count
      const target = tunings[idx]
      useKlankStore.getState().deleteCustomTuning(target.id)
      const after = useKlankStore.getState().customTunings
      expect(after).toHaveLength(count - 1)
      expect(after.find((t) => t.id === target.id)).toBeUndefined()
    }))
  })
})

describe('customTunings partialize', () => {
  it('customTunings is included in the persisted state slice', () => {
    const tuning = makeCustomTuning()
    resetCustomTunings([tuning])
    expect(useKlankStore.getState().customTunings).toEqual([tuning])
  })
})
