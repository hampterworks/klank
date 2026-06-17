import React, { useEffect, useRef, useState } from 'react'
import styles from './player.module.css'
import { Sheet, SheetToolbar, EditIcon, CloseIcon } from '@klank/ui'
import { useKlankStore } from '@klank/store'
import { createJamHost, type JamHost, type JamSnapshot } from '@klank/platform-api'

type PlayerProps = {} & React.ComponentPropsWithRef<'section'>

export const Player: React.FC<PlayerProps> = ({ ...props }) => {
  const setTabFontSize = useKlankStore().setTabFontSize
  const fontSize = useKlankStore().tab.fontSize
  const transpose = useKlankStore().tab.transpose
  const setTabTranspose = useKlankStore().setTabTranspose
  const setTabScrollSpeed = useKlankStore().setTabScrollSpeed
  const tabScrollSpeed = useKlankStore().tab.scrollSpeed
  const isScrolling = useKlankStore().tab.isScrolling
  const setTabIsScrolling = useKlankStore().setTabIsScrolling
  const tabPath = useKlankStore().tab.path
  const fileService = useKlankStore().fileService
  const playlists = useKlankStore().playlists
  const activePlaylistId = useKlankStore().activePlaylistId
  const activePlaylistIndex = useKlankStore().activePlaylistIndex
  const nextInPlaylist = useKlankStore().nextInPlaylist
  const prevInPlaylist = useKlankStore().prevInPlaylist
  const mode = useKlankStore().mode
  const setMode = useKlankStore().setMode
  const instrument = useKlankStore().instrument

  // Jam state
  const jamRole = useKlankStore((s) => s.jam.role)
  const jamSnapshot = useKlankStore((s) => s.jam.snapshot)
  const jamHostAddress = useKlankStore((s) => s.jam.hostAddress)
  const jamClients = useKlankStore((s) => s.jam.clients)
  const jamConnected = useKlankStore((s) => s.jam.connected)

  const [tabData, setTabData] = useState<string | undefined>()
  const [editedContent, setEditedContent] = useState<string>('')
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 599
  )

  // Latest scroll fraction from Sheet — kept in a ref so broadcast doesn't
  // need to re-subscribe every time the fraction changes.
  const scrollFractionRef = useRef<number>(0)

  // JamHost instance — created once when the component mounts; the host
  // server is started/stopped from Settings, here we only use `.broadcast`.
  const jamHostRef = useRef<JamHost | null>(null)

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId)
  const playlistNav = activePlaylist && activePlaylistIndex !== null ? {
    current: activePlaylistIndex + 1,
    total: activePlaylist.paths.length,
    onPrev: prevInPlaylist,
    onNext: nextInPlaylist,
  } : undefined

  // Song name derived the same way the toolbar does.
  const songName = tabPath?.split(/[/\\]/)?.slice(-1)[0]?.slice(0, -8) ?? ''

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 599)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!fileService?.readTabFile) return
    fileService.readTabFile(tabPath).then((data) => {
      setTabData(data)
      setEditedContent(data)
    })
  }, [tabPath, fileService])

  // Acquire (or reuse) the JamHost instance when entering host mode.
  useEffect(() => {
    if (jamRole !== 'host') return
    if (jamHostRef.current) return
    createJamHost().then((host) => { jamHostRef.current = host })
  }, [jamRole])

  // Broadcast a snapshot whenever tab content or settings change (host only).
  useEffect(() => {
    if (jamRole !== 'host' || !jamHostRef.current) return
    const snapshot: JamSnapshot = {
      v: 1,
      name: songName,
      content: tabData ?? '',
      transpose,
      fontSize,
      scrollSpeed: tabScrollSpeed,
      scrolling: isScrolling,
      fraction: scrollFractionRef.current,
    }
    jamHostRef.current.broadcast(snapshot)
  }, [jamRole, tabData, transpose, fontSize, tabScrollSpeed, isScrolling, songName])

  const handleEditToggle = async () => {
    if (mode === 'Edit') {
      if (fileService?.writeTabFile && tabPath) {
        const segments = tabPath.split(/[/\\]/)
        const filename = segments[segments.length - 1]
        const target = segments.slice(0, -1).join('/')
        await fileService.writeTabFile(filename, target, editedContent)
        setTabData(editedContent)
      }
      setMode('Read')
    } else {
      setMode('Edit')
    }
  }

  // Discard unsaved edits and leave edit mode without writing to disk.
  const handleEditCancel = () => {
    setEditedContent(tabData ?? '')
    setMode('Read')
  }

  // Callback passed to Sheet when hosting — updates the ref and broadcasts.
  const handleScrollFraction = (fraction: number) => {
    scrollFractionRef.current = fraction
    if (!jamHostRef.current) return
    const snapshot: JamSnapshot = {
      v: 1,
      name: songName,
      content: tabData ?? '',
      transpose,
      fontSize,
      scrollSpeed: tabScrollSpeed,
      scrolling: isScrolling,
      fraction,
    }
    jamHostRef.current.broadcast(snapshot)
  }

  // ── Guest render ──────────────────────────────────────────────────────────
  if (jamRole === 'guest') {
    const snap = jamSnapshot
    return (
      <section className={styles.container} {...props}>
        <div className={styles.guestHeader}>
          <span className={styles.guestLabel}>
            {snap?.name ? snap.name : 'Jam'}
          </span>
          <span className={styles.guestStatus}>
            Following {jamHostAddress}
          </span>
          {jamConnected && jamClients > 0 && (
            <span className={styles.jamCount} title="People connected to this jam">
              ● {jamClients} connected
            </span>
          )}
        </div>
        <Sheet
          tabScrollSpeed={snap?.scrollSpeed ?? 1}
          isScrolling={snap?.scrolling ?? false}
          setTabIsScrolling={() => { /* guests don't own playback */ }}
          tabData={snap?.content ?? ''}
          transpose={snap?.transpose ?? 0}
          instrument={instrument}
          isMobile={isMobile}
          scrollFraction={snap?.fraction ?? 0}
          style={{ fontSize: `${snap?.fontSize ?? 12}px` }}
        />
      </section>
    )
  }

  // ── Normal (off) + host render ─────────────────────────────────────────────
  // When hosting the UI is identical; the only addition is onScrollFraction.
  return (
    <section className={styles.container} {...props}>
      {mode === 'Edit' && (
        <div className={styles.floatingActions}>
          <button className={styles.floatingCancel} onClick={handleEditCancel} aria-label="Cancel">
            <CloseIcon />
            <span>Cancel</span>
          </button>
          <button className={styles.floatingSave} onClick={handleEditToggle} aria-label="Save">
            <EditIcon />
            <span>Save</span>
          </button>
        </div>
      )}
      <SheetToolbar
        fontSize={fontSize}
        songName={songName}
        transpose={transpose}
        tabScrollSpeed={tabScrollSpeed}
        isScrolling={isScrolling}
        mode={mode}
        setTabFontSize={setTabFontSize}
        setTabTranspose={setTabTranspose}
        setTabScrollSpeed={setTabScrollSpeed}
        setTabIsScrolling={setTabIsScrolling}
        onEditToggle={handleEditToggle}
        playlist={playlistNav}
      />
      {mode === 'Edit' ? (
        <textarea
          className={styles.editTextarea}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          style={{ fontSize: `${fontSize}px` }}
        />
      ) : (
        <Sheet
          tabScrollSpeed={tabScrollSpeed}
          isScrolling={isScrolling}
          setTabIsScrolling={setTabIsScrolling}
          tabData={tabData ?? ''}
          transpose={transpose}
          instrument={instrument}
          isMobile={isMobile}
          style={{ fontSize: `${fontSize}px` }}
          onScrollFraction={jamRole === 'host' ? handleScrollFraction : undefined}
        />
      )}
    </section>
  )
}
