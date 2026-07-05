import styles from './searchbar.module.css'
import * as React from 'react'
import { MoveLeftIcon } from '../icons/MoveLeftIcon'
import { SearchIcon } from '../icons/SearchIcon'
import { SortRecentIcon } from '../icons/SortRecentIcon'
import { Input } from '../input/Input'
import { Button } from '../button/Button'
import { CloseIcon } from '../icons/CloseIcon'

type SearchbarProps = {
  isMenuExtended: boolean
  toggleMenu: (isMenuExtended: boolean) => void
  searchFilter: string
  setSearchFilter: (filter: string) => void
  /** Current song-menu ordering; the toggle flips between the two. */
  songSort?: 'artist' | 'recent'
  onToggleSort?: () => void
  /** When true (drawer context on mobile), shows the search Input instead of hiding it. */
  inDrawer?: boolean
} & React.ComponentPropsWithRef<'li'>

export const Searchbar: React.FC<SearchbarProps> = ({
  isMenuExtended,
  toggleMenu,
  searchFilter,
  setSearchFilter,
  songSort,
  onToggleSort,
  inDrawer,
  ...props
}) => {
  const sortActive = songSort === 'recent'
  return (
    <li className={`${styles.container}${!isMenuExtended ? ' ' + styles.collapsed : ''}${inDrawer ? ' ' + styles.inDrawer : ''}`} {...props}>
      {isMenuExtended && (
        <Input
          value={searchFilter}
          onInput={(event: React.FormEvent<HTMLInputElement>) =>
            setSearchFilter((event.target as HTMLInputElement).value)
          }
          iconLeft={<SearchIcon />}
          iconRight={searchFilter.length > 0 && <CloseIcon onClick={() => setSearchFilter('')}/>}
        />
      )}
      {isMenuExtended && onToggleSort && (
        <Button
          iconButton={true}
          icon={<SortRecentIcon />}
          className={`${styles.sortToggle}${sortActive ? ' ' + styles.sortActive : ''}`}
          aria-pressed={sortActive}
          aria-label="Toggle recently played order"
          title={sortActive ? 'Sort by artist' : 'Sort by recently played'}
          onClick={onToggleSort}
        />
      )}
      <Button
        iconButton={true}
        icon={<MoveLeftIcon />}
        className={!isMenuExtended ? styles.rotated : ''}
        onClick={() => toggleMenu(!isMenuExtended)}
      />
    </li>
  )
}
