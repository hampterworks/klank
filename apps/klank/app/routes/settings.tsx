import styles from './settings.module.css'
import { useEffect, useRef, useState } from 'react'
import { checkForUpdate, createGitService, createJamHost, discoverJams, getAppVersion, installUpdate, isMobileDevice, openUpdateUrl, type BranchInfo, type DiscoveredJam, type GitService, type JamHost, type UpdateCheck } from '@klank/platform-api'
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
  const setPlayMetrics = useKlankStore().setPlayMetrics
  const syncSettings = useKlankStore().syncSettings
  const setSyncSettings = useKlankStore().setSyncSettings
  const syncStatus = useKlankStore().syncStatus

  // Jam store slice
  const jamRole = useKlankStore((s) => s.jam.role)
  const jamUrls = useKlankStore((s) => s.jam.urls)
  const jamConnected = useKlankStore((s) => s.jam.connected)
  const jamHostAddress = useKlankStore((s) => s.jam.hostAddress)
  const hostedJamName = useKlankStore((s) => s.jam.name)
  const jamClients = useKlankStore((s) => s.jam.clients)
  const setJamHosting = useKlankStore((s) => s.setJamHosting)
  const setJamGuest = useKlankStore((s) => s.setJamGuest)
  const setJamOff = useKlankStore((s) => s.setJamOff)
  const setJamClients = useKlankStore((s) => s.setJamClients)

  // Single JamHost instance shared across host actions in this panel.
  const jamHostRef = useRef<JamHost | null>(null)
  const [joinAddress, setJoinAddress] = useState('')
  const [jamBusy, setJamBusy] = useState(false)
  // Editable jam name; default is a random klank-jam-NNNN (never the device name).
  const [jamName, setJamName] = useState(() => `klank-jam-${Math.floor(1000 + Math.random() * 9000)}`)
  const [discovered, setDiscovered] = useState<DiscoveredJam[]>([])
  const [scanning, setScanning] = useState(false)
  const [showManualJoin, setShowManualJoin] = useState(false)

  const scanForJams = async () => {
    setScanning(true)
    try {
      setDiscovered(await discoverJams())
    } finally {
      setScanning(false)
    }
  }

  // Auto-scan for nearby jams when not in a jam, and poll the connected count
  // while hosting so the host sees joins/leaves live.
  useEffect(() => {
    if (jamRole === 'off') {
      scanForJams()
      return
    }
    if (jamRole === 'host') {
      let cancelled = false
      const poll = async () => {
        if (!jamHostRef.current) jamHostRef.current = await createJamHost()
        const status = await jamHostRef.current.status()
        if (!cancelled) setJamClients(status.clients)
      }
      poll()
      const id = setInterval(poll, 2000)
      return () => {
        cancelled = true
        clearInterval(id)
      }
    }
    return
  }, [jamRole, setJamClients])

  const getOrCreateJamHost = async (): Promise<JamHost> => {
    if (!jamHostRef.current) {
      jamHostRef.current = await createJamHost()
    }
    return jamHostRef.current
  }

  const handleStartHosting = async () => {
    if (jamBusy) return
    setJamBusy(true)
    try {
      const host = await getOrCreateJamHost()
      const name = jamName.trim() || `klank-jam-${Math.floor(1000 + Math.random() * 9000)}`
      const info = await host.start(name)
      setJamHosting(info)
    } finally {
      setJamBusy(false)
    }
  }

  const handleStopHosting = async () => {
    if (jamBusy) return
    setJamBusy(true)
    try {
      const host = await getOrCreateJamHost()
      await host.stop()
      setJamOff()
    } finally {
      setJamBusy(false)
    }
  }

  const handleJoinJam = () => {
    const addr = joinAddress.trim()
    if (!addr) return
    setJamGuest(addr)
  }

  const gitRef = useRef<GitService | null>(null)
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState<string>('')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheck | null>(null)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)
  const [updateStatus, setUpdateStatus] = useState<Status>(null)
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
    const [settings, playlists, playMetrics] = await Promise.all([
      fileService.readTabSettings(dir),
      fileService.readPlaylists(dir),
      fileService.readPlayMetrics(dir),
    ])
    setTabSettings(settings)
    setPlaylists(playlists)
    setPlayMetrics(playMetrics)
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

  const handleCheckUpdate = async () => {
    if (updateBusy) return
    setUpdateBusy(true)
    setUpdateStatus(null)
    try {
      const result = await checkForUpdate(version)
      setUpdateInfo(result)
      if (result.kind === 'upToDate') setUpdateStatus({ ok: true, message: 'You’re on the latest version.' })
    } catch (e) {
      setUpdateStatus({ ok: false, message: e instanceof Error ? e.message : 'Could not check for updates' })
    } finally {
      setUpdateBusy(false)
    }
  }

  const handleInstallUpdate = async () => {
    if (updateBusy || !updateInfo || updateInfo.kind === 'upToDate') return
    if (updateInfo.kind === 'android') {
      try {
        await openUpdateUrl(updateInfo.url)
      } catch (e) {
        setUpdateStatus({ ok: false, message: e instanceof Error ? e.message : 'Could not open the download page' })
      }
      return
    }
    setUpdateBusy(true)
    setUpdateProgress(0)
    try {
      // On success the installer restarts the app, so this never settles the
      // busy state back - the button stays on "Installing…" until relaunch.
      await installUpdate(setUpdateProgress)
    } catch (e) {
      setUpdateStatus({ ok: false, message: e instanceof Error ? e.message : 'Update failed' })
      setUpdateProgress(null)
      setUpdateBusy(false)
    }
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
            <span className={styles.label}>Updates</span>
            {updateInfo && updateInfo.kind !== 'upToDate' ? (
              <>
                <span className={styles.dirPath}>v{updateInfo.version} available</span>
                <button className={styles.button} onClick={handleInstallUpdate} disabled={updateBusy}>
                  {updateProgress !== null
                    ? updateProgress < 100
                      ? `Downloading… ${updateProgress}%`
                      : 'Installing…'
                    : updateInfo.kind === 'android'
                      ? 'Download APK'
                      : 'Install & restart'}
                </button>
              </>
            ) : (
              <button className={styles.button} onClick={handleCheckUpdate} disabled={updateBusy}>
                {updateBusy ? 'Checking…' : 'Check for updates'}
              </button>
            )}
          </div>
          {updateStatus && (
            <div className={`${styles.statusLine} ${updateStatus.ok ? styles.success : styles.error}`}>
              {updateStatus.message}
            </div>
          )}

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
        {/* ── Jam mode ──────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2>Jam mode</h2>

          {jamRole === 'off' && (
            <>
              <span className={styles.infoMessage}>
                Play together on your local network — one device hosts, the others follow along live.
              </span>

              <div className={styles.row}>
                <span className={styles.label}>Jam name</span>
                <input
                  className={styles.commitInput}
                  type="text"
                  value={jamName}
                  onChange={(e) => setJamName(e.target.value)}
                  aria-label="Jam name"
                />
                <button className={styles.button} onClick={handleStartHosting} disabled={jamBusy}>
                  Host
                </button>
              </div>

              <div className={styles.jamSubhead}>
                <span>Nearby jams</span>
                <button className={styles.linkButton} onClick={scanForJams} disabled={scanning}>
                  {scanning ? 'Scanning…' : 'Refresh'}
                </button>
              </div>

              {discovered.length === 0 ? (
                <span className={styles.infoMessage}>
                  {scanning ? 'Looking for jams on your network…' : 'No open jams found nearby.'}
                </span>
              ) : (
                <div className={styles.jamList}>
                  {discovered.map((jam) => (
                    <div key={jam.address} className={styles.jamListRow}>
                      <span className={styles.jamListName} title={jam.name}>{jam.name}</span>
                      <span className={styles.jamListAddress}>{jam.address}</span>
                      <button className={styles.button} onClick={() => setJamGuest(jam.address)}>
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button className={styles.linkButton} onClick={() => setShowManualJoin((v) => !v)}>
                {showManualJoin ? 'Hide manual join' : 'Join by address'}
              </button>
              {showManualJoin && (
                <div className={styles.row}>
                  <input
                    className={styles.commitInput}
                    type="text"
                    placeholder="192.168.1.5:7070"
                    value={joinAddress}
                    onChange={(e) => setJoinAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinJam()}
                    aria-label="Host address"
                  />
                  <button
                    className={styles.button}
                    onClick={handleJoinJam}
                    disabled={!joinAddress.trim()}
                  >
                    Join
                  </button>
                </div>
              )}
            </>
          )}

          {jamRole === 'host' && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Status</span>
                <span className={styles.jamStatus}>
                  Hosting{hostedJamName ? ` “${hostedJamName}”` : ''}
                </span>
                <button className={styles.button} onClick={handleStopHosting} disabled={jamBusy}>
                  Stop hosting
                </button>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Connected</span>
                <span className={styles.jamStatus}>
                  {jamClients} {jamClients === 1 ? 'person' : 'people'}
                </span>
              </div>
              {jamUrls.length > 0 && (
                <div className={styles.row}>
                  <span className={styles.label}>Share</span>
                  <div className={styles.jamUrls}>
                    {jamUrls.map((url) => (
                      <div key={url} className={styles.jamUrlRow}>
                        <span className={styles.dirPath} title={url}>{url}</span>
                        <button
                          className={styles.button}
                          onClick={() => navigator.clipboard?.writeText(url)}
                          aria-label={`Copy ${url}`}
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <span className={styles.infoMessage}>
                Others on your network can find this jam in their app, open these URLs in a browser, or join with the ip:port.
              </span>
            </>
          )}

          {jamRole === 'guest' && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Status</span>
                <span className={styles.jamStatus}>
                  {jamConnected ? `Connected to ${jamHostAddress}` : `Connecting to ${jamHostAddress}…`}
                </span>
                <button className={styles.button} onClick={setJamOff}>
                  Leave
                </button>
              </div>
              {jamConnected && jamClients > 0 && (
                <div className={styles.row}>
                  <span className={styles.label}>Connected</span>
                  <span className={styles.jamStatus}>
                    {jamClients} {jamClients === 1 ? 'person' : 'people'}
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
