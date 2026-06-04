import styles from './menu.module.css'
import * as React from 'react'
import { useState } from 'react'
import { FileEntry, getSheetFromUG } from '@klank/platform-api'
import {
  FileTreeView,
  LogoIcon,
  Searchbar,
  Toolbar,
} from '@klank/ui'
import { useKlankStore } from '@klank/store'

type MenuProps = {
  tree: FileEntry[]
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
} & React.ComponentPropsWithRef<'ul'>

export const Menu: React.FC<MenuProps> = ({ tree, setNeedsUpdate, ...props }) => {
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const toggleMenu = useKlankStore().toggleMenu
  const currentTabPath = useKlankStore().tab.path
  const setTabPath = useKlankStore().setTabPath
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const fileService = useKlankStore().fileService
  const [searchFilter, setSearchFilter] = useState<string>('')

  const handleDownloadTab = async (url: string) => {
    const sheet = await getSheetFromUG(url)
    if (!sheet || !fileService) return
    const writtenPath = await fileService.writeTabFile(
      sheet.filename,
      baseDirectory ?? '',
      sheet.data
    )
    if (writtenPath) setTabPath(writtenPath)
    setNeedsUpdate(true)
  }

  return (
    <ul className={styles.container} data-collapsed={!isMenuExtended} {...props}>
      <li key="logo">
        <LogoIcon /> <span className={styles.logoText}>KLANK</span>
      </li>
      <Toolbar
        getDirectoryPath={fileService?.getDirectoryPath}
        setNeedsUpdate={setNeedsUpdate}
        setBaseDirectory={setBaseDirectory}
        setTabPath={setTabPath}
        tree={tree}
        onDownloadTab={handleDownloadTab}
        isCollapsed={!isMenuExtended}
      />
      {isMenuExtended && (
        <FileTreeView
          currentTabPath={currentTabPath}
          setTabPath={setTabPath}
          searchFilter={searchFilter}
          tree={tree}
        />
      )}
      <Searchbar
        toggleMenu={toggleMenu}
        isMenuExtended={isMenuExtended}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
      />
    </ul>
  )
}
