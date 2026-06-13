import React, { useEffect, useState } from 'react'
import styles from './player.module.css'
import { Sheet, SheetToolbar } from '@klank/ui'
import { useKlankStore } from '@klank/store'

type SheetProps = {} & React.ComponentPropsWithRef<'section'>

export const Player: React.FC<SheetProps> = ({ ...props }) => {
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
  const [tabData, setTabData] = useState<string | undefined>()
  const [editedContent, setEditedContent] = useState<string>('')

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId)
  const playlistNav = activePlaylist && activePlaylistIndex !== null ? {
    current: activePlaylistIndex + 1,
    total: activePlaylist.paths.length,
    onPrev: prevInPlaylist,
    onNext: nextInPlaylist,
  } : undefined

  useEffect(() => {
    if (!fileService?.readTabFile) return
    fileService.readTabFile(tabPath).then((data) => {
      setTabData(data)
      setEditedContent(data)
    })
  }, [tabPath, fileService])

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

  return (
    <section className={styles.container} {...props}>
      <SheetToolbar
        fontSize={fontSize}
        songName={tabPath
          ?.split(/[/\\]/)
          ?.slice(-1)[0]
          ?.slice(0, -8)}
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
          style={{ fontSize: `${fontSize}px` }}
        />
      )}
    </section>
  )
}

