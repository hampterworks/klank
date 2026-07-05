import styles from './menu.module.css'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileEntry, getSheetFromUG, ImportProgress, sortByArtist } from '@klank/platform-api'
import {
  Button,
  DownloadIcon,
  FileTreeView,
  LogoIcon,
  NewPlaylistIcon,
  Searchbar,
  ShuffleIcon,
  TargetIcon,
  Toolbar,
  ToolTip,
} from '@klank/ui'
import { useKlankStore } from '@klank/store'
import { PlaylistSection } from './PlaylistSection'

type MenuProps = {
  tree: FileEntry[]
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
} & React.ComponentPropsWithRef<'ul'>

/**
 * Derives the song display name from a full file path:
 * strips the directory, removes `.tab.txt`, and drops the `Artist - ` prefix.
 */
const getSongDisplayName = (path: string): string => {
  const filename = path.split(/[/\\]/).slice(-1)[0] ?? ''
  const withoutExt = filename.slice(0, -8) // strip ".tab.txt"
  const dashIndex = withoutExt.indexOf(' - ')
  return dashIndex !== -1 ? withoutExt.slice(dashIndex + 3) : withoutExt
}

/**
 * Returns the neighbor path to navigate to after deleting `deletedPath`.
 * Follows the same sorted/grouped order that FileTreeView renders:
 * artist groups sorted alphabetically, songs in insertion order within each group.
 *
 * Priority:
 * 1. Next song in the same artist group
 * 2. Previous song in the same artist group
 * 3. First song of the next artist group
 * 4. "" (no open tab)
 */
const getNeighborPath = (tree: FileEntry[], deletedPath: string): string => {
  const sorted = sortByArtist(tree) // no filter — use full tree order
  const artistKeys = Object.keys(sorted)

  for (let ai = 0; ai < artistKeys.length; ai++) {
    const songs = sorted[artistKeys[ai]]
    const si = songs.findIndex((s) => s.path === deletedPath)
    if (si === -1) continue

    // 1. Next in same group
    if (si + 1 < songs.length) return songs[si + 1].path
    // 2. Previous in same group
    if (si - 1 >= 0) return songs[si - 1].path
    // 3. First song of next artist group
    if (ai + 1 < artistKeys.length) {
      const nextGroup = sorted[artistKeys[ai + 1]]
      if (nextGroup.length > 0) return nextGroup[0].path
    }
    // 4. No neighbor
    return ''
  }

  return ''
}

export const Menu: React.FC<MenuProps> = ({ tree, setNeedsUpdate, ...props }) => {
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const toggleMenu = useKlankStore().toggleMenu
  const activeView = useKlankStore().activeView
  const setActiveView = useKlankStore().setActiveView

  // Width-based mobile detection — user-agent checks miss tablets and some
  // Android WebViews that don't include "mobile" in their UA string.
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 599
  )
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 599)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const currentTabPath = useKlankStore().tab.path
  const setTabPath = useKlankStore().setTabPath
  const songSort = useKlankStore().songSort
  const toggleSongSort = useKlankStore().toggleSongSort
  const playMetricByPath = useKlankStore().playMetricByPath
  const baseDirectory = useKlankStore().baseDirectory
  const fileService = useKlankStore().fileService
  const activePlaylistId = useKlankStore().activePlaylistId
  const playlists = useKlankStore().playlists
  const addTabToPlaylist = useKlankStore().addTabToPlaylist
  const createPlaylist = useKlankStore().createPlaylist
  const deleteTab = useKlankStore().deleteTab

  const [searchFilter, setSearchFilter] = useState<string>('')
  const [isEnteringUrl, setIsEnteringUrl] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  // Live import-pipeline status shown nonintrusively in the download modal.
  const [importStage, setImportStage] = useState<{ label: string; index: number; total: number } | null>(null)
  const [importTried, setImportTried] = useState<{ label: string; reason: string }[]>([])
  // Manual-paste fallback, revealed only when every automated stage fails.
  const [showManualPaste, setShowManualPaste] = useState(false)
  const [manualArtist, setManualArtist] = useState('')
  const [manualSong, setManualSong] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [pathToConfirmDelete, setPathToConfirmDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const downloadErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null

  const handleSelectSong = (path: string) => {
    useKlankStore.setState((s) => ({ ...s, activePlaylistIndex: null }))
    setTabPath(path)
    setActiveView('tab')
  }

  const handleRequestCreatePlaylist = () => {
    setNewPlaylistName('')
    setIsCreatingPlaylist(true)
  }

  const handleConfirmCreatePlaylist = () => {
    const name = newPlaylistName.trim()
    if (!name) return
    createPlaylist(name)
    setIsCreatingPlaylist(false)
  }

  const handleCancelCreatePlaylist = () => {
    setIsCreatingPlaylist(false)
  }

  const resetImportState = () => {
    setImportStage(null)
    setImportTried([])
    setShowManualPaste(false)
    setManualArtist('')
    setManualSong('')
    setManualContent('')
    setDownloadError(null)
  }

  const handleRequestDownload = () => {
    setUrlValue('')
    resetImportState()
    setIsEnteringUrl(true)
  }

  const handleCancel = () => {
    setIsEnteringUrl(false)
    resetImportState()
  }

  // Writes a successfully-obtained tab to disk and opens it. Returns true on
  // success so callers can close the modal.
  const saveTab = async (filename: string, data: string): Promise<boolean> => {
    if (!fileService) return false
    const writtenPath = await fileService.writeTabFile(filename, baseDirectory ?? '', data)
    // writeTabFile returns an error message string on failure — only a real
    // path (always ending in .tab.txt) may become the active tab.
    if (!writtenPath.endsWith('.tab.txt')) {
      throw new Error(writtenPath)
    }
    setTabPath(writtenPath)
    setNeedsUpdate(true)
    return true
  }

  const handleSubmitUrl = async () => {
    const trimmed = urlValue.trim()
    if (!trimmed || isDownloading) return
    setIsDownloading(true)
    setDownloadError(null)
    setImportTried([])
    setShowManualPaste(false)
    try {
      const onProgress = (p: ImportProgress) => {
        if (p.type === 'StageStart') {
          setImportStage({ label: p.label, index: p.index, total: p.total })
        } else if (p.type === 'StageFailed') {
          setImportTried((prev) => [...prev, { label: p.label, reason: p.reason }])
        } else if (p.type === 'Succeeded') {
          setImportStage(null)
        }
      }
      const sheet = await getSheetFromUG(trimmed, onProgress)
      if (!sheet) {
        // Nothing parseable came back — offer manual paste rather than failing.
        setShowManualPaste(true)
        return
      }
      if (await saveTab(sheet.filename, sheet.data)) {
        setIsEnteringUrl(false)
        resetImportState()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed'
      setDownloadError(message)
      setShowManualPaste(true)
    } finally {
      setIsDownloading(false)
      setImportStage(null)
    }
  }

  const handleManualSave = async () => {
    const content = manualContent.trim()
    if (!content) return
    try {
      const filename = `${manualArtist.trim()} - ${manualSong.trim()}.tab.txt`
      if (await saveTab(filename, content)) {
        setIsEnteringUrl(false)
        resetImportState()
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not save tab')
    }
  }

  const handleCancelDelete = () => {
    setPathToConfirmDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (!pathToConfirmDelete || !fileService) return
    const path = pathToConfirmDelete

    // Step 1: Compute neighbor (only needed if it was the open tab)
    const neighbor = path === currentTabPath ? getNeighborPath(tree, path) : null

    // Step 2: Delete the file
    try {
      await fileService.deleteTabFile(path)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNotFound =
        /os error 2/i.test(msg) || /no such file/i.test(msg)
      if (!isNotFound) {
        setDeleteError('Could not delete file. It may be in use by another program.')
        if (deleteErrorTimerRef.current) clearTimeout(deleteErrorTimerRef.current)
        deleteErrorTimerRef.current = setTimeout(() => setDeleteError(null), 4000)
        setPathToConfirmDelete(null)
        return
      }
      // ENOENT — treat as success
    }

    // Step 3: Navigate away if needed (setTabPath snapshots current settings — MUST run before deleteTab)
    if (neighbor !== null) {
      setTabPath(neighbor)
    }

    // Step 4: Clean up store
    deleteTab(path)

    // Step 5: Remove from settings file
    if (baseDirectory) {
      await fileService.deleteTabSetting(path, baseDirectory)
    }

    // Step 6: Refresh tree
    setNeedsUpdate(true)

    // Step 7: Close modal
    setPathToConfirmDelete(null)
  }

  // Cleanup toast timers on unmount
  useEffect(() => {
    const deleteTimer = deleteErrorTimerRef
    const downloadTimer = downloadErrorTimerRef
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
      if (downloadTimer.current) clearTimeout(downloadTimer.current)
    }
  }, [])

  const createPlaylistModal = isCreatingPlaylist && createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) handleCancelCreatePlaylist() }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <NewPlaylistIcon />
          <span className={styles.modalTitle}>New Playlist</span>
        </div>
        <div className={styles.modalBody}>
          <input
            className={styles.modalInput}
            type="text"
            placeholder="Playlist name"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreatePlaylist()
              if (e.key === 'Escape') handleCancelCreatePlaylist()
            }}
            autoFocus
          />
          <span className={styles.modalHint}>Enter a name for your new playlist</span>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnCancel} onClick={handleCancelCreatePlaylist}>Cancel</button>
          <button className={styles.btnCreate} onClick={handleConfirmCreatePlaylist} disabled={!newPlaylistName.trim()}>Create</button>
        </div>
      </div>
    </div>,
    document.body
  )

  const downloadModal = isEnteringUrl && createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel() }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <DownloadIcon />
          <span className={styles.modalTitle}>Download Tab</span>
        </div>
        <div className={styles.modalBody}>
          <input
            className={styles.modalInput}
            type="url"
            placeholder="https://tabs.ultimate-guitar.com/…"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitUrl()
              if (e.key === 'Escape') handleCancel()
            }}
            disabled={isDownloading}
            autoFocus
          />
          <span className={styles.modalHint}>Paste an Ultimate Guitar tab URL and press Download</span>

          {isDownloading && importStage && (
            <div className={styles.importStatus} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              <span>Trying {importStage.label}… ({importStage.index}/{importStage.total})</span>
            </div>
          )}

          {importTried.length > 0 && (
            <div className={styles.triedList}>
              {importTried.map((t, i) => (
                <div key={i} className={styles.triedItem}>
                  <span aria-hidden="true">✕</span>
                  <span>{t.label} — {t.reason}</span>
                </div>
              ))}
            </div>
          )}

          {showManualPaste && (
            <>
              <span className={styles.manualLabel}>
                Automatic import didn’t work. Paste the tab text below to save it manually.
              </span>
              <input
                className={styles.modalInput}
                type="text"
                placeholder="Artist"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
              />
              <input
                className={styles.modalInput}
                type="text"
                placeholder="Song"
                value={manualSong}
                onChange={(e) => setManualSong(e.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder="Paste tab / chords text here"
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
              />
            </>
          )}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnCancel} onClick={handleCancel}>Cancel</button>
          {showManualPaste ? (
            <button className={styles.btnDownload} onClick={handleManualSave} disabled={!manualContent.trim()}>
              Save tab
            </button>
          ) : (
            <button className={styles.btnDownload} onClick={handleSubmitUrl} disabled={!urlValue.trim() || isDownloading}>
              {isDownloading ? 'Importing…' : 'Download'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )

  const deleteConfirmModal = pathToConfirmDelete !== null && createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) handleCancelDelete() }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Delete tab</span>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            <strong>{getSongDisplayName(pathToConfirmDelete)}</strong> will be permanently deleted from disk.
          </p>
          <span className={styles.modalHint}>This action cannot be undone.</span>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnCancel} onClick={handleCancelDelete}>Cancel</button>
          <button
            className={styles.btnDanger}
            onClick={handleConfirmDelete}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleConfirmDelete() }
              if (e.key === 'Escape') handleCancelDelete()
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <ul className={styles.container} data-collapsed={!isMenuExtended} {...props}>
        <li key="logo">
          <button className={styles.logoButton} onClick={() => setActiveView('tab')} aria-label="Back to tab view">
            <LogoIcon /> <span className={styles.logoText}>KLANK</span>
          </button>
        </li>
        <Toolbar
          setNeedsUpdate={setNeedsUpdate}
          setTabPath={handleSelectSong}
          tree={tree}
          onRequestCreatePlaylist={isMobile ? undefined : handleRequestCreatePlaylist}
          onRequestDownload={isMobile ? undefined : handleRequestDownload}
          isDownloading={isDownloading}
          downloadError={downloadError}
          onSettingsClick={() => {
            setActiveView(activeView === 'settings' ? 'tab' : 'settings')
            if (isMobile) toggleMenu(false)
          }}
          onHarmonyClick={() => {
            setActiveView(activeView === 'harmony' ? 'tab' : 'harmony')
            if (isMobile) toggleMenu(false)
          }}
          isSettingsActive={activeView === 'settings'}
          isHarmonyActive={activeView === 'harmony'}
          isCollapsed={!isMenuExtended}
          hideGoToTab={isMobile}
        />
        {!isMobile && isMenuExtended && (
          <>
            <PlaylistSection tree={tree} currentTabPath={currentTabPath} />
            <div className={styles.treeWrapper}>
              <FileTreeView
                currentTabPath={currentTabPath}
                setTabPath={handleSelectSong}
                searchFilter={searchFilter}
                songSort={songSort}
                playMetricByPath={playMetricByPath}
                tree={tree}
                onAddToPlaylist={activePlaylist ? (path) => addTabToPlaylist(activePlaylist.id, path) : undefined}
                activePlaylistPaths={activePlaylist?.paths}
                onDeleteTab={(path) => setPathToConfirmDelete(path)}
                onEditTab={(path) => { handleSelectSong(path); useKlankStore.getState().setMode('Edit') }}
              />
            </div>
          </>
        )}
        <Searchbar
          toggleMenu={toggleMenu}
          isMenuExtended={isMenuExtended}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          songSort={songSort}
          onToggleSort={toggleSongSort}
        />
      </ul>
      {createPlaylistModal}
      {downloadModal}
      {deleteConfirmModal}
      {deleteError !== null && createPortal(
        <div className={styles.toastError}>{deleteError}</div>,
        document.body
      )}
      {isMobile && isMenuExtended && createPortal(
        <div className={styles.mobileDrawer}>
          <div
            className={styles.mobileDrawerBackdrop}
            onClick={() => toggleMenu(false)}
          />
          <div className={styles.mobileDrawerSheet}>
            <div className={styles.mobileDrawerActions}>
              {/* Utility — act on tree state, keep drawer open */}
              <div className={styles.mobileDrawerActionsGroup}>
                <ToolTip message="Go to Tab">
                  <Button
                    iconButton
                    icon={<TargetIcon />}
                    aria-label="Go to current tab"
                    onClick={() => document.getElementById('active')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  />
                </ToolTip>
              </div>
              {/* Creation / navigation — may close drawer or open a modal */}
              <div className={styles.mobileDrawerActionsGroup}>
                <ToolTip message="Go to Random Tab">
                  <Button
                    iconButton
                    icon={<ShuffleIcon />}
                    aria-label="Go to random tab"
                    onClick={() => {
                      if (!tree.length) return
                      const randomItem = tree[Math.floor(Math.random() * tree.length)]
                      handleSelectSong(randomItem.path)
                      toggleMenu(false)
                    }}
                  />
                </ToolTip>
                <ToolTip message="New Playlist">
                  <Button
                    iconButton
                    icon={<NewPlaylistIcon />}
                    aria-label="New playlist"
                    onClick={handleRequestCreatePlaylist}
                  />
                </ToolTip>
                <ToolTip message="Download Tab">
                  <Button
                    iconButton
                    icon={<DownloadIcon />}
                    aria-label="Download tab"
                    onClick={handleRequestDownload}
                  />
                </ToolTip>
              </div>
            </div>
            <div className={styles.mobileDrawerPlaylist}>
              <PlaylistSection tree={tree} currentTabPath={currentTabPath} />
            </div>
            <div className={styles.mobileDrawerContent}>
              <div className={styles.treeWrapper}>
                <FileTreeView
                  currentTabPath={currentTabPath}
                  setTabPath={handleSelectSong}
                  searchFilter={searchFilter}
                  songSort={songSort}
                  playMetricByPath={playMetricByPath}
                  tree={tree}
                  onAddToPlaylist={activePlaylist ? (path) => addTabToPlaylist(activePlaylist.id, path) : undefined}
                  activePlaylistPaths={activePlaylist?.paths}
                  onDeleteTab={(path) => setPathToConfirmDelete(path)}
                  onEditTab={(path) => { handleSelectSong(path); useKlankStore.getState().setMode('Edit'); toggleMenu(false) }}
                />
              </div>
            </div>
            <div className={styles.mobileDrawerSearch}>
              <Searchbar
                inDrawer
                toggleMenu={toggleMenu}
                isMenuExtended={isMenuExtended}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                songSort={songSort}
                onToggleSort={toggleSongSort}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
