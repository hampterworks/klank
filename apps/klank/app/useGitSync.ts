import { useCallback, useEffect, useRef } from 'react'
import { onTabsChanged, useKlankStore } from '@klank/store'
import { createGitService, type FileService, type GitService } from '@klank/platform-api'

const MINUTE_MS = 60_000

/**
 * Runs one sync: updates `syncStatus`, delegates to the Rust `git_sync`, and
 * re-hydrates disk-backed state when the working tree changed. Shared by the
 * background loop and the manual "Sync now" button so both behave identically.
 */
export async function runGitSync(
  git: GitService,
  baseDirectory: string,
  fileService: FileService | undefined,
  onChanged?: () => void,
): Promise<void> {
  const { setSyncStatus, setTabSettings, setPlaylists } = useKlankStore.getState()
  try {
    const [isRepo, authed] = await Promise.all([git.isGitRepo(baseDirectory), git.isAuthenticated()])
    if (!isRepo || !authed) {
      setSyncStatus({ state: 'offline', message: isRepo ? 'Not signed in' : 'No repository' })
      return
    }
    setSyncStatus({ state: 'syncing', message: 'Syncing…' })
    const result = await git.sync(baseDirectory)
    if (!result.success) {
      setSyncStatus({ state: 'error', message: result.error || result.message || 'Sync failed' })
      return
    }
    setSyncStatus({ state: 'idle', lastSyncedAt: Date.now(), message: result.message })
    if (result.changed && fileService) {
      const [settings, playlists] = await Promise.all([
        fileService.readTabSettings(baseDirectory),
        fileService.readPlaylists(baseDirectory),
      ])
      setTabSettings(settings)
      setPlaylists(playlists)
      onChanged?.()
    }
  } catch (e) {
    setSyncStatus({ state: 'error', message: e instanceof Error ? e.message : 'Sync failed' })
  }
}

/**
 * Drives unobtrusive background git sync. The user only configures access (token)
 * and a branch; this hook keeps the local tab folder and the remote converged by
 * itself — on startup, on a periodic timer, shortly after local edits settle
 * (debounced), and when the window regains focus. Every run delegates to the Rust
 * `git_sync` (auto-commit → pull-rebase → auto-resolve → push), which also serializes
 * concurrent runs. When a sync pulls remote changes, disk-backed state is re-hydrated.
 *
 * @param onChanged Called after a sync that changed the working tree (e.g. to
 *   refresh the file tree). Settings/playlists are re-hydrated automatically.
 */
export function useGitSync(onChanged?: () => void): void {
  const baseDirectory = useKlankStore((s) => s.baseDirectory)
  const fileService = useKlankStore((s) => s.fileService)
  const { enabled, intervalMinutes, debounceMinutes } = useKlankStore((s) => s.syncSettings)

  const gitRef = useRef<GitService | null>(null)
  const runningRef = useRef(false)
  const queuedRef = useRef(false)
  // Always-latest sync implementation, so the stable `trigger` never goes stale.
  const runSyncRef = useRef<() => Promise<void>>(async () => undefined)
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  useEffect(() => {
    let cancelled = false
    createGitService()
      .then((g) => {
        if (!cancelled) gitRef.current = g
      })
      .catch(() => undefined) // not in a Tauri context (browser/server)
    return () => {
      cancelled = true
    }
  }, [])

  // Rebuilt every render so it closes over the current store values. Coalesces
  // overlapping requests into a single follow-up run.
  runSyncRef.current = async () => {
    const git = gitRef.current
    if (!git || !baseDirectory) return
    if (runningRef.current) {
      queuedRef.current = true
      return
    }
    runningRef.current = true
    try {
      await runGitSync(git, baseDirectory, fileService, onChangedRef.current)
    } finally {
      runningRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        void runSyncRef.current()
      }
    }
  }

  const trigger = useCallback(() => {
    void runSyncRef.current()
  }, [])

  // Startup + whenever the directory or enabled flag changes.
  useEffect(() => {
    if (enabled && baseDirectory) trigger()
  }, [enabled, baseDirectory, trigger])

  // Periodic timer.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(trigger, Math.max(1, intervalMinutes) * MINUTE_MS)
    return () => clearInterval(id)
  }, [enabled, intervalMinutes, trigger])

  // Debounced sync after local edits settle.
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = onTabsChanged(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(trigger, Math.max(0, debounceMinutes) * MINUTE_MS)
    })
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [enabled, debounceMinutes, trigger])

  // Sync when the user returns to the app.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const onFocus = () => trigger()
    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, trigger])
}
