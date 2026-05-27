import styles from './toolbar.module.css'
import * as React from 'react'
import {
  Button,
  DownloadIcon,
  FolderIcon,
  RefreshIcon,
  SettingsIcon,
  ShuffleIcon,
  TargetIcon,
  ThemeIcon,
  ToolTip,
} from '../../index'
import { FileEntry, FileService, getSheetFromUG } from '@klank/platform-api'

const goToActiveTab = () => {
  const activeElement = document.getElementById('active')

  if (activeElement) {
    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

type ToolbarProps = {
  getDirectoryPath?: () => Promise<string | null>
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
  setBaseDirectory: (directory: string) => void
  baseDirectory?: string
  fileService?: FileService
  setTabPath: (path: string) => void
  handleRandomPathUpdate?: () => void
  tree: FileEntry[]
} & React.ComponentPropsWithRef<'li'>

const Toolbar: React.FC<ToolbarProps> = ({
  setBaseDirectory,
  getDirectoryPath,
  setNeedsUpdate,
  baseDirectory,
  fileService,
  setTabPath,
  tree,
  ...props
}) => {
  const handleBaseDirectoryChange = () => {
    if (getDirectoryPath)
      getDirectoryPath().then((path) => path !== null && setBaseDirectory(path))
  }

  const handleRefresh = () => {
    setNeedsUpdate(true)
  }

  const handleDownloadTab = async () => {
    const tabUrl = window.prompt('Enter Ultimate Guitar URL')
    if (!tabUrl) return
    const sheet = await getSheetFromUG(tabUrl)

    const writtenPath = await fileService?.writeTabFile(
      sheet?.filename ?? '',
      baseDirectory ?? '',
      sheet?.data ?? ''
    )
    if (writtenPath) setTabPath(writtenPath)
    handleRefresh()
  }

  const handleRandomPathUpdate = () => {
    if (!tree.length) return
    const randomItem = tree[Math.floor(Math.random() * tree.length)]
    setTabPath(randomItem.path)
  }

  return (
    <li className={styles.container} {...props}>
      <ToolTip message="Change Folder">
        <Button
          onClick={() => handleBaseDirectoryChange()}
          iconButton={true}
          icon={<FolderIcon />}
        />
      </ToolTip>
      <ToolTip message="Refresh">
        <Button
          onClick={() => handleRefresh()}
          iconButton={true}
          icon={<RefreshIcon />}
        />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<SettingsIcon />} />
      </ToolTip>
      <ToolTip message="Go to Tab">
        <Button
          onClick={() => goToActiveTab()}
          iconButton={true}
          icon={<TargetIcon />}
        />
      </ToolTip>
      <ToolTip message="Go to Random Tab">
        <Button
          onClick={() => handleRandomPathUpdate()}
          iconButton={true}
          icon={<ShuffleIcon />} />
      </ToolTip>
      <ToolTip message="Download Tab">
        <Button
          onClick={() => handleDownloadTab()}
          iconButton={true}
          icon={<DownloadIcon />}
        />
      </ToolTip>
    </li>
  )
}

export default Toolbar
