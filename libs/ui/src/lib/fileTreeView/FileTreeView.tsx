import styles from './fileTreeview.module.css'
import { FileEntry, sortByArtist } from '@klank/platform-api'
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
  currentTabPath: string
  setTabPath: (path: string) => void
  collapsedArtists: string[]
  setCollapsedArtists: React.Dispatch<React.SetStateAction<string[]>>
  onAddToPlaylist?: (path: string) => void
  activePlaylistPaths?: string[]
  onDeleteTab?: (path: string) => void
  onContextMenuRequest: (path: string, pos: { top: number; left: number }) => void
  songButtonRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>
}

const renderTreeStructure = (opts: RenderTreeOptions) => {
  const {
    files,
    searchFilter,
    currentTabPath,
    setTabPath,
    collapsedArtists,
    setCollapsedArtists,
    onAddToPlaylist,
    activePlaylistPaths,
    onDeleteTab,
    onContextMenuRequest,
    songButtonRefs,
  } = opts

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
            {currentTree[artist].map((item) => {
              const alreadyInPlaylist = activePlaylistPaths?.includes(item.path)
              return (
                <li
                  id={currentTabPath === item.path ? 'active' : ''}
                  className={currentTabPath === item.path ? styles.active : ''}
                  key={item.path}
                >
                  <button
                    ref={(el) => { songButtonRefs.current.set(item.path, el) }}
                    onClick={() => setTabPath(item.path)}
                    onContextMenu={(e) => {
                      if (!onDeleteTab) return
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
                    <span>{item.song ?? item.artist}</span>
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
            })}
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
  onAddToPlaylist?: (path: string) => void
  activePlaylistPaths?: string[]
  onDeleteTab?: (path: string) => void
} & React.ComponentPropsWithRef<'ul'>

export const FileTreeView: React.FC<FileTreeViewProps> = ({
  tree,
  currentTabPath,
  setTabPath,
  searchFilter,
  onAddToPlaylist,
  activePlaylistPaths,
  onDeleteTab,
  ...props
}) => {
  const [collapsedArtists, setCollapsedArtists] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const deleteItemRef = useRef<HTMLButtonElement | null>(null)
  const songButtonRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  useEffect(() => {
    const activeItem = tree.find((item) => item.path === currentTabPath)
    if (activeItem) {
      setCollapsedArtists((prev) => prev.filter((a) => a !== activeItem.artist))
    }
  }, [currentTabPath, tree])

  useEffect(() => {
    const activeElement = document.getElementById('active')
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
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

  // Move focus into the Delete menu item when menu opens
  useEffect(() => {
    if (contextMenu !== null) {
      requestAnimationFrame(() => {
        deleteItemRef.current?.focus()
      })
    }
  }, [contextMenu])

  const handleContextMenuRequest = (path: string, pos: { top: number; left: number }) => {
    setContextMenu({ path, pos })
  }

  const handleDeleteActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (!contextMenu || !onDeleteTab) return
    const path = contextMenu.path
    setContextMenu(null)
    onDeleteTab(path)
  }

  const contextMenuPortal = contextMenu !== null && onDeleteTab
    ? createPortal(
        <div
          className={styles.contextMenu}
          style={{ position: 'fixed', top: contextMenu.pos.top, left: contextMenu.pos.left }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
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
          currentTabPath,
          setTabPath,
          collapsedArtists,
          setCollapsedArtists,
          onAddToPlaylist,
          activePlaylistPaths,
          onDeleteTab,
          onContextMenuRequest: handleContextMenuRequest,
          songButtonRefs,
        })}
      </ul>
      {contextMenuPortal}
    </>
  )
}
