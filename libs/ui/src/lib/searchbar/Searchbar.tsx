import styles from './searchbar.module.css';
import * as React from 'react';
import { MoveLeftIcon } from '../icons/MoveLeftIcon';
import { SearchIcon } from '../icons/SearchIcon';
import Input from '../input/Input'
import Button from '../button/Button'


type SearchbarProps = {
  isMenuExtended: boolean
  toggleMenu: (isMenuExtended: boolean) => void
} & React.ComponentPropsWithRef<'li'>;

const Searchbar: React.FC<SearchbarProps> = ({isMenuExtended, toggleMenu, ...props }) => {

  return (
    <li className={styles.container} {...props}>
      {
        isMenuExtended &&
        <Input onInput={(event: React.ChangeEvent<HTMLInputElement>) => console.log(event.target.value)} iconLeft={<SearchIcon/>}/>
      }
      <Button
        iconButton={true}
        icon={<MoveLeftIcon/>}
        className={!isMenuExtended ? styles.rotated : ''}
        onClick={() => toggleMenu(!isMenuExtended)}
      />
    </li>
  )
}

export default Searchbar
