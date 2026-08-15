import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

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

import type { FileService } from '@klank/platform-api'
import type { PlayMetric } from '@klank/platform-api'
import { useKlankStore } from './store.js'

describe('markPlayed', () => {
  beforeEach(() => {
    useKlankStore.setState({
      tab: { ...useKlankStore.getState().tab, path: '/tabs/Fuel - Shimmer.tab.txt' },
      playMetricByPath: {},
    })
  })

  it('creates a metric with count 1 and a timestamp on first play', () => {
    const before = Date.now()
    useKlankStore.getState().markPlayed()
    const metric = useKlankStore.getState().playMetricByPath['/tabs/Fuel - Shimmer.tab.txt']
    expect(metric.playCount).toBe(1)
    expect(metric.lastPlayedAt).toBeGreaterThanOrEqual(before)
  })

  it('increments the count on repeated plays of the same tab', () => {
    const state = useKlankStore.getState()
    state.markPlayed()
    state.markPlayed()
    state.markPlayed()
    expect(useKlankStore.getState().playMetricByPath['/tabs/Fuel - Shimmer.tab.txt'].playCount).toBe(3)
  })

  it('advances lastPlayedAt on a subsequent play', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1000)
      useKlankStore.getState().markPlayed()
      vi.setSystemTime(5000)
      useKlankStore.getState().markPlayed()
      expect(useKlankStore.getState().playMetricByPath['/tabs/Fuel - Shimmer.tab.txt'].lastPlayedAt).toBe(5000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is a no-op when no tab is open', () => {
    useKlankStore.setState({ tab: { ...useKlankStore.getState().tab, path: '' }, playMetricByPath: {} })
    useKlankStore.getState().markPlayed()
    expect(useKlankStore.getState().playMetricByPath).toEqual({})
  })

  it('tracks metrics independently per tab path', () => {
    const state = useKlankStore.getState()
    state.markPlayed()
    useKlankStore.setState({ tab: { ...useKlankStore.getState().tab, path: '/tabs/Foo - Bar.tab.txt' } })
    useKlankStore.getState().markPlayed()
    const metrics = useKlankStore.getState().playMetricByPath
    expect(metrics['/tabs/Fuel - Shimmer.tab.txt'].playCount).toBe(1)
    expect(metrics['/tabs/Foo - Bar.tab.txt'].playCount).toBe(1)
  })
})

describe('play-metric write-through to the settings file', () => {
  const baseDirectory = '/tabs'
  const path = '/tabs/Fuel - Shimmer.tab.txt'
  let writePlayMetrics: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writePlayMetrics = vi.fn()
    useKlankStore.setState({
      baseDirectory,
      fileService: { writePlayMetrics } as unknown as FileService,
      tab: { ...useKlankStore.getState().tab, path },
      playMetricByPath: {},
    })
  })

  afterEach(() => {
    useKlankStore.setState({ baseDirectory: undefined, fileService: undefined, playMetricByPath: {} })
  })

  it('markPlayed writes the updated metric map and base directory', () => {
    useKlankStore.getState().markPlayed()

    expect(writePlayMetrics).toHaveBeenCalledTimes(1)
    const [metrics, dir] = writePlayMetrics.mock.calls[0] as [Record<string, PlayMetric>, string]
    expect(dir).toBe(baseDirectory)
    expect(metrics).toEqual(useKlankStore.getState().playMetricByPath)
    expect(metrics[path].playCount).toBe(1)
  })

  it('deleteTab writes through only when the path had a metric', () => {
    useKlankStore.setState({ playMetricByPath: { [path]: { playCount: 2, lastPlayedAt: 1 } } })

    useKlankStore.getState().deleteTab('/tabs/Never - Played.tab.txt')
    expect(writePlayMetrics).not.toHaveBeenCalled()

    useKlankStore.getState().deleteTab(path)
    expect(writePlayMetrics).toHaveBeenCalledTimes(1)
    const [metrics] = writePlayMetrics.mock.calls[0] as [Record<string, PlayMetric>]
    expect(metrics).toEqual({})
  })

  it('does not write when no base directory is set', () => {
    useKlankStore.setState({ baseDirectory: undefined })

    useKlankStore.getState().markPlayed()

    expect(writePlayMetrics).not.toHaveBeenCalled()
  })
})

describe('setPlayMetrics', () => {
  it('replaces the play-metric map wholesale', () => {
    useKlankStore.setState({ playMetricByPath: { '/tabs/Old.tab.txt': { playCount: 5, lastPlayedAt: 1 } } })

    const next = { '/tabs/New.tab.txt': { playCount: 1, lastPlayedAt: 2 } }
    useKlankStore.getState().setPlayMetrics(next)

    expect(useKlankStore.getState().playMetricByPath).toEqual(next)
  })
})

describe('toggleSongSort', () => {
  it('flips between artist and recent and back', () => {
    useKlankStore.setState({ songSort: 'artist' })
    useKlankStore.getState().toggleSongSort()
    expect(useKlankStore.getState().songSort).toBe('recent')
    useKlankStore.getState().toggleSongSort()
    expect(useKlankStore.getState().songSort).toBe('artist')
  })
})
