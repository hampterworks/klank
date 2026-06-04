import styles from './menu.module.css'
import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FileEntry, getSheetFromUG } from '@klank/platform-api'
import {
  FileTreeView,
  LogoIcon,
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
  const [searchFilter, setSearchFilter] = useState<string>('')

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null

  // Navigating from the file tree / shuffle exits playlist navigation (hides ◁/▷)
  // but keeps the selected playlist so + buttons remain visible.
  const handleSelectSong = (path: string) => {
    useKlankStore.setState((s) => ({ ...s, activePlaylistIndex: null }))
    setTabPath(path)
  }

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
        setTabPath={handleSelectSong}
        tree={tree}
        onDownloadTab={handleDownloadTab}
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
  )
}
