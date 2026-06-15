import styles from './settings.module.css'
import { useEffect, useRef, useState } from 'react'
import { createGitService, getAppVersion, isMobileDevice, type BranchInfo, type GitService } from '@klank/platform-api'
import { useKlankStore, type SyncStatus } from '@klank/store'
import { runGitSync } from '../useGitSync'

type Status = { ok: boolean; message: string } | null

const formatSince = (ts: number | null): string => {
  if (!ts) return 'never'
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type SyncTone = 'ok' | 'warn' | 'error' | 'neutral'

/**
 * Maps the raw sync status to one concise, actionable line (and an optional raw
 * detail), so the user can tell auth from connectivity issues at a glance without
 * the section being flooded with libgit2 output.
 */
export const describeSyncStatus = (status: SyncStatus): { text: string; tone: SyncTone; detail?: string } => {
  switch (status.state) {
    case 'syncing':
      return { text: 'Syncing…', tone: 'neutral' }
    case 'offline':
      return status.kind === 'auth'
        ? { text: '⚠ Not signed in — connect an account below', tone: 'warn' }
        : { text: status.message || 'Not syncing', tone: 'neutral' }
    case 'error':
      if (status.kind === 'auth')
        return { text: '✕ Sign-in needed — check your token or system credentials', tone: 'error', detail: status.message }
      if (status.kind === 'network')
        return { text: '✕ Can’t reach the remote — check your connection', tone: 'error', detail: status.message }
      return { text: '✕ Sync failed', tone: 'error', detail: status.message }
    case 'idle':
    default:
      return status.lastSyncedAt
        ? { text: `✓ Synced · ${formatSince(status.lastSyncedAt)}`, tone: 'ok' }
        : { text: 'Not synced yet', tone: 'neutral' }
  }
}

const toneClass: Record<SyncTone, string> = {
  ok: 'statusOk',
  warn: 'statusWarn',
  error: 'statusError',
  neutral: '',
}

export function SettingsPanel() {
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const setTheme = useKlankStore().setTheme
  const theme = useKlankStore().theme
  const instrument = useKlankStore().instrument
  const setInstrument = useKlankStore().setInstrument
  const fileService = useKlankStore().fileService
  const setTabSettings = useKlankStore().setTabSettings
  const setPlaylists = useKlankStore().setPlaylists
  const syncSettings = useKlankStore().syncSettings
  const setSyncSettings = useKlankStore().setSyncSettings
  const syncStatus = useKlankStore().syncStatus

  const gitRef = useRef<GitService | null>(null)
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState<string>('')
  const [token, setTokenValue] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [systemCreds, setSystemCreds] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSyncDetail, setShowSyncDetail] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const isMobile = isMobileDevice()
  const sync = describeSyncStatus(syncStatus)

  const refreshBranches = async (dir: string, git: GitService) => {
    const list = await git.listBranches(dir)
    setBranches(list)
    setCurrentBranch(list.find((b) => b.isHead)?.name ?? '')
  }

  const rehydrate = async (dir: string) => {
    if (!fileService) return
    const [settings, playlists] = await Promise.all([
      fileService.readTabSettings(dir),
      fileService.readPlaylists(dir),
    ])
    setTabSettings(settings)
    setPlaylists(playlists)
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const git = await createGitService()
        gitRef.current = git
        if (!baseDirectory) return
        const [repo, tokenStored, sysCreds] = await Promise.all([
          git.isGitRepo(baseDirectory),
          git.hasToken(),
          git.systemCredentialsEnabled(),
        ])
        if (cancelled) return
        setIsRepo(repo)
        setHasToken(tokenStored)
        setSystemCreds(sysCreds)
        if (repo) await refreshBranches(baseDirectory, git)
      } catch {
        // not in Tauri context (server render)
      }
    }
    init()
    return () => { cancelled = true }
  }, [baseDirectory])

  useEffect(() => {
    getAppVersion().then(setVersion)
  }, [])

  const handleChangeFolder = async () => {
    if (!fileService) return
    const path = await fileService.getDirectoryPath()
    if (path) setBaseDirectory(path)
  }

  const handleSaveToken = async () => {
    if (!gitRef.current || busy) return
    setBusy(true)
    try {
      await gitRef.current.setToken(token)
      setHasToken(token.trim().length > 0)
      setTokenValue('')
      setStatus({ ok: true, message: token.trim() ? 'Token saved.' : 'Token cleared.' })
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : 'Could not save token' })
    } finally {
      setBusy(false)
    }
  }

  const handleUseSystemCreds = async () => {
    if (!gitRef.current || !baseDirectory || busy) return
    setBusy(true)
    try {
      const result = await gitRef.current.useSystemCredentials(baseDirectory)
      setStatus({ ok: result.success, message: result.output || result.error || '' })
      if (result.success) setSystemCreds(true)
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnectSystemCreds = async () => {
    if (!gitRef.current || busy) return
    setBusy(true)
    try {
      await gitRef.current.disableSystemCredentials()
      setSystemCreds(false)
      setStatus({ ok: true, message: 'Disconnected system Git credentials.' })
    } finally {
      setBusy(false)
    }
  }

  const handleClone = async () => {
    if (!gitRef.current || !baseDirectory || !cloneUrl.trim() || busy) return
    setBusy(true)
    try {
      const result = await gitRef.current.cloneRepo(cloneUrl.trim(), baseDirectory)
      setStatus({ ok: result.success, message: result.output || result.error || '' })
      if (result.success) {
        setIsRepo(true)
        await refreshBranches(baseDirectory, gitRef.current)
        await rehydrate(baseDirectory)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSyncNow = async () => {
    if (!gitRef.current || !baseDirectory || busy) return
    setBusy(true)
    try {
      await runGitSync(gitRef.current, baseDirectory, fileService)
      await refreshBranches(baseDirectory, gitRef.current)
    } finally {
      setBusy(false)
    }
  }

  const handleSelectBranch = async (name: string) => {
    if (!gitRef.current || !baseDirectory || busy || name === currentBranch) return
    setBusy(true)
    try {
      // Commit/push current branch first so switching never loses local edits.
      await runGitSync(gitRef.current, baseDirectory, fileService)
      const result = await gitRef.current.checkoutBranch(baseDirectory, name)
      setStatus({ ok: result.success, message: result.output || result.error || '' })
      if (result.success) {
        await rehydrate(baseDirectory)
        await runGitSync(gitRef.current, baseDirectory, fileService)
        await refreshBranches(baseDirectory, gitRef.current)
      }
    } finally {
      setBusy(false)
    }
  }

  const tokenRow = (
    <div className={styles.row}>
      <span className={styles.label}>Token</span>
      <input
        className={styles.commitInput}
        type="password"
        placeholder={hasToken ? '•••••••• (saved)' : 'HTTPS access token'}
        value={token}
        onChange={(e) => setTokenValue(e.target.value)}
        disabled={busy}
      />
      <button className={styles.button} onClick={handleSaveToken} disabled={busy || (!token.trim() && !hasToken)}>
        {token.trim() ? 'Save' : 'Clear'}
      </button>
    </div>
  )

  return (
    <div className={styles.panel}>
      <div className={styles.content}>
        <section className={styles.section}>
          <h2>General</h2>

          <div className={styles.row}>
            <span className={styles.label}>Folder</span>
            <span className={styles.dirPath} title={baseDirectory ?? ''}>
              {baseDirectory ?? 'Not set'}
            </span>
            {/* The native folder picker isn't available on mobile, where tabs
                live in app-private storage. */}
            {!isMobileDevice() && (
              <button className={styles.button} onClick={handleChangeFolder} disabled={!fileService}>
                Change
              </button>
            )}
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Version</span>
            <span className={styles.dirPath}>{version || '…'}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Theme</span>
            <button
              className={styles.button}
              onClick={() => setTheme(theme === 'Light' ? 'Dark' : 'Light')}
            >
              {theme === 'Light' ? 'Switch to Dark' : 'Switch to Light'}
            </button>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Instrument</span>
            <button
              className={styles.button}
              style={{ opacity: instrument === 'guitar' ? 1 : 0.5 }}
              onClick={() => setInstrument('guitar')}
            >
              Guitar
            </button>
            <button
              className={styles.button}
              style={{ opacity: instrument === 'bass' ? 1 : 0.5 }}
              onClick={() => setInstrument('bass')}
            >
              Bass
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Sync</h2>

          {/* Access: desktop gets one-click system credentials; PAT is the
              cross-platform fallback (and the only option on mobile). */}
          {!isMobile && (
            <div className={styles.row}>
              <span className={styles.label}>Account</span>
              {systemCreds ? (
                <>
                  <span className={styles.dirPath}>Using system Git credentials ✓</span>
                  <button className={styles.button} onClick={handleDisconnectSystemCreds} disabled={busy}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button className={styles.button} onClick={handleUseSystemCreds} disabled={busy}>
                  Use system Git credentials
                </button>
              )}
            </div>
          )}

          {/* Mobile has no credential helper, so the token is the primary control. */}
          {isMobile ? (
            tokenRow
          ) : (
            <>
              <div className={styles.row}>
                <button className={styles.button} onClick={() => setShowAdvanced((v) => !v)} disabled={busy}>
                  {showAdvanced ? 'Hide advanced' : 'Advanced'}
                </button>
              </div>
              {showAdvanced && tokenRow}
            </>
          )}

          {isRepo === null && (
            <span className={styles.infoMessage}>Checking repository…</span>
          )}

          {isRepo === false && (
            <>
              <span className={styles.infoMessage}>
                No git repository in the current folder. Clone your tabs repository to sync it here.
              </span>
              <div className={styles.row}>
                <input
                  className={styles.commitInput}
                  type="url"
                  placeholder="https://github.com/you/tabs.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  disabled={busy}
                />
                <button className={styles.button} onClick={handleClone} disabled={busy || !cloneUrl.trim()}>
                  Clone
                </button>
              </div>
            </>
          )}

          {isRepo === true && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Branch</span>
                <select
                  className={styles.commitInput}
                  value={currentBranch}
                  onChange={(e) => handleSelectBranch(e.target.value)}
                  disabled={busy || branches.length === 0}
                >
                  {branches.length === 0 && <option value="">…</option>}
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}{b.isRemote ? ' (remote)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.row}>
                <span className={styles.label}>Status</span>
                <span
                  className={`${styles.syncStatus} ${toneClass[sync.tone] ? styles[toneClass[sync.tone]] : ''}`}
                  title={syncStatus.message || undefined}
                >
                  {sync.text}
                </span>
                {sync.detail && (
                  <button className={styles.linkButton} onClick={() => setShowSyncDetail((v) => !v)}>
                    {showSyncDetail ? 'Hide' : 'Details'}
                  </button>
                )}
                <button className={styles.button} onClick={handleSyncNow} disabled={busy}>
                  Sync now
                </button>
              </div>
              {sync.detail && showSyncDetail && (
                <div className={`${styles.statusLine} ${styles.error}`}>{sync.detail}</div>
              )}

              <div className={styles.row}>
                <span className={styles.label}>Auto-sync</span>
                <button
                  className={styles.button}
                  onClick={() => setSyncSettings({ enabled: !syncSettings.enabled })}
                  disabled={busy}
                >
                  {syncSettings.enabled ? 'On' : 'Off'}
                </button>
              </div>

              <div className={styles.row}>
                <span className={styles.label}>Every</span>
                <input
                  className={styles.commitInput}
                  type="number"
                  min={1}
                  value={syncSettings.intervalMinutes}
                  onChange={(e) => setSyncSettings({ intervalMinutes: Math.max(1, Number(e.target.value) || 1) })}
                  disabled={busy || !syncSettings.enabled}
                />
                <span className={styles.label}>min</span>
              </div>

              <div className={styles.row}>
                <span className={styles.label}>After edit</span>
                <input
                  className={styles.commitInput}
                  type="number"
                  min={0}
                  value={syncSettings.debounceMinutes}
                  onChange={(e) => setSyncSettings({ debounceMinutes: Math.max(0, Number(e.target.value) || 0) })}
                  disabled={busy || !syncSettings.enabled}
                />
                <span className={styles.label}>min</span>
              </div>

              {status && (
                <div className={`${styles.statusLine} ${status.ok ? styles.success : styles.error}`}>
                  {status.message || (status.ok ? 'Done.' : 'Operation failed.')}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
