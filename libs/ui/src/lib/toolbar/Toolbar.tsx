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
      <ToolTip message="something">
        <Button iconButton={true} icon={<TargetIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<ShuffleIcon />} />
      </ToolTip>
      <ToolTip message="something">
        <Button iconButton={true} icon={<DownloadIcon />} />
      </ToolTip>
    </li>
  )
}

export default Toolbar
