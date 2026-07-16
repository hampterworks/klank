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
import { useGitSync } from './useGitSync'
import { useJam } from './useJam'
import { SettingsPanel } from './routes/settings'
import { HarmonyPanel } from './routes/harmony'

const MIN_WIDTH = 160
const MAX_WIDTH = 800

export function App() {
  const activeView = useKlankStore().activeView
  const isMenuExtended = useKlankStore().ui.isMenuExtended
  const menuWidth = useKlankStore().ui.menuWidth
  const toggleMenu = useKlankStore().toggleMenu
  const setMenuState = useKlankStore().setMenuState
  const serverMode = useKlankStore().serverMode
  const setServerMode = useKlankStore().setServerMode
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const fileService = useKlankStore().fileService
  const setFileService = useKlankStore().setFileService
  const setTabSettings = useKlankStore().setTabSettings
  const setPlaylists = useKlankStore().setPlaylists
  const setPlayMetrics = useKlankStore().setPlayMetrics
  const [tree, setTree] = useState<FileEntry[]>()
  const [needsUpdate, setNeedsUpdate] = useState(false)
  const [backendUnreachable, setBackendUnreachable] = useState(false)
  const containerRef = useRef<HTMLElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  // Background git sync: refresh the file tree when a sync pulls remote changes.
  useGitSync(() => setNeedsUpdate(true))

  // Manage the guest WebSocket lifecycle for Jam mode.
  useJam()

  useEffect(() => {
    setServerMode(!isTauri)
  }, [isTauri, setServerMode])

  useEffect(() => {
    // Guards against a slower run for a previous directory resolving after a
    // newer one (e.g. the user changes folders quickly) and overwriting state.
    let cancelled = false

    const initializeApp = async () => {
      try {
        const service = await createFileService()
        if (cancelled) return
        // Tauri's service is always usable; in server mode only expose it once
        // the backend has answered, so file-driven UI stays disabled when the
        // API is unreachable (see backendUnreachable below).
        if (!serverMode) setFileService(service)

        // Server mode may have a stale desktop baseDirectory persisted from
        // another machine, so ignore it and always resolve the server root.
        let dir = serverMode ? undefined : baseDirectory
        if (!dir) {
          dir = await service.getBaseDirectoryPath()
          if (cancelled) return
          if (dir !== baseDirectory) {
            setBaseDirectory(dir)
            return // re-triggers effect once baseDirectory is in state
          }
        }

        // Load per-tab settings and playlists from the tab directory, then load the tree
        const savedSettings = await service.readTabSettings(dir)
        if (cancelled) return
        setTabSettings(savedSettings)

        const savedPlaylists = await service.readPlaylists(dir)
        if (cancelled) return
        setPlaylists(savedPlaylists)

        const savedPlayMetrics = await service.readPlayMetrics(dir)
        if (cancelled) return
        setPlayMetrics(savedPlayMetrics)

        const data = await service.readDirectoryRecursively(
          dir,
          file => file.isDirectory || file.name.endsWith('.tab.txt')
        )
        if (cancelled) return
        setTree(mapTreeStructure(data ?? []))
        if (serverMode) setFileService(service)
        setBackendUnreachable(false)
      } catch (error) {
        console.error('Failed to initialize app:', error)
        // In server mode a rejection means no backend is answering /api.
        if (serverMode) setBackendUnreachable(true)
      }
    }

    // serverMode starts undefined; the effect above resolves it from isTauri.
    // Initialize in both modes once resolved — createFileService() returns the
    // right (Tauri or HTTP) implementation for us.
    if (serverMode !== undefined) initializeApp()
    return () => { cancelled = true }
  }, [baseDirectory, serverMode, setBaseDirectory, setFileService, setTabSettings, setPlaylists, setPlayMetrics])

  // Keep a ref so the ResizeObserver callback always reads the latest value
  // without needing isMenuExtended in the effect's dependency array.
  // If isMenuExtended were in deps, the effect would re-run every time the
  // menu opens, the fresh ResizeObserver would fire immediately on .observe(),
  // and it would close the menu before the drawer ever paints on mobile.
  const isMenuExtendedRef = useRef(isMenuExtended)
  isMenuExtendedRef.current = isMenuExtended

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === 0) return
      if (entry.contentRect.width < 600 && isMenuExtendedRef.current) {
        toggleMenu(false)
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [toggleMenu])

  useEffect(() => {
    if (needsUpdate && baseDirectory) {
      fileService
        ?.readDirectoryRecursively(
          baseDirectory,
          (file) => file.isDirectory || file.name.endsWith('.tab.txt')
        )
        .then((data) => {
          setTree(mapTreeStructure(data ?? []))
        })
        .catch((error) => {
          console.error('Failed to refresh file tree:', error)
        })
        // Always clear the flag so a later refresh click re-triggers the effect
        .finally(() => setNeedsUpdate(false))
    }
  }, [needsUpdate, baseDirectory, fileService])

  // Pointer events unify mouse, touch, and pen so the same drag-to-resize works
  // on desktop and on touch devices (tablets, fold phones) where the handle is
  // still shown. touch-action:none on the handle (see CSS) stops the browser
  // from hijacking the drag as a scroll/pan gesture.
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const container = containerRef.current
    const handle = handleRef.current
    if (!container || !handle) return

    // Keep delivering pointer events to the handle even if the finger/cursor
    // strays off it mid-drag.
    handle.setPointerCapture(e.pointerId)
    container.classList.add(styles.resizing)

    let finalWidth = isMenuExtended ? menuWidth : 52

    const onMove = (e: PointerEvent) => {
      const w = Math.min(MAX_WIDTH, Math.max(0, e.clientX))
      finalWidth = w
      const displayWidth = w < MIN_WIDTH ? 52 : w
      container.style.gridTemplateColumns = `${displayWidth}px 1fr`
      handle.style.left = `${displayWidth - 4}px`
      // Only blur nav when below the collapse threshold (menu about to snap
      // closed). Normal width adjustments above the threshold stay unblurred.
      if (w < MIN_WIDTH) {
        container.classList.add(styles.collapsing)
      } else {
        container.classList.remove(styles.collapsing)
      }
    }

    const onUp = () => {
      // Set inline style to the final value before re-enabling CSS transitions
      // (removing .resizing). Without this, the transition animates from the
      // drag position to the React-controlled value, squishing content.
      const finalDisplay = finalWidth < MIN_WIDTH ? 52 : finalWidth
      container.style.gridTemplateColumns = `${finalDisplay}px 1fr`
      handle.style.left = `${finalDisplay - 4}px`
      container.classList.remove(styles.collapsing)
      container.classList.remove(styles.resizing)
      if (finalWidth < MIN_WIDTH) {
        setMenuState(false)
      } else {
        setMenuState(true, finalWidth)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const currentWidth = isMenuExtended ? menuWidth : 52

  return (
    <main
      ref={containerRef}
      className={styles.container}
      style={{ gridTemplateColumns: `${currentWidth}px 1fr` }}
    >
      {serverMode && backendUnreachable && (
        <div className={styles.serverNotice} role="status">
          Server backend not reachable — file features are disabled.
        </div>
      )}
      <nav>
        <Menu tree={tree ?? []} setNeedsUpdate={setNeedsUpdate}/>
      </nav>
      <div
        ref={handleRef}
        className={styles.resizeHandle}
        style={{ left: currentWidth - 4 }}
        onPointerDown={handleResizeStart}
      />
      {activeView === 'settings' ? <SettingsPanel /> :
       activeView === 'harmony' ? <HarmonyPanel /> :
       <Player setNeedsUpdate={setNeedsUpdate} />}
    </main>
  );
}

// React Router route modules (registered in routes.tsx) require a default
// export for the route component — exception to the named-exports-only rule.
export default App;
