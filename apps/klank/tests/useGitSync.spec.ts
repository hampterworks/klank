import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKlankStore } from '@klank/store'
import type { FileService, GitService, SyncResult } from '@klank/platform-api'
import { runGitSync } from '../app/useGitSync'

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

  it('surfaces sync failures as an error status', async () => {
    await runGitSync(
      makeGit({ sync: async () => okResult({ success: false, error: 'boom', message: 'boom' }) }),
      baseDir,
      undefined,
    )
    expect(useKlankStore.getState().syncStatus.state).toBe('error')
    expect(useKlankStore.getState().syncStatus.message).toBe('boom')
  })
})
