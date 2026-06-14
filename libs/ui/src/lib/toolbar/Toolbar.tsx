import styles from './toolbar.module.css'
import * as React from 'react'
import {
  Button,
  DownloadIcon,
  FolderIcon,
  NewPlaylistIcon,
  RefreshIcon,
  SettingsIcon,
  ShuffleIcon,
  TargetIcon,
  ToolTip,
} from '../../index'

const goToActiveTab = () => {
  const activeElement = document.getElementById('active')

  if (activeElement) {
    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

type TreeEntry = { path: string }

type ToolbarProps = {
  getDirectoryPath?: () => Promise<string | null>
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
  setBaseDirectory: (directory: string) => void
  setTabPath: (path: string) => void
  onRequestDownload?: () => void
  onRequestCreatePlaylist?: () => void
  isDownloading?: boolean
  downloadError?: string | null
  onSettingsClick?: () => void
  tree: TreeEntry[]
  isCollapsed?: boolean
  /** When true the "Go to Tab" button is hidden (it lives in the mobile drawer instead). */
  hideGoToTab?: boolean
  /** When true the Refresh button is hidden (it lives in the mobile drawer instead). */
  hideRefresh?: boolean
} & React.ComponentPropsWithRef<'li'>

export const Toolbar: React.FC<ToolbarProps> = ({
  setBaseDirectory,
  getDirectoryPath,
  setNeedsUpdate,
  setTabPath,
  onRequestDownload,
  onRequestCreatePlaylist,
  isDownloading,
  downloadError,
  onSettingsClick,
  tree,
  isCollapsed,
  hideGoToTab,
  hideRefresh,
  ...props
}) => {
  const handleBaseDirectoryChange = () => {
    if (getDirectoryPath)
      getDirectoryPath()
        .then((path) => path !== null && setBaseDirectory(path))
        .catch((error) => console.error('Folder picker failed:', error))
  }

  const handleRandomPathUpdate = () => {
    if (!tree.length) return
    const randomItem = tree[Math.floor(Math.random() * tree.length)]
    setTabPath(randomItem.path)
  }

  return (
    <li className={`${styles.container}${isCollapsed ? ' ' + styles.collapsed : ''}`} {...props}>
      {getDirectoryPath && (
        <ToolTip message="Change Folder">
          <Button
            onClick={() => handleBaseDirectoryChange()}
            iconButton={true}
            icon={<FolderIcon />}
          />
        </ToolTip>
      )}
      {!hideRefresh && (
        <ToolTip message="Refresh">
          <Button
            onClick={() => setNeedsUpdate(true)}
            iconButton={true}
            icon={<RefreshIcon />}
          />
        </ToolTip>
      )}
      <ToolTip message="Settings">
        <Button iconButton={true} icon={<SettingsIcon />} onClick={onSettingsClick} />
      </ToolTip>
      {!hideGoToTab && (
        <ToolTip message="Go to Tab">
          <Button
            onClick={() => goToActiveTab()}
            iconButton={true}
            icon={<TargetIcon />}
          />
        </ToolTip>
      )}
      <ToolTip message="Go to Random Tab">
        <Button
          onClick={() => handleRandomPathUpdate()}
          iconButton={true}
          icon={<ShuffleIcon />}
        />
      </ToolTip>
      {onRequestCreatePlaylist && (
        <ToolTip message="New Playlist">
          <Button
            onClick={() => onRequestCreatePlaylist()}
            iconButton={true}
            icon={<NewPlaylistIcon />}
          />
        </ToolTip>
      )}
      {downloadError && (
        <span className={styles.downloadError} title={downloadError}>
          Error
        </span>
      )}
      {onRequestDownload && (
        <ToolTip message={isDownloading ? 'Downloading…' : 'Download Tab'}>
          <Button
            onClick={() => onRequestDownload()}
            iconButton={true}
            disabled={isDownloading}
            icon={
              isDownloading
                ? <span className={styles.spinner}><RefreshIcon /></span>
                : <DownloadIcon />
            }
          />
        </ToolTip>
      )}
    </li>
  )
}
