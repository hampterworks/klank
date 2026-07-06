import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKlankStore, type SyncStatus } from '@klank/store'
import { createGitService, type FileService, type GitService, type SyncResult } from '@klank/platform-api'
import { clampMinutes, runGitSync, useGitSync } from '../app/useGitSync'
import { describeSyncStatus } from '../app/routes/settings'

// `createGitService` reaches into Tauri IPC, which jsdom can't provide. Default
// to "not in Tauri" (rejects, leaving gitRef null) so the scheduling-guard tests
// match production browser behaviour; individual tests override it.
vi.mock('@klank/platform-api', async (importActual) => {
  const actual = await importActual<typeof import('@klank/platform-api')>()
  return { ...actual, createGitService: vi.fn(async () => { throw new Error('no tauri') }) }
})

const baseDir = '/tabs'

const okResult = (over: Partial<SyncResult> = {}): SyncResult => ({
  success: true,
  committed: false,
  pulled: 0,
  pushed: 0,
  conflictsResolved: 0,
  upToDate: true,
  changed: false,
  message: 'ok',
  ...over,
})

const makeGit = (over: Partial<GitService>): GitService =>
  ({
    isGitRepo: async () => true,
    isAuthenticated: async () => true,
    sync: async () => okResult(),
    ...over,
  }) as unknown as GitService

afterEach(() => {
  useKlankStore.getState().setSyncStatus({ state: 'idle', lastSyncedAt: null, message: '' })
})

describe('runGitSync', () => {
  it('stays offline and never syncs when not signed in', async () => {
    const sync = vi.fn()
    await runGitSync(makeGit({ isAuthenticated: async () => false, sync }), baseDir, undefined)
    expect(sync).not.toHaveBeenCalled()
    expect(useKlankStore.getState().syncStatus.state).toBe('offline')
    expect(useKlankStore.getState().syncStatus.kind).toBe('auth')
  })

  it('reports "No repository" when the folder is not a git repo', async () => {
    const sync = vi.fn()
    await runGitSync(makeGit({ isGitRepo: async () => false, sync }), baseDir, undefined)
    expect(sync).not.toHaveBeenCalled()
    expect(useKlankStore.getState().syncStatus.message).toBe('No repository')
  })

  it('re-hydrates settings + playlists + play metrics and fires onChanged when the tree changed', async () => {
    const readTabSettings = vi
      .fn()
      .mockResolvedValue({ '/tabs/a.tab.txt': { fontSize: 1, transpose: 0, scrollSpeed: 1 } })
    const readPlaylists = vi.fn().mockResolvedValue([])
    const readPlayMetrics = vi.fn().mockResolvedValue({ '/tabs/a.tab.txt': { playCount: 2, lastPlayedAt: 5 } })
    const fileService = { readTabSettings, readPlaylists, readPlayMetrics } as unknown as FileService
    const onChanged = vi.fn()

    await runGitSync(
      makeGit({ sync: async () => okResult({ changed: true, message: 'pulled 1' }) }),
      baseDir,
      fileService,
      onChanged,
    )

    expect(readTabSettings).toHaveBeenCalledWith(baseDir)
    expect(readPlaylists).toHaveBeenCalledWith(baseDir)
    expect(readPlayMetrics).toHaveBeenCalledWith(baseDir)
    expect(useKlankStore.getState().playMetricByPath).toEqual({ '/tabs/a.tab.txt': { playCount: 2, lastPlayedAt: 5 } })
    expect(onChanged).toHaveBeenCalledOnce()
    expect(useKlankStore.getState().syncStatus.state).toBe('idle')
    expect(useKlankStore.getState().syncStatus.lastSyncedAt).not.toBeNull()
  })

  it('does not re-hydrate when nothing changed', async () => {
    const readTabSettings = vi.fn()
    const fileService = { readTabSettings, readPlaylists: vi.fn() } as unknown as FileService
    await runGitSync(makeGit({ sync: async () => okResult({ changed: false }) }), baseDir, fileService)
    expect(readTabSettings).not.toHaveBeenCalled()
    expect(useKlankStore.getState().syncStatus.state).toBe('idle')
  })

  it('surfaces sync failures with their error category', async () => {
    await runGitSync(
      makeGit({ sync: async () => okResult({ success: false, error: 'boom', message: 'boom', errorKind: 'network' }) }),
      baseDir,
      undefined,
    )
    expect(useKlankStore.getState().syncStatus.state).toBe('error')
    expect(useKlankStore.getState().syncStatus.message).toBe('boom')
    expect(useKlankStore.getState().syncStatus.kind).toBe('network')
  })

  it('defaults the error category to "other" when the engine omits it', async () => {
    await runGitSync(
      makeGit({ sync: async () => okResult({ success: false, error: 'boom' }) }),
      baseDir,
      undefined,
    )
    expect(useKlankStore.getState().syncStatus.kind).toBe('other')
  })
})

describe('clampMinutes', () => {
  it('keeps valid values at or above the minimum', () => {
    expect(clampMinutes(30, 1, 30)).toBe(30)
    expect(clampMinutes(0, 1, 30)).toBe(1)
  })

  it('falls back when the value is not finite (corrupt persisted state)', () => {
    expect(clampMinutes(NaN, 1, 30)).toBe(30)
    expect(clampMinutes(Infinity, 0, 5)).toBe(5)
    expect(clampMinutes(-Infinity, 0, 5)).toBe(5)
  })
})

describe('describeSyncStatus', () => {
  const make = (over: Partial<SyncStatus>): SyncStatus => ({
    state: 'idle',
    lastSyncedAt: null,
    message: '',
    ...over,
  })

  it('shows an ok tone with a timestamp once synced', () => {
    const d = describeSyncStatus(make({ state: 'idle', lastSyncedAt: Date.now() }))
    expect(d.tone).toBe('ok')
    expect(d.text).toContain('Synced')
  })

  it('flags an auth error with no raw text in the headline', () => {
    const d = describeSyncStatus(make({ state: 'error', kind: 'auth', message: 'remote: 403' }))
    expect(d.tone).toBe('error')
    expect(d.text.toLowerCase()).toContain('sign-in')
    expect(d.text).not.toContain('403') // raw detail is tucked away
    expect(d.detail).toBe('remote: 403')
  })

  it('flags a connectivity error', () => {
    const d = describeSyncStatus(make({ state: 'error', kind: 'network', message: 'could not resolve host' }))
    expect(d.tone).toBe('error')
    expect(d.text.toLowerCase()).toContain('reach')
  })

  it('warns (not errors) when offline because of missing auth', () => {
    const d = describeSyncStatus(make({ state: 'offline', kind: 'auth', message: 'Not signed in' }))
    expect(d.tone).toBe('warn')
    expect(d.detail).toBeUndefined()
  })
})

describe('useGitSync scheduling guard', () => {
  // Default to "not in Tauri" so gitRef stays null and no real sync fires;
  // re-set here because the afterEach restore clears the implementation.
  beforeEach(() => {
    vi.mocked(createGitService).mockImplementation(async () => { throw new Error('no tauri') })
  })
  afterEach(() => vi.restoreAllMocks())

  it('clamps a corrupt persisted interval so setInterval never receives NaN', () => {
    // Regression: a NaN interval made `setInterval(NaN)` fire every tick (runaway).
    useKlankStore.setState({
      baseDirectory: '/tabs',
      syncSettings: { enabled: true, intervalMinutes: NaN, debounceMinutes: 5 },
    })
    const spy = vi.spyOn(globalThis, 'setInterval')
    const { unmount } = renderHook(() => useGitSync())
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 30 * 60_000) // fallback, not NaN
    expect(spy.mock.calls.every(([, ms]) => Number.isFinite(ms))).toBe(true)
    unmount()
  })

  it('uses the configured interval when it is valid', () => {
    useKlankStore.setState({
      baseDirectory: '/tabs',
      syncSettings: { enabled: true, intervalMinutes: 15, debounceMinutes: 5 },
    })
    const spy = vi.spyOn(globalThis, 'setInterval')
    const { unmount } = renderHook(() => useGitSync())
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 15 * 60_000)
    unmount()
  })

  it('does not schedule a timer while auto-sync is disabled', () => {
    useKlankStore.setState({
      baseDirectory: '/tabs',
      syncSettings: { enabled: false, intervalMinutes: 30, debounceMinutes: 5 },
    })
    const spy = vi.spyOn(globalThis, 'setInterval')
    const { unmount } = renderHook(() => useGitSync())
    expect(spy).not.toHaveBeenCalled()
    unmount()
  })

  it('throttles focus-driven syncs to the configured interval', async () => {
    const sync = vi.fn(async () => okResult())
    vi.mocked(createGitService).mockResolvedValue(makeGit({ sync }))
    useKlankStore.setState({
      baseDirectory: '/tabs',
      syncSettings: { enabled: true, intervalMinutes: 30, debounceMinutes: 5 },
    })

    const base = 1_700_000_000_000
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(base)
    const { unmount } = renderHook(() => useGitSync())
    // Let the async createGitService resolve so gitRef is wired up.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // First focus has no prior sync to throttle against → syncs.
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(sync).toHaveBeenCalledTimes(1)

    // A focus event 10 min later is inside the 30-min window → ignored.
    now.mockReturnValue(base + 10 * 60_000)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(sync).toHaveBeenCalledTimes(1)

    // A focus event past the interval → syncs again.
    now.mockReturnValue(base + 31 * 60_000)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(sync).toHaveBeenCalledTimes(2)

    unmount()
  })
})
