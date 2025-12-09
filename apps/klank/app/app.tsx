import styles from './app.module.css'
import { useKlankStore } from '@klank/store'
import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  createFileService,
  FileEntry,
  mapTreeStructure,
} from '@klank/platform-api'
import Menu from './components/menu/Menu'
import Player from './components/player/Player'

export function App() {
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const serverMode = useKlankStore().serverMode
  const setServerMode = useKlankStore().setServerMode
  const toggleMenu = useKlankStore().toggleMenu
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const fileService = useKlankStore().fileService
  const setFileService = useKlankStore().setFileService
  const [tree, setTree] = useState<FileEntry[]>()
  const [needsUpdate, setNeedsUpdate] = useState(false)


  useEffect(() => {
    setServerMode(!isTauri)
  }, [isTauri, setServerMode])

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const fileService = await createFileService(serverMode ? 'server' : 'tauri')
        setFileService(fileService)

        // Get base directory if not set
        if (!baseDirectory && fileService?.getBaseDirectoryPath) {
          const folder = await fileService.getBaseDirectoryPath()
          setBaseDirectory(folder)
          return
        }

        // Load directory contents
        if (baseDirectory && fileService?.readDirectoryRecursively) {
          const data = await fileService.readDirectoryRecursively(
            baseDirectory,
            file => file.isDirectory || file.name.endsWith(".tab.txt")
          )
          setTree(mapTreeStructure(data ?? []))
        }

      } catch (error) {
        console.error('Failed to initialize app:', error)
      }
    }

    initializeApp()
  }, [baseDirectory, serverMode, setBaseDirectory, setFileService])

  useEffect(() => {
    if (needsUpdate && baseDirectory) {
      fileService
        ?.readDirectoryRecursively(
          baseDirectory,
          (file) => file.isDirectory || file.name.endsWith('.tab.txt')
        )
        .then((data) => {
          setTree(mapTreeStructure(data ?? []))
          setNeedsUpdate(false)
        })
    }
  }, [needsUpdate, baseDirectory, fileService])

  return (
    <main
      className={styles.container}
      style={{
        '--menu-extended': isMenuExtended ? 'true' : 'false'
      } as React.CSSProperties}
    >
      <nav>
        <Menu tree={tree ?? []} setNeedsUpdate={setNeedsUpdate}/>
      </nav>
      <Player/>
    </main>
  );
}

export default App;
