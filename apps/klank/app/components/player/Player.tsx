import React, { useEffect, useMemo, useRef, useState } from 'react'
import styles from './player.module.css'
import { Sheet, SheetToolbar, EditIcon, CloseIcon } from '@klank/ui'
import { useKlankStore } from '@klank/store'
import {
  createJamHost,
  detectSongKey,
  formatSongKey,
  type JamHost,
  type JamSnapshot,
} from '@klank/platform-api'

type PlayerProps = {
  setNeedsUpdate: React.Dispatch<React.SetStateAction<boolean>>
} & React.ComponentPropsWithRef<'section'>

export const Player: React.FC<PlayerProps> = ({ setNeedsUpdate, ...props }) => {
  const setTabFontSize = useKlankStore().setTabFontSize
  const fontSize = useKlankStore().tab.fontSize
  const transpose = useKlankStore().tab.transpose
  const setTabTranspose = useKlankStore().setTabTranspose
  const setTabScrollSpeed = useKlankStore().setTabScrollSpeed
  const tabScrollSpeed = useKlankStore().tab.scrollSpeed
  const isScrolling = useKlankStore().tab.isScrolling
  const setTabIsScrolling = useKlankStore().setTabIsScrolling
  const markPlayed = useKlankStore().markPlayed
  const tabPath = useKlankStore().tab.path
  const fileService = useKlankStore().fileService
  const playlists = useKlankStore().playlists
  const activePlaylistId = useKlankStore().activePlaylistId
  const activePlaylistIndex = useKlankStore().activePlaylistIndex
  const nextInPlaylist = useKlankStore().nextInPlaylist
  const prevInPlaylist = useKlankStore().prevInPlaylist
  const mode = useKlankStore().mode
  const setMode = useKlankStore().setMode
  const renameTab = useKlankStore().renameTab
  const instrument = useKlankStore().instrument

  // Jam state
  const jamRole = useKlankStore((s) => s.jam.role)
  const jamSnapshot = useKlankStore((s) => s.jam.snapshot)
  const jamHostAddress = useKlankStore((s) => s.jam.hostAddress)
  const jamClients = useKlankStore((s) => s.jam.clients)
  const jamConnected = useKlankStore((s) => s.jam.connected)

  const [tabData, setTabData] = useState<string | undefined>()
  const [editedContent, setEditedContent] = useState<string>('')
  const [editedArtist, setEditedArtist] = useState<string>('')
  const [editedSong, setEditedSong] = useState<string>('')
  const [renameError, setRenameError] = useState<string | null>(null)
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

  const detectedKey = useMemo(() => detectSongKey(tabData ?? ''), [tabData])
  const songKey = detectedKey === null ? undefined : formatSongKey(detectedKey, transpose)

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

  // Seed the name fields whenever edit mode is entered (toolbar or sidebar
  // context menu); split on the first " - " so a separator inside the song
  // title survives (matches mapTreeStructure).
  useEffect(() => {
    if (mode !== 'Edit') return
    const base = tabPath?.split(/[/\\]/)?.slice(-1)[0]?.replace(/\.tab\.txt$/, '') ?? ''
    const sep = base.indexOf(' - ')
    setEditedArtist(sep === -1 ? '' : base.slice(0, sep))
    setEditedSong(sep === -1 ? base : base.slice(sep + 3))
    setRenameError(null)
  }, [mode, tabPath])

  const handleEditToggle = async () => {
    if (mode === 'Edit') {
      if (fileService?.writeTabFile && tabPath) {
        const segments = tabPath.split(/[/\\]/)
        const oldFilename = segments[segments.length - 1]
        const target = segments.slice(0, -1).join('/')
        const artist = editedArtist.trim()
        const song = editedSong.trim()
        const newBase = artist ? `${artist} - ${song}` : song
        const newFilename = `${newBase}.tab.txt`
        // Empty song or path separators in a name → save in place, no rename.
        const renameValid = song !== '' && !/[/\\]/.test(newBase)

        if (!renameValid || newFilename === oldFilename) {
          await fileService.writeTabFile(oldFilename, target, editedContent)
        } else {
          if (await fileService.pathExists(`${target}/${newFilename}`)) {
            setRenameError(`A file named "${newFilename}" already exists.`)
            return
          }
          const writtenPath = await fileService.writeTabFile(newFilename, target, editedContent)
          if (!writtenPath.endsWith('.tab.txt')) {
            setRenameError(writtenPath)
            return
          }
          try {
            await fileService.deleteTabFile(tabPath)
          } catch {
            // The new file is already written; a stale duplicate is recoverable.
          }
          renameTab(tabPath, writtenPath)
          setNeedsUpdate(true)
        }
        setTabData(editedContent)
      }
      setRenameError(null)
      setMode('Read')
    } else {
      setMode('Edit')
    }
  }

  // Discard unsaved edits and leave edit mode without writing to disk.
  const handleEditCancel = () => {
    setEditedContent(tabData ?? '')
    setRenameError(null)
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
          markPlayed={() => { /* guests don't record plays */ }}
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
        songKey={songKey}
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
        <div className={styles.editContainer}>
          <div className={styles.editNameRow}>
            <input
              className={styles.editNameInput}
              value={editedArtist}
              onChange={(e) => setEditedArtist(e.target.value)}
              placeholder="Artist"
              aria-label="Artist"
            />
            <input
              className={styles.editNameInput}
              value={editedSong}
              onChange={(e) => setEditedSong(e.target.value)}
              placeholder="Song"
              aria-label="Song"
            />
            {renameError && <span className={styles.renameError}>{renameError}</span>}
          </div>
          <textarea
            className={styles.editTextarea}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            style={{ fontSize: `${fontSize}px` }}
          />
        </div>
      ) : (
        <Sheet
          tabScrollSpeed={tabScrollSpeed}
          isScrolling={isScrolling}
          setTabIsScrolling={setTabIsScrolling}
          markPlayed={markPlayed}
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
