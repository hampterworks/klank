import { beforeEach, describe, expect, it } from 'vitest'
import type { FileService, PlayMetric, Playlist } from '@klank/platform-api'
import { useKlankStore } from './store.js'

const makePlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  id: crypto.randomUUID(),
  name: 'Test',
  paths: [],
  createdAt: Date.now(),
  ...overrides,
})

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

describe('renameTab', () => {
  const oldPath = '/tabs/Old Artist - Old Song.tab.txt'
  const newPath = '/tabs/New Artist - New Song.tab.txt'

  beforeEach(() => resetForDelete({ playMetricByPath: {} }))

  it('updates tab.path when the renamed tab is open, keeping its settings', () => {
    resetForDelete({
      playMetricByPath: {},
      tab: { path: oldPath, fontSize: 16, transpose: 3, scrollSpeed: 2, isScrolling: false, details: '', link: '' },
    })

    useKlankStore.getState().renameTab(oldPath, newPath)

    const tab = useKlankStore.getState().tab
    expect(tab.path).toBe(newPath)
    expect(tab.fontSize).toBe(16)
    expect(tab.transpose).toBe(3)
    expect(tab.scrollSpeed).toBe(2)
  })

  it('leaves tab.path unchanged when a different tab is renamed', () => {
    const openPath = '/tabs/Artist - Open.tab.txt'
    resetForDelete({
      playMetricByPath: {},
      tab: { path: openPath, fontSize: 12, transpose: 0, scrollSpeed: 1, isScrolling: false, details: '', link: '' },
    })

    useKlankStore.getState().renameTab(oldPath, newPath)

    expect(useKlankStore.getState().tab.path).toBe(openPath)
  })

  it('moves the tabSettingByPath entry to the new path, preserving others', () => {
    const otherPath = '/tabs/Artist - Keep.tab.txt'
    const setting = { fontSize: 14, transpose: 2, scrollSpeed: 3 }
    const otherSetting = { fontSize: 10, transpose: -2, scrollSpeed: 5 }
    resetForDelete({
      playMetricByPath: {},
      tabSettingByPath: { [oldPath]: setting, [otherPath]: otherSetting },
    })

    useKlankStore.getState().renameTab(oldPath, newPath)

    const after = useKlankStore.getState().tabSettingByPath
    expect(after).not.toHaveProperty(oldPath)
    expect(after[newPath]).toEqual(setting)
    expect(after[otherPath]).toEqual(otherSetting)
  })

  it('moves the playMetricByPath entry to the new path', () => {
    const metric: PlayMetric = { playCount: 4, lastPlayedAt: 1000 }
    resetForDelete({ playMetricByPath: { [oldPath]: metric } })

    useKlankStore.getState().renameTab(oldPath, newPath)

    const after = useKlankStore.getState().playMetricByPath
    expect(after).not.toHaveProperty(oldPath)
    expect(after[newPath]).toEqual(metric)
  })

  it('replaces the path in all playlists without shifting activePlaylistIndex', () => {
    const playlistA = makePlaylist({ paths: [oldPath, '/tabs/Artist - B.tab.txt'] })
    const playlistB = makePlaylist({ paths: ['/tabs/Artist - C.tab.txt', oldPath] })
    resetForDelete({
      playMetricByPath: {},
      playlists: [playlistA, playlistB],
      activePlaylistId: playlistA.id,
      activePlaylistIndex: 1,
    })

    useKlankStore.getState().renameTab(oldPath, newPath)

    const state = useKlankStore.getState()
    expect(state.playlists[0].paths).toEqual([newPath, '/tabs/Artist - B.tab.txt'])
    expect(state.playlists[1].paths).toEqual(['/tabs/Artist - C.tab.txt', newPath])
    expect(state.activePlaylistIndex).toBe(1)
  })

  describe('write-through to the settings file', () => {
    const baseDirectory = '/tabs'
    let writeTabSetting: ReturnType<typeof vi.fn>
    let deleteTabSetting: ReturnType<typeof vi.fn>
    let writePlaylists: ReturnType<typeof vi.fn>
    let writePlayMetrics: ReturnType<typeof vi.fn>

    beforeEach(() => {
      writeTabSetting = vi.fn()
      deleteTabSetting = vi.fn()
      writePlaylists = vi.fn()
      writePlayMetrics = vi.fn()
      resetForDelete({ playMetricByPath: {} })
      useKlankStore.setState({
        baseDirectory,
        fileService: { writeTabSetting, deleteTabSetting, writePlaylists, writePlayMetrics } as unknown as FileService,
      })
    })

    afterEach(() => {
      useKlankStore.setState({ baseDirectory: undefined, fileService: undefined })
    })

    it('migrates the persisted tab setting only when one existed', () => {
      useKlankStore.getState().renameTab(oldPath, newPath)
      expect(writeTabSetting).not.toHaveBeenCalled()
      expect(deleteTabSetting).not.toHaveBeenCalled()

      const setting = { fontSize: 14, transpose: 2, scrollSpeed: 3 }
      useKlankStore.setState({ tabSettingByPath: { [oldPath]: setting } })
      useKlankStore.getState().renameTab(oldPath, newPath)

      expect(writeTabSetting).toHaveBeenCalledWith(newPath, setting, baseDirectory)
      expect(deleteTabSetting).toHaveBeenCalledWith(oldPath, baseDirectory)
    })

    it('writes playlists and play metrics only when the path was referenced', () => {
      useKlankStore.getState().renameTab(oldPath, newPath)
      expect(writePlaylists).not.toHaveBeenCalled()
      expect(writePlayMetrics).not.toHaveBeenCalled()

      useKlankStore.setState({
        playlists: [makePlaylist({ paths: [oldPath] })],
        playMetricByPath: { [oldPath]: { playCount: 1, lastPlayedAt: 1 } },
      })
      useKlankStore.getState().renameTab(oldPath, newPath)

      expect(writePlaylists).toHaveBeenCalledTimes(1)
      const [playlists] = writePlaylists.mock.calls[0] as [Playlist[]]
      expect(playlists[0].paths).toEqual([newPath])
      expect(writePlayMetrics).toHaveBeenCalledTimes(1)
      const [metrics] = writePlayMetrics.mock.calls[0] as [Record<string, PlayMetric>]
      expect(Object.keys(metrics)).toEqual([newPath])
    })

    it('does not write when no base directory is set', () => {
      useKlankStore.setState({
        baseDirectory: undefined,
        tabSettingByPath: { [oldPath]: { fontSize: 14, transpose: 2, scrollSpeed: 3 } },
      })

      useKlankStore.getState().renameTab(oldPath, newPath)

      expect(writeTabSetting).not.toHaveBeenCalled()
      expect(deleteTabSetting).not.toHaveBeenCalled()
    })
  })
})
