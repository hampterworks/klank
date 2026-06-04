import styles from './sheetToolbar.module.css'
import * as React from 'react'
import { Button, IncrementButton, SpeedIcon } from '../../index'
import { FontSizeIcon } from '../icons/FontSizeIcon'
import { TransposeIcon } from '../icons/TransposeIcon'
import { PlayIcon } from '../icons/PlayIcon'
import { StopIcon } from '../icons/StopIcon'
import { EditIcon } from '../icons/EditIcon'
import { ChevronIcon } from '../icons/ChevronIcon'

type PlaylistNav = {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
}

type SheetToolbarProps = {
  songName: string
  fontSize: number
  transpose: number
  tabScrollSpeed: number
  isScrolling: boolean
  mode: 'Read' | 'Edit'
  setTabFontSize: (fontSize: number) => void
  setTabTranspose: (transpose: number) => void
  setTabScrollSpeed: (speed: number) => void
  setTabIsScrolling: (isScrolling: boolean) => void
  onEditToggle: () => void
  playlist?: PlaylistNav
} & React.ComponentPropsWithRef<'div'>

export const SheetToolbar: React.FC<SheetToolbarProps> = ({
  songName,
  fontSize,
  setTabFontSize,
  transpose,
  setTabTranspose,
  tabScrollSpeed,
  setTabScrollSpeed,
  isScrolling,
  setTabIsScrolling,
  mode,
  onEditToggle,
  playlist,
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
      } else if (e.key === 'ArrowLeft' && playlist) {
        e.preventDefault()
        playlist.onPrev()
      } else if (e.key === 'ArrowRight' && playlist) {
        e.preventDefault()
        playlist.onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isScrolling, setTabIsScrolling, tabScrollSpeed, setTabScrollSpeed, playlist])

  return (
    <div className={styles.container} {...props}>
      {playlist && (
        <div className={styles.playlistNav}>
          <button onClick={playlist.onPrev} aria-label="Previous song">
            <ChevronIcon style={{ transform: 'rotate(90deg)' }} />
          </button>
          <span className={styles.playlistCounter}>{playlist.current}/{playlist.total}</span>
          <button onClick={playlist.onNext} aria-label="Next song">
            <ChevronIcon style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </div>
      )}

      <span className={styles.songName}>{songName}</span>

      <div className={styles.controls}>
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
          icon={<SpeedIcon />}
          min={1}
          max={10}
        />
        <div className={styles.actionButtons}>
          <Button
            label={isScrolling ? 'stop' : 'play'}
            icon={isScrolling ? <StopIcon /> : <PlayIcon />}
            onClick={() => setTabIsScrolling(!isScrolling)}
          />
          <Button
            label={mode === 'Edit' ? 'save' : 'edit'}
            icon={<EditIcon />}
            onClick={onEditToggle}
            className={mode === 'Edit' ? styles.activeButton : undefined}
          />
        </div>
      </div>
    </div>
  )
}
