import styles from './settings.module.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createGitService, getAppVersion, isMobileDevice, type GitChangedFile, type GitResult, type GitService } from '@klank/platform-api'
import { useKlankStore } from '@klank/store'

type Status = { ok: boolean; message: string } | null

export default function Settings() {
  const navigate = useNavigate()
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const setTheme = useKlankStore().setTheme
  const theme = useKlankStore().theme
  const instrument = useKlankStore().instrument
  const setInstrument = useKlankStore().setInstrument
  const fileService = useKlankStore().fileService

  const gitRef = useRef<GitService | null>(null)
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [changedFiles, setChangedFiles] = useState<GitChangedFile[]>([])
  const [unpushedCommits, setUnpushedCommits] = useState<string[]>([])
  const [commitMessage, setCommitMessage] = useState('Update tabs')
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState<string>('')
  const [token, setTokenValue] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')

  const refreshGitState = async (dir: string, git: GitService) => {
    const [files, commits] = await Promise.all([
      git.getChangedFiles(dir),
      git.getUnpushedCommits(dir),
    ])
    setChangedFiles(files)
    setUnpushedCommits(commits)
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
        if (repo) await refreshGitState(baseDirectory, git)
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

  const applyResult = async (result: GitResult) => {
    setStatus({ ok: result.success, message: result.output || result.error || '' })
    if (result.success && baseDirectory && gitRef.current) {
      await refreshGitState(baseDirectory, gitRef.current)
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

  const handleClone = async () => {
    if (!gitRef.current || !baseDirectory || !cloneUrl.trim() || busy) return
    setBusy(true)
    try {
      const result = await gitRef.current.cloneRepo(cloneUrl.trim(), baseDirectory)
      setStatus({ ok: result.success, message: result.output || result.error || '' })
      if (result.success) {
        setIsRepo(true)
        await refreshGitState(baseDirectory, gitRef.current)
      }
    } finally {
      setBusy(false)
    }
  }

  const handlePull = async () => {
    if (!baseDirectory || !gitRef.current || busy) return
    setBusy(true)
    try {
      await applyResult(await gitRef.current.pull(baseDirectory))
    } finally {
      setBusy(false)
    }
  }

  const handleCommit = async () => {
    if (!baseDirectory || !gitRef.current || busy || !commitMessage.trim()) return
    setBusy(true)
    try {
      await applyResult(await gitRef.current.commit(baseDirectory, commitMessage.trim()))
    } finally {
      setBusy(false)
    }
  }

  const handlePush = async () => {
    if (!baseDirectory || !gitRef.current || busy) return
    setBusy(true)
    try {
      await applyResult(await gitRef.current.push(baseDirectory))
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
          <h2>Git</h2>

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
              <div>
                <div className={styles.row} style={{ marginBottom: 8 }}>
                  <span className={styles.label}>Changes</span>
                  <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    {changedFiles.length} file{changedFiles.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {changedFiles.length === 0 ? (
                  <span className={styles.noChanges}>No uncommitted changes</span>
                ) : (
                  <div className={styles.fileList}>
                    {changedFiles.map((f, i) => (
                      <div key={i} className={styles.fileItem}>
                        <span className={styles.fileStatus}>{f.status}</span>
                        <span>{f.path}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.row}>
                <button className={styles.button} onClick={handlePull} disabled={busy}>
                  Pull
                </button>
              </div>

              <div className={styles.row}>
                <input
                  className={styles.commitInput}
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message"
                  disabled={busy}
                />
                <button
                  className={styles.button}
                  onClick={handleCommit}
                  disabled={busy || changedFiles.length === 0 || !commitMessage.trim()}
                >
                  Commit
                </button>
              </div>

              <div className={styles.row}>
                <button
                  className={styles.button}
                  onClick={handlePush}
                  disabled={busy || unpushedCommits.length === 0}
                >
                  Push{unpushedCommits.length > 0 ? ` (${unpushedCommits.length})` : ''}
                </button>
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
