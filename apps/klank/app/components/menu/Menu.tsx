import styles from './menu.module.css'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { FileEntry } from '@klank/platform-api'
import {
  ChevronIcon,
  FileIcon,
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

const Menu: React.FC<MenuProps> = ({ tree, setNeedsUpdate, ...props }) => {
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const toggleMenu = useKlankStore().toggleMenu
  const currentTabPath = useKlankStore().tab.path
  const setTabPath = useKlankStore().setTabPath
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const fileService = useKlankStore().fileService
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [treeSortOption, setTreeSortOption] = useState<'default' | 'artist'>(
    'artist'
  )
  const handleFilePathUpdate = (path: string) => {
    console.log(tree)
  }

  return (
    <ul className={styles.container} {...props}>
      <li key="logo">
        <LogoIcon /> KLANK
      </li>
      <Toolbar
        getDirectoryPath={fileService?.getDirectoryPath}
        setNeedsUpdate={setNeedsUpdate}
        setBaseDirectory={setBaseDirectory}
      />
      <FileTreeView
        currentTabPath={currentTabPath}
        setTabPath={setTabPath}
        searchFilter={searchFilter}
        tree={tree}
      />
      <Searchbar
        toggleMenu={toggleMenu}
        isMenuExtended={isMenuExtended}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
      />
    </ul>
  )
}

export default Menu
