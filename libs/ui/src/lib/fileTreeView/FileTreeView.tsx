import styles from './fileTreeView.module.css'
import { FileEntry, sortByArtist } from '@klank/platform-api'
import { ChevronIcon } from '../icons/ChevronIcon'
import { FileIcon } from '../icons/FileIcon'
import * as React from 'react'
import { useState } from 'react'

const renderTreeStructure = (
  files: FileEntry[],
  searchFilter: string,
  currentTabPath: string,
  setTabPath: (path: string) => void,
  collapsedArtists: string[],
  setCollapsedArtists: React.Dispatch<React.SetStateAction<string[]>>
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
            {currentTree[artist].map((item, index) => (
              <li
                className={currentTabPath === item.path ? styles.active : ''}
                key={index + item.artist + item.song}
              >
                <button onClick={() => setTabPath(item.path)}>
                  <FileIcon />
                  <span>{item.song ?? item.artist}</span>
                </button>
              </li>
            ))}
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
} & React.ComponentPropsWithRef<'ul'>

const FileTreeView: React.FC<FileTreeViewProps> = ({tree, currentTabPath, setTabPath, searchFilter, ...props }) => {
  const [collapsedArtists, setCollapsedArtists] = useState<string[]>([])

  return <ul className={styles.container} {...props}>
    {renderTreeStructure(tree, searchFilter, currentTabPath, setTabPath, collapsedArtists, setCollapsedArtists)}
  </ul>
}

export default FileTreeView
