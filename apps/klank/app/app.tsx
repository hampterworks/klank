import styles from './app.module.css'
import { useKlankStore } from '@klank/store'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  createFileService,
  FileEntry,
  mapTreeStructure,
} from '@klank/platform-api'
import { Menu } from './components/menu/Menu'
import { Player } from './components/player/Player'

const MIN_WIDTH = 160
const MAX_WIDTH = 800

export function App() {
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const menuWidth = useKlankStore().ui.menuWidth
  const toggleMenu = useKlankStore().toggleMenu
  const setMenuWidth = useKlankStore().setMenuWidth
  const serverMode = useKlankStore().serverMode
  const setServerMode = useKlankStore().setServerMode
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const fileService = useKlankStore().fileService
  const setFileService = useKlankStore().setFileService
  const setTabSettings = useKlankStore().setTabSettings
  const setPlaylists = useKlankStore().setPlaylists
  const [tree, setTree] = useState<FileEntry[]>()
  const [needsUpdate, setNeedsUpdate] = useState(false)
  const containerRef = useRef<HTMLElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setServerMode(!isTauri)
  }, [isTauri, setServerMode])

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const fileService = await createFileService()
        setFileService(fileService)

        // Get base directory if not set yet
        let dir = baseDirectory
        if (!dir) {
          dir = await fileService.getBaseDirectoryPath()
          setBaseDirectory(dir)
          return // re-triggers effect once baseDirectory is in state
        }

        // Load per-tab settings and playlists from the tab directory, then load the tree
        const savedSettings = await fileService.readTabSettings(dir)
        setTabSettings(savedSettings)

        const savedPlaylists = await fileService.readPlaylists(dir)
        setPlaylists(savedPlaylists)

        const data = await fileService.readDirectoryRecursively(
          dir,
          file => file.isDirectory || file.name.endsWith('.tab.txt')
        )
        setTree(mapTreeStructure(data ?? []))

      } catch (error) {
        console.error('Failed to initialize app:', error)
      }
    }

    initializeApp()
  }, [baseDirectory, serverMode, setBaseDirectory, setFileService, setTabSettings, setPlaylists])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === 0) return
      if (entry.contentRect.width < 600 && isMenuExtended) {
        toggleMenu(false)
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [isMenuExtended, toggleMenu])

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

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    const handle = handleRef.current
    if (!container || !handle) return

    container.classList.add(styles.resizing)

    let finalWidth = isMenuExtended ? menuWidth : 52

    const onMove = (e: MouseEvent) => {
      const w = Math.min(MAX_WIDTH, Math.max(0, e.clientX))
      finalWidth = w
      const displayWidth = w < MIN_WIDTH ? 52 : w
      container.style.gridTemplateColumns = `${displayWidth}px 1fr`
      handle.style.left = `${displayWidth - 4}px`
    }

    const onUp = () => {
      container.classList.remove(styles.resizing)
      if (finalWidth < MIN_WIDTH) {
        if (isMenuExtended) toggleMenu(false)
      } else {
        if (!isMenuExtended) toggleMenu(true)
        setMenuWidth(finalWidth)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const currentWidth = isMenuExtended ? menuWidth : 52

  return (
    <main
      ref={containerRef}
      className={styles.container}
      style={{ gridTemplateColumns: `${currentWidth}px 1fr` }}
    >
      <nav>
        <Menu tree={tree ?? []} setNeedsUpdate={setNeedsUpdate}/>
      </nav>
      <div
        ref={handleRef}
        className={styles.resizeHandle}
        style={{ left: currentWidth - 4 }}
        onMouseDown={handleResizeStart}
      />
      <Player/>
    </main>
  );
}

export default App;
