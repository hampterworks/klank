import styles from './sheetToolbar.module.css'
import * as React from 'react'
import { Button, IncrementButton } from '../../index'
import { FontSizeIcon } from '../icons/FontSizeIcon'
import { TransposeIcon } from '../icons/TransposeIcon'
import { PlayIcon } from '../icons/PlayIcon'
import { StopIcon } from '../icons/StopIcon'
import { EditIcon } from '../icons/EditIcon'

type SheetToolbarProps = {
  songName: string
  fontSize: number
  transpose: number
  tabScrollSpeed: number
  isScrolling: boolean
  setTabFontSize: (fontSize: number) => void
  setTabTranspose: (transpose: number) => void
  setTabScrollSpeed: (speed: number) => void
  setTabIsScrolling: (isScrolling: boolean) => void
} & React.ComponentPropsWithRef<'div'>

const SheetToolbar: React.FC<SheetToolbarProps> = ({
  songName,
  fontSize,
  setTabFontSize,
  transpose,
  setTabTranspose,
  tabScrollSpeed,
  setTabScrollSpeed,
  isScrolling,
  setTabIsScrolling,
  ...props
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        setTabIsScrolling(!isScrolling)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setTabScrollSpeed(Math.min(10, tabScrollSpeed + 1))
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setTabScrollSpeed(Math.max(1, tabScrollSpeed - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isScrolling, setTabIsScrolling, tabScrollSpeed, setTabScrollSpeed])

  return (
    <div className={styles.container} {...props}>
      <span>{songName}</span>
      <IncrementButton
        value={fontSize}
        setValue={setTabFontSize}
        icon={<FontSizeIcon />}
        min={8}
      />
      <IncrementButton
        value={transpose}
        setValue={setTabTranspose}
        icon={<TransposeIcon />}
      />
      <IncrementButton
        value={tabScrollSpeed}
        setValue={setTabScrollSpeed}
        icon={<PlayIcon />}
        min={1}
        max={10}
      />
      <div className={styles.controlWrapper}>
        <Button
          label={isScrolling ? 'stop' : 'play'}
          icon={isScrolling ? <StopIcon /> : <PlayIcon />}
          onClick={() => setTabIsScrolling(!isScrolling)}
        />
        <Button label="edit" icon={<EditIcon />} />
      </div>
    </div>
  )
}

export default SheetToolbar
