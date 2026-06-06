import styles from './menu.module.css'
import * as React from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { FileEntry, getSheetFromUG } from '@klank/platform-api'
import {
  DownloadIcon,
  FileTreeView,
  LogoIcon,
  NewPlaylistIcon,
  Searchbar,
  Toolbar,
} from '@klank/ui'
import { useKlankStore } from '@klank/store'
import { PlaylistSection } from './PlaylistSection'

type MenuProps = {
  tree: FileEntry[]
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
} & React.ComponentPropsWithRef<'ul'>

export const Menu: React.FC<MenuProps> = ({ tree, setNeedsUpdate, ...props }) => {
  const navigate = useNavigate()
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const toggleMenu = useKlankStore().toggleMenu
  const currentTabPath = useKlankStore().tab.path
  const setTabPath = useKlankStore().setTabPath
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const fileService = useKlankStore().fileService
  const activePlaylistId = useKlankStore().activePlaylistId
  const playlists = useKlankStore().playlists
  const addTabToPlaylist = useKlankStore().addTabToPlaylist
  const createPlaylist = useKlankStore().createPlaylist
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [isEnteringUrl, setIsEnteringUrl] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null

  const handleSelectSong = (path: string) => {
    useKlankStore.setState((s) => ({ ...s, activePlaylistIndex: null }))
    setTabPath(path)
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

  const handleRequestDownload = () => {
    setUrlValue('')
    setIsEnteringUrl(true)
  }

  const handleCancel = () => {
    setIsEnteringUrl(false)
  }

  const handleSubmitUrl = async () => {
    const trimmed = urlValue.trim()
    setIsEnteringUrl(false)
    if (!trimmed) return
    setIsDownloading(true)
    setDownloadError(null)
    try {
      const sheet = await getSheetFromUG(trimmed)
      if (!sheet || !fileService) return
      const writtenPath = await fileService.writeTabFile(
        sheet.filename,
        baseDirectory ?? '',
        sheet.data
      )
      if (writtenPath) setTabPath(writtenPath)
      setNeedsUpdate(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed'
      setDownloadError(message)
      setTimeout(() => setDownloadError(null), 4000)
    } finally {
      setIsDownloading(false)
    }
  }

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
            autoFocus
          />
          <span className={styles.modalHint}>Paste an Ultimate Guitar tab URL and press Download</span>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnCancel} onClick={handleCancel}>Cancel</button>
          <button className={styles.btnDownload} onClick={handleSubmitUrl} disabled={!urlValue.trim()}>Download</button>
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <ul className={styles.container} data-collapsed={!isMenuExtended} {...props}>
        <li key="logo">
          <LogoIcon /> <span className={styles.logoText}>KLANK</span>
        </li>
        <Toolbar
          getDirectoryPath={fileService?.getDirectoryPath}
          setNeedsUpdate={setNeedsUpdate}
          setBaseDirectory={setBaseDirectory}
          setTabPath={handleSelectSong}
          tree={tree}
          onRequestCreatePlaylist={handleRequestCreatePlaylist}
          onRequestDownload={handleRequestDownload}
          isDownloading={isDownloading}
          downloadError={downloadError}
          onSettingsClick={() => navigate('/settings')}
          isCollapsed={!isMenuExtended}
        />
        {isMenuExtended && (
          <>
            <PlaylistSection tree={tree} currentTabPath={currentTabPath} />
            <div className={styles.treeWrapper}>
              <FileTreeView
                currentTabPath={currentTabPath}
                setTabPath={handleSelectSong}
                searchFilter={searchFilter}
                tree={tree}
                onAddToPlaylist={activePlaylist ? (path) => addTabToPlaylist(activePlaylist.id, path) : undefined}
                activePlaylistPaths={activePlaylist?.paths}
              />
            </div>
          </>
        )}
        <Searchbar
          toggleMenu={toggleMenu}
          isMenuExtended={isMenuExtended}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
        />
      </ul>
      {createPlaylistModal}
      {downloadModal}
    </>
  )
}
