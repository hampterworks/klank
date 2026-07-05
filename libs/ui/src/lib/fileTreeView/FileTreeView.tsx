import styles from './fileTreeview.module.css'
import { FileEntry, PlayMetric, formatRelativeTime, sortByArtist, sortByRecency } from '@klank/platform-api'
import { ChevronIcon } from '../icons/ChevronIcon'
import { FileIcon } from '../icons/FileIcon'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ContextMenuState = {
  path: string
  pos: { top: number; left: number }
}

type RenderTreeOptions = {
  files: FileEntry[]
  searchFilter: string
  songSort: 'artist' | 'recent'
  playMetricByPath: Record<string, PlayMetric>
  currentTabPath: string
  setTabPath: (path: string) => void
  collapsedArtists: string[]
  setCollapsedArtists: React.Dispatch<React.SetStateAction<string[]>>
  onAddToPlaylist?: (path: string) => void
  activePlaylistPaths?: string[]
  onDeleteTab?: (path: string) => void
  onEditTab?: (path: string) => void
  onContextMenuRequest: (path: string, pos: { top: number; left: number }) => void
  songButtonRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>
}

/** A song title with its play-info hover tooltip. Empty when never played. */
const playInfoTitle = (metric: PlayMetric | undefined): string =>
  metric
    ? `Played ${metric.playCount}× · last played ${formatRelativeTime(metric.lastPlayedAt)}`
    : 'Not played yet'

const renderTreeStructure = (opts: RenderTreeOptions) => {
  const {
    files,
    searchFilter,
    songSort,
    playMetricByPath,
    currentTabPath,
    setTabPath,
    collapsedArtists,
    setCollapsedArtists,
    onAddToPlaylist,
    activePlaylistPaths,
    onDeleteTab,
    onEditTab,
    onContextMenuRequest,
    songButtonRefs,
  } = opts

  // A single song row — shared by the artist-grouped and recency views.
  const renderSongItem = (item: FileEntry) => {
    const alreadyInPlaylist = activePlaylistPaths?.includes(item.path)
    return (
      <li
        id={currentTabPath === item.path ? 'active' : undefined}
        className={currentTabPath === item.path ? styles.active : ''}
        key={item.path}
      >
        <button
          ref={(el) => {
            if (el === null) songButtonRefs.current.delete(item.path)
            else songButtonRefs.current.set(item.path, el)
          }}
          title={playInfoTitle(playMetricByPath[item.path])}
          aria-haspopup={(onDeleteTab || onEditTab) ? 'menu' : undefined}
          onClick={() => setTabPath(item.path)}
          onContextMenu={(e) => {
            if (!onDeleteTab && !onEditTab) return
            e.preventDefault()
            e.stopPropagation()
            onContextMenuRequest(item.path, { top: e.clientY, left: e.clientX })
          }}
          onKeyDown={(e) => {
            if (!onDeleteTab) return
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
              onContextMenuRequest(item.path, { top: rect.bottom, left: rect.left })
            }
          }}
        >
          <FileIcon />
          <span>{songSort === 'recent' ? item.name : (item.song ?? item.artist)}</span>
        </button>
        {onAddToPlaylist && !alreadyInPlaylist && (
          <button
            className={styles.addToPlaylistButton}
            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(item.path) }}
            title="Add to active playlist"
            aria-label="Add to active playlist"
          >
            +
          </button>
        )}
      </li>
    )
  }

  if (songSort === 'recent') {
    const ordered = sortByRecency(files, playMetricByPath, searchFilter)
    if (ordered.length === 0) return (
      <li className={styles.noItems}>
        {searchFilter.length > 0 ? 'No results found' : 'No files found'}
      </li>
    )
    return (
      <li className={styles.menuItem}>
        <ul className={styles.songList}>
          {ordered.map(renderSongItem)}
        </ul>
      </li>
    )
  }

  const currentTree = sortByArtist(files, searchFilter)
  const treeKeys = Object.keys(currentTree)

  if (treeKeys.length === 0) return (
    <li className={styles.noItems}>
      {searchFilter.length > 0 ? 'No results found' : 'No files found'}
    </li>
  )
  return Object.keys(currentTree).map((artist) => {
    return (
      <li className={styles.menuItem} key={artist}>
        <button
          className={styles.artistName}
          onClick={() => {
            setCollapsedArtists((prev) =>
              prev.includes(artist)
                ? prev.filter((a) => a !== artist)
                : [...prev, artist]
            )
          }}
        >
          {artist}
          <ChevronIcon
            className={collapsedArtists.includes(artist) ? styles.rotated : ''}
          />
        </button>
        {!collapsedArtists.includes(artist) && (
          <ul className={styles.songList}>
            {currentTree[artist].map(renderSongItem)}
          </ul>
        )}
      </li>
    )
  })
}

type FileTreeViewProps = {
  tree: FileEntry[]
  currentTabPath: string
  setTabPath: (path: string) => void
  searchFilter: string
  songSort?: 'artist' | 'recent'
  playMetricByPath?: Record<string, PlayMetric>
  onAddToPlaylist?: (path: string) => void
  activePlaylistPaths?: string[]
  onDeleteTab?: (path: string) => void
  onEditTab?: (path: string) => void
} & React.ComponentPropsWithRef<'ul'>

export const FileTreeView: React.FC<FileTreeViewProps> = ({
  tree,
  currentTabPath,
  setTabPath,
  searchFilter,
  songSort = 'artist',
  playMetricByPath = {},
  onAddToPlaylist,
  activePlaylistPaths,
  onDeleteTab,
  onEditTab,
  ...props
}) => {
  const [collapsedArtists, setCollapsedArtists] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const editItemRef = useRef<HTMLButtonElement | null>(null)
  const deleteItemRef = useRef<HTMLButtonElement | null>(null)
  const songButtonRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  useEffect(() => {
    const activeItem = tree.find((item) => item.path === currentTabPath)
    if (activeItem) {
      setCollapsedArtists((prev) => prev.filter((a) => a !== activeItem.artist))
    }
  }, [currentTabPath, tree])

  useEffect(() => {
    songButtonRefs.current.get(currentTabPath)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }, [currentTabPath, tree, collapsedArtists])

  // Close context menu on outside click / Escape
  useEffect(() => {
    if (contextMenu === null) return

    const handleClick = () => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const path = contextMenu.path
        setContextMenu(null)
        // Return focus to the song button
        requestAnimationFrame(() => {
          songButtonRefs.current.get(path)?.focus()
        })
      }
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  // Move focus into the first available menu item when menu opens
  useEffect(() => {
    if (contextMenu !== null) {
      requestAnimationFrame(() => {
        ;(editItemRef.current ?? deleteItemRef.current)?.focus()
      })
    }
  }, [contextMenu])

  const handleContextMenuRequest = (path: string, pos: { top: number; left: number }) => {
    setContextMenu({ path, pos })
  }

  const handleEditActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (!contextMenu || !onEditTab) return
    const path = contextMenu.path
    setContextMenu(null)
    onEditTab(path)
  }

  const handleDeleteActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (!contextMenu || !onDeleteTab) return
    const path = contextMenu.path
    setContextMenu(null)
    onDeleteTab(path)
  }

  const contextMenuPortal = contextMenu !== null && (onDeleteTab || onEditTab)
    ? createPortal(
        <div
          className={styles.contextMenu}
          style={{ position: 'fixed', top: contextMenu.pos.top, left: contextMenu.pos.left }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {onEditTab && (
            <button
              ref={editItemRef}
              role="menuitem"
              className={styles.menuAction}
              onClick={handleEditActivate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleEditActivate(e)
                }
                if (e.key === 'Escape') {
                  const path = contextMenu.path
                  setContextMenu(null)
                  requestAnimationFrame(() => {
                    songButtonRefs.current.get(path)?.focus()
                  })
                }
              }}
            >
              Edit
            </button>
          )}
          {onDeleteTab && (
            <button
              ref={deleteItemRef}
              role="menuitem"
              className={styles.dangerAction}
              onClick={handleDeleteActivate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDeleteActivate(e)
                }
                if (e.key === 'Escape') {
                  const path = contextMenu.path
                  setContextMenu(null)
                  requestAnimationFrame(() => {
                    songButtonRefs.current.get(path)?.focus()
                  })
                }
              }}
            >
              Delete
            </button>
          )}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <ul className={styles.container} {...props}>
        {renderTreeStructure({
          files: tree,
          searchFilter,
          songSort,
          playMetricByPath,
          currentTabPath,
          setTabPath,
          collapsedArtists,
          setCollapsedArtists,
          onAddToPlaylist,
          activePlaylistPaths,
          onDeleteTab,
          onEditTab,
          onContextMenuRequest: handleContextMenuRequest,
          songButtonRefs,
        })}
      </ul>
      {contextMenuPortal}
    </>
  )
}
