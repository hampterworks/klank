import styles from './toolbar.module.css'
import * as React from 'react'
import {
  Button,
  DownloadIcon,
  NewPlaylistIcon,
  RefreshIcon,
  ScalesIcon,
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
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
  setTabPath: (path: string) => void
  onRequestDownload?: () => void
  onRequestCreatePlaylist?: () => void
  isDownloading?: boolean
  downloadError?: string | null
  onSettingsClick?: () => void
  onHarmonyClick?: () => void
  tree: TreeEntry[]
  isCollapsed?: boolean
  /** When true the "Go to Tab" button is hidden (it lives in the mobile drawer instead). */
  hideGoToTab?: boolean
} & React.ComponentPropsWithRef<'li'>

export const Toolbar: React.FC<ToolbarProps> = ({
  setNeedsUpdate,
  setTabPath,
  onRequestDownload,
  onRequestCreatePlaylist,
  isDownloading,
  downloadError,
  onSettingsClick,
  onHarmonyClick,
  tree,
  isCollapsed,
  hideGoToTab,
  ...props
}) => {
  const handleRandomPathUpdate = () => {
    if (!tree.length) return
    const randomItem = tree[Math.floor(Math.random() * tree.length)]
    setTabPath(randomItem.path)
  }

  return (
    <li className={`${styles.container}${isCollapsed ? ' ' + styles.collapsed : ''}`} {...props}>
      <ToolTip message="Settings">
        <Button iconButton={true} icon={<SettingsIcon />} onClick={onSettingsClick} />
      </ToolTip>
      {onHarmonyClick && (
        <ToolTip message="Scales & Chords">
          <Button iconButton={true} icon={<ScalesIcon />} onClick={onHarmonyClick} />
        </ToolTip>
      )}
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
