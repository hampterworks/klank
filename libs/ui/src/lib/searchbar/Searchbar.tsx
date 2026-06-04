import styles from './searchbar.module.css'
import * as React from 'react'
import { MoveLeftIcon } from '../icons/MoveLeftIcon'
import { SearchIcon } from '../icons/SearchIcon'
import { Input } from '../input/Input'
import { Button } from '../button/Button'
import { CloseIcon } from '../icons/CloseIcon'

type SearchbarProps = {
  isMenuExtended: boolean
  toggleMenu: (isMenuExtended: boolean) => void
  searchFilter: string
  setSearchFilter: (filter: string) => void
} & React.ComponentPropsWithRef<'li'>

export const Searchbar: React.FC<SearchbarProps> = ({
  isMenuExtended,
  toggleMenu,
  searchFilter,
  setSearchFilter,
  ...props
}) => {
  return (
    <li className={`${styles.container}${!isMenuExtended ? ' ' + styles.collapsed : ''}`} {...props}>
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
      <Button
        iconButton={true}
        icon={<MoveLeftIcon />}
        className={!isMenuExtended ? styles.rotated : ''}
        onClick={() => toggleMenu(!isMenuExtended)}
      />
    </li>
  )
}
