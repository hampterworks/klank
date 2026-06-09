import styles from './settings.module.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createGitService, getAppVersion, type GitChangedFile, type GitResult, type GitService } from '@klank/platform-api'
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
        const repo = await git.isGitRepo(baseDirectory)
        if (cancelled) return
        setIsRepo(repo)
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
            <button className={styles.button} onClick={handleChangeFolder} disabled={!fileService}>
              Change
            </button>
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

          {isRepo === null && (
            <span className={styles.infoMessage}>Checking repository…</span>
          )}

          {isRepo === false && (
            <span className={styles.infoMessage}>
              No git repository found in the current folder. Open a folder that is tracked by git to use these features.
            </span>
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
