import styles from './menu.module.css'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { FileEntry, mapTreeByArtist } from '@klank/platform-api'
import { ChevronIcon, FileIcon, FileTreeView, LogoIcon, Searchbar, Toolbar } from '@klank/ui'
import { useKlankStore } from '@klank/store'

type MenuProps = {
  tree: FileEntry[]
} & React.ComponentPropsWithRef<'ul'>

const Menu: React.FC<MenuProps> = ({ tree, ...props }) => {
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const toggleMenu = useKlankStore().toggleMenu
  const currentTabPath = useKlankStore().tab.path
  const setTabPath = useKlankStore().setTabPath
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
      <Toolbar />
      <FileTreeView currentTabPath={currentTabPath} setTabPath={setTabPath} tree={tree}/>
      <Searchbar toggleMenu={toggleMenu} isMenuExtended={isMenuExtended}/>
    </ul>
  )
}

export default Menu
