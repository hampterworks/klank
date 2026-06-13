import styles from './settings.module.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createGitService, getAppVersion, isMobileDevice, type BranchInfo, type GitService } from '@klank/platform-api'
import { useKlankStore } from '@klank/store'
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

export default function Settings() {
  const navigate = useNavigate()
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
  const [cloneUrl, setCloneUrl] = useState('')

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
        const [repo, tokenStored] = await Promise.all([
          git.isGitRepo(baseDirectory),
          git.hasToken(),
        ])
        if (cancelled) return
        setIsRepo(repo)
        setHasToken(tokenStored)
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Settings</h1>
      </header>

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
                <span className={styles.dirPath}>
                  {syncStatus.state === 'syncing'
                    ? 'Syncing…'
                    : syncStatus.state === 'error'
                      ? `Error: ${syncStatus.message}`
                      : syncStatus.state === 'offline'
                        ? syncStatus.message
                        : `Last synced ${formatSince(syncStatus.lastSyncedAt)}`}
                </span>
                <button className={styles.button} onClick={handleSyncNow} disabled={busy}>
                  Sync now
                </button>
              </div>

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
