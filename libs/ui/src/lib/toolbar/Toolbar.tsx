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
import { getSheetFromUG } from '@klank/platform-api'

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
} & React.ComponentPropsWithRef<'li'>

const Toolbar: React.FC<ToolbarProps> = ({
  setBaseDirectory,
  getDirectoryPath,
  setNeedsUpdate,
  ...props
}) => {
  const handleBaseDirectoryChange = () => {
    if (getDirectoryPath)
      getDirectoryPath().then((path) => path !== null && setBaseDirectory(path))
  }

  const handleRefresh = () => {
    setNeedsUpdate(true)
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
        <Button iconButton={true} icon={<ThemeIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<SettingsIcon />} />
      </ToolTip>
      <ToolTip message="Go to Tab">
        <Button onClick={() => goToActiveTab()} iconButton={true} icon={<TargetIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<ShuffleIcon />} />
      </ToolTip>
      <ToolTip message="Download Tab">
        <Button onClick={() => getSheetFromUG('https://tabs.ultimate-guitar.com/tab/goo-goo-dolls/iris-chords-54512')} iconButton={true} icon={<DownloadIcon />} />
      </ToolTip>
    </li>
  )
}

export default Toolbar
