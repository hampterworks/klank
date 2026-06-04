import styles from './playlistSection.module.css'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useKlankStore } from '@klank/store'
import { ChevronIcon, PlusIcon } from '@klank/ui'
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

export const PlaylistSection: React.FC<PlaylistSectionProps> = ({ currentTabPath }) => {
  const playlists = useKlankStore().playlists
  const activePlaylistId = useKlankStore().activePlaylistId
  const activePlaylistIndex = useKlankStore().activePlaylistIndex
  const createPlaylist = useKlankStore().createPlaylist
  const deletePlaylist = useKlankStore().deletePlaylist
  const renamePlaylist = useKlankStore().renamePlaylist
  const addTabToPlaylist = useKlankStore().addTabToPlaylist
  const removeTabFromPlaylist = useKlankStore().removeTabFromPlaylist
  const setActivePlaylist = useKlankStore().setActivePlaylist

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (contextMenuId === null) return
    const close = () => setContextMenuId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenuId])

  const handleCreate = () => {
    createPlaylist('New Playlist')
    setIsCollapsed(false)
    setTimeout(() => {
      const store = useKlankStore.getState()
      const newest = [...store.playlists].sort((a, b) => b.createdAt - a.createdAt)[0]
      if (newest) {
        setEditingId(newest.id)
        setEditingName(newest.name)
        setExpandedId(newest.id)
      }
    }, 0)
  }

  const handleRenameCommit = (id: string) => {
    if (editingName.trim()) renamePlaylist(id, editingName.trim())
    setEditingId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setContextMenuId((prev) => (prev === id ? null : id))
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

  return (
    <div className={styles.section}>
      {/* Header — two separate buttons, not nested */}
      <div className={styles.header}>
        <button
          className={styles.headerToggle}
          onClick={() => setIsCollapsed((v) => !v)}
        >
          <ChevronIcon className={isCollapsed ? styles.rotated : ''} />
          <span>Playlists</span>
        </button>
        <button
          className={styles.addButton}
          onClick={handleCreate}
          title="New playlist"
          aria-label="New playlist"
        >
          <PlusIcon />
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

                {/* Context menu — rename / delete */}
                {contextMenuId === playlist.id && (
                  <div className={styles.contextMenu} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingId(playlist.id)
                        setEditingName(playlist.name)
                        setExpandedId(playlist.id)
                        setContextMenuId(null)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className={styles.dangerAction}
                      onClick={() => {
                        deletePlaylist(playlist.id)
                        setContextMenuId(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}

                {/* Expanded song list */}
                {isExpanded && (
                  <ul className={styles.songList}>
                    {playlist.paths.length === 0 && (
                      <li className={styles.empty}>Empty — add songs below</li>
                    )}
                    {playlist.paths.map((path, index) => {
                      const isCurrent = isActive && activePlaylistIndex === index
                      return (
                        <li
                          key={path}
                          className={`${styles.songItem} ${isCurrent ? styles.activeSong : ''}`}
                        >
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
    </div>
  )
}
