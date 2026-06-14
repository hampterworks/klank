import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKlankStore, type SyncStatus } from '@klank/store'
import type { FileService, GitService, SyncResult } from '@klank/platform-api'
import { runGitSync } from '../app/useGitSync'
import { describeSyncStatus } from '../app/routes/settings'

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

  it('re-hydrates settings + playlists and fires onChanged when the tree changed', async () => {
    const readTabSettings = vi
      .fn()
      .mockResolvedValue({ '/tabs/a.tab.txt': { fontSize: 1, transpose: 0, scrollSpeed: 1 } })
    const readPlaylists = vi.fn().mockResolvedValue([])
    const fileService = { readTabSettings, readPlaylists } as unknown as FileService
    const onChanged = vi.fn()

    await runGitSync(
      makeGit({ sync: async () => okResult({ changed: true, message: 'pulled 1' }) }),
      baseDir,
      fileService,
      onChanged,
    )

    expect(readTabSettings).toHaveBeenCalledWith(baseDir)
    expect(readPlaylists).toHaveBeenCalledWith(baseDir)
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
