import styles from './fileTreeview.module.css'
import { FileEntry, sortByArtist } from '@klank/platform-api'
import { ChevronIcon } from '../icons/ChevronIcon'
import { FileIcon } from '../icons/FileIcon'
import * as React from 'react'
import { useEffect, useState } from 'react'

const renderTreeStructure = (
  files: FileEntry[],
  searchFilter: string,
  currentTabPath: string,
  setTabPath: (path: string) => void,
  collapsedArtists: string[],
  setCollapsedArtists: React.Dispatch<React.SetStateAction<string[]>>,
  onAddToPlaylist?: (path: string) => void,
  activePlaylistPaths?: string[]
) => {
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
                  <button onClick={() => setTabPath(item.path)}>
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
} & React.ComponentPropsWithRef<'ul'>

export const FileTreeView: React.FC<FileTreeViewProps> = ({tree, currentTabPath, setTabPath, searchFilter, onAddToPlaylist, activePlaylistPaths, ...props }) => {
  const [collapsedArtists, setCollapsedArtists] = useState<string[]>([])

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

  return <ul className={styles.container} {...props}>
    {renderTreeStructure(tree, searchFilter, currentTabPath, setTabPath, collapsedArtists, setCollapsedArtists, onAddToPlaylist, activePlaylistPaths)}
  </ul>
}
