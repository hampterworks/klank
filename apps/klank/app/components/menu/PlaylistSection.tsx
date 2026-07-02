import styles from './playlistSection.module.css'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useKlankStore } from '@klank/store'
import { ChevronIcon, GripIcon, PlusIcon } from '@klank/ui'
import { FileEntry } from '@klank/platform-api'

type PlaylistSectionProps = {
  tree: FileEntry[]
  currentTabPath: string
}

const getSongDisplayName = (path: string): string => {
  const filename = path.split(/[/\\]/).slice(-1)[0] ?? ''
  const withoutExt = filename.slice(0, -8)
  const dashIndex = withoutExt.indexOf(' - ')
  return dashIndex !== -1 ? withoutExt.slice(dashIndex + 3) : withoutExt
}

export const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

export const PlaylistSection: React.FC<PlaylistSectionProps> = ({ currentTabPath }) => {
  const playlists = useKlankStore().playlists
  const activePlaylistId = useKlankStore().activePlaylistId
  const activePlaylistIndex = useKlankStore().activePlaylistIndex
  const deletePlaylist = useKlankStore().deletePlaylist
  const renamePlaylist = useKlankStore().renamePlaylist
  const addTabToPlaylist = useKlankStore().addTabToPlaylist
  const removeTabFromPlaylist = useKlankStore().removeTabFromPlaylist
  const reorderPlaylist = useKlankStore().reorderPlaylist
  const setActivePlaylist = useKlankStore().setActivePlaylist
  const isCollapsed = useKlankStore().ui.isPlaylistSectionCollapsed
  const setPlaylistSectionCollapsed = useKlankStore().setPlaylistSectionCollapsed

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const prevLengthRef = useRef(playlists.length)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (contextMenuId === null) return
    const close = () => { setContextMenuId(null); setContextMenuPos(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenuId])

  useEffect(() => {
    if (playlists.length > prevLengthRef.current) {
      const newest = [...playlists].sort((a, b) => b.createdAt - a.createdAt)[0]
      if (newest) {
        setPlaylistSectionCollapsed(false)
        setExpandedId(newest.id)
      }
    }
    prevLengthRef.current = playlists.length
  }, [playlists, setPlaylistSectionCollapsed])

  const handleRenameCommit = (id: string) => {
    if (editingName.trim()) renamePlaylist(id, editingName.trim())
    setEditingId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (contextMenuId === id) {
      setContextMenuId(null)
      setContextMenuPos(null)
    } else {
      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
      setContextMenuPos({ top: rect.bottom, right: window.innerWidth - rect.right })
      setContextMenuId(id)
    }
  }

  const handleSongClick = (path: string, playlistId: string, index: number) => {
    const store = useKlankStore.getState()
    const saved = store.tabSettingByPath[path]
    useKlankStore.setState((state) => ({
      ...state,
      activePlaylistId: playlistId,
      activePlaylistIndex: index,
      tab: {
        ...state.tab,
        path,
        isScrolling: false,
        fontSize: saved?.fontSize ?? state.tab.fontSize,
        transpose: saved?.transpose ?? 0,
        scrollSpeed: saved?.scrollSpeed ?? state.tab.scrollSpeed,
      },
    }))
  }

  // Pointer-event based drag — avoids WebView2's broken HTML5 DnD intercept.
  // The grip handle captures the pointer so we get all moves even outside the list,
  // then elementFromPoint finds which song slot the cursor is over.
  const handleGripPointerDown = (
    e: React.PointerEvent<HTMLSpanElement>,
    playlistId: string,
    paths: string[],
    fromIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const grip = e.currentTarget
    grip.setPointerCapture(e.pointerId)
    setDragIndex(fromIndex)
    document.body.style.cursor = 'grabbing'

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const li = el?.closest<HTMLElement>('[data-song-index]')
      if (li) setHoverIndex(Number(li.dataset.songIndex))
    }

    const cleanup = () => {
      setDragIndex(null)
      setHoverIndex(null)
      document.body.style.cursor = ''
      grip.removeEventListener('pointermove', onMove)
      grip.removeEventListener('pointerup', onUp)
      grip.removeEventListener('lostpointercapture', cleanup)
    }

    const onUp = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const li = el?.closest<HTMLElement>('[data-song-index]')
      if (li) {
        const toIndex = Number(li.dataset.songIndex)
        // When dragging downward, splice removes the item first so every
        // subsequent index shifts up by one — subtract 1 to land before
        // the hovered row as the visual indicator (border-top) implies.
        const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex
        if (!isNaN(toIndex) && insertAt !== fromIndex) {
          reorderPlaylist(playlistId, reorder(paths, fromIndex, insertAt))
        }
      }
      cleanup()
    }

    grip.addEventListener('pointermove', onMove)
    grip.addEventListener('pointerup', onUp)
    grip.addEventListener('lostpointercapture', cleanup)
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <button
          className={styles.headerToggle}
          onClick={() => setPlaylistSectionCollapsed(!isCollapsed)}
        >
          <ChevronIcon className={isCollapsed ? styles.rotated : ''} />
          <span>Playlists</span>
        </button>
      </div>

      {!isCollapsed && (
        <ul className={styles.list}>
          {playlists.length === 0 && (
            <li className={styles.empty}>No playlists yet</li>
          )}
          {playlists.map((playlist) => {
            const isActive = playlist.id === activePlaylistId
            const isExpanded = playlist.id === expandedId
            const isEditing = playlist.id === editingId

            return (
              <li key={playlist.id} className={styles.playlistRow}>
                <div className={styles.playlistRowHeader}>
                  {/* Activate / deactivate toggle */}
                  <button
                    className={`${styles.activateButton} ${isActive ? styles.isActive : ''}`}
                    onClick={() => setActivePlaylist(isActive ? null : playlist.id)}
                    title={isActive ? 'Deactivate playlist' : 'Set as active playlist'}
                  >
                    {isActive ? '●' : '○'}
                  </button>

                  {/* Name — click to expand / collapse song list */}
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      className={styles.playlistNameInput}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenameCommit(playlist.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCommit(playlist.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <button
                      className={styles.nameButton}
                      onClick={() => setExpandedId((v) => (v === playlist.id ? null : playlist.id))}
                    >
                      {playlist.name}
                    </button>
                  )}

                  {/* Context menu trigger */}
                  <button
                    className={styles.menuButton}
                    onClick={(e) => handleContextMenu(e, playlist.id)}
                    aria-label="Playlist options"
                  >
                    ⋮
                  </button>
                </div>

                {/* Expanded song list */}
                {isExpanded && (
                  <ul className={styles.songList}>
                    {playlist.paths.length === 0 && (
                      <li className={styles.empty}>Empty — add songs below</li>
                    )}
                    {playlist.paths.map((path, index) => {
                      const isCurrent = isActive && activePlaylistIndex === index
                      const isDragging = dragIndex === index
                      const isDropTarget = hoverIndex === index && dragIndex !== index
                      return (
                        <li
                          key={path}
                          data-song-index={index}
                          className={[
                            styles.songItem,
                            isCurrent ? styles.activeSong : '',
                            isDragging ? styles.dragging : '',
                            isDropTarget ? styles.dragOver : '',
                          ].join(' ')}
                        >
                          <span
                            className={styles.dragHandle}
                            aria-hidden
                            onPointerDown={(e) =>
                              handleGripPointerDown(e, playlist.id, playlist.paths, index)
                            }
                          >
                            <GripIcon />
                          </span>
                          <button
                            className={styles.songButton}
                            onClick={() => handleSongClick(path, playlist.id, index)}
                          >
                            {getSongDisplayName(path)}
                          </button>
                          <button
                            className={styles.removeButton}
                            onClick={() => removeTabFromPlaylist(playlist.id, path)}
                            title="Remove from playlist"
                            aria-label="Remove from playlist"
                          >
                            ×
                          </button>
                        </li>
                      )
                    })}

                    {/* Drop sentinel — allows placing dragged item at the last position */}
                    {dragIndex !== null && (
                      <li
                        data-song-index={playlist.paths.length}
                        className={[
                          styles.dropSentinel,
                          hoverIndex === playlist.paths.length ? styles.dragOver : '',
                        ].join(' ')}
                      />
                    )}

                    {/* Add current song — inline, visible, with state feedback */}
                    {currentTabPath && (
                      <li className={styles.addSongRow}>
                        <button
                          className={styles.addSongButton}
                          onClick={() => addTabToPlaylist(playlist.id, currentTabPath)}
                          disabled={playlist.paths.includes(currentTabPath)}
                          title={
                            playlist.paths.includes(currentTabPath)
                              ? 'Already in this playlist'
                              : 'Add current song to playlist'
                          }
                        >
                          <PlusIcon />
                          {playlist.paths.includes(currentTabPath)
                            ? 'Already added'
                            : 'Add current song'}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Fixed-position context menu — escapes overflow-y: auto clip boundary */}
      {contextMenuId !== null && contextMenuPos !== null && (() => {
        const playlist = playlists.find((p) => p.id === contextMenuId)
        if (!playlist) return null
        return (
          <div
            className={styles.contextMenu}
            style={{ position: 'fixed', top: contextMenuPos.top, right: contextMenuPos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setEditingId(playlist.id)
                setEditingName(playlist.name)
                setExpandedId(playlist.id)
                setContextMenuId(null)
                setContextMenuPos(null)
              }}
            >
              Rename
            </button>
            <button
              className={styles.dangerAction}
              onClick={() => {
                deletePlaylist(playlist.id)
                setContextMenuId(null)
                setContextMenuPos(null)
              }}
            >
              Delete
            </button>
          </div>
        )
      })()}
    </div>
  )
}
