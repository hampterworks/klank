import styles from './sheetToolbar.module.css'
import * as React from 'react'
import { Button, IncrementButton, SpeedIcon } from '../../index'
import { FontSizeIcon } from '../icons/FontSizeIcon'
import { TransposeIcon } from '../icons/TransposeIcon'
import { PlayIcon } from '../icons/PlayIcon'
import { StopIcon } from '../icons/StopIcon'
import { ChevronIcon } from '../icons/ChevronIcon'
import { MetronomeIcon } from '../icons/MetronomeIcon'
import { TuningForkIcon } from '../icons/TuningForkIcon'
import { ToolTip } from '../toolTip/ToolTip'
import { MetronomePanel } from '../metronomePanel/MetronomePanel'
import { TunerPanel } from '../tunerPanel/TunerPanel'
import { computePopoverPosition, type PopoverPosition } from '../hooks/usePopoverPosition'

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
  const [metronomePanelOpen, setMetronomePanelOpen] = React.useState(false)
  const [tunerPanelOpen, setTunerPanelOpen] = React.useState(false)
  const [metronomePosition, setMetronomePosition] = React.useState<PopoverPosition | null>(null)
  const [tunerPosition, setTunerPosition] = React.useState<PopoverPosition | null>(null)

  const metronomeRef = React.useRef<HTMLButtonElement>(null)
  const tunerRef = React.useRef<HTMLButtonElement>(null)

  const openMetronome = React.useCallback(() => {
    if (metronomeRef.current) {
      setMetronomePosition(computePopoverPosition(metronomeRef.current.getBoundingClientRect()))
    }
    setMetronomePanelOpen(true)
    setTunerPanelOpen(false)
  }, [])

  const openTuner = React.useCallback(() => {
    if (tunerRef.current) {
      setTunerPosition(computePopoverPosition(tunerRef.current.getBoundingClientRect()))
    }
    setTunerPanelOpen(true)
    setMetronomePanelOpen(false)
  }, [])

  const closeMetronome = React.useCallback(() => {
    setMetronomePanelOpen(false)
  }, [])

  const closeTuner = React.useCallback(() => {
    setTunerPanelOpen(false)
  }, [])

  // Close panels on resize (especially at the 599px breakpoint)
  React.useEffect(() => {
    const handleResize = () => {
      if (metronomePanelOpen || tunerPanelOpen) {
        setMetronomePanelOpen(false)
        setTunerPanelOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [metronomePanelOpen, tunerPanelOpen])

  // Global keyboard handler — existing Space/+/-/arrow + new m/t toggles
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
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
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        if (metronomePanelOpen) {
          closeMetronome()
        } else {
          openMetronome()
        }
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        if (tunerPanelOpen) {
          closeTuner()
        } else {
          openTuner()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isScrolling,
    setTabIsScrolling,
    tabScrollSpeed,
    setTabScrollSpeed,
    playlist,
    metronomePanelOpen,
    tunerPanelOpen,
    openMetronome,
    openTuner,
    closeMetronome,
    closeTuner,
  ])

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

        <div className={styles.toolButtons}>
          <ToolTip message="Metronome (M)">
            <Button
              ref={metronomeRef}
              icon={<MetronomeIcon />}
              iconButton={true}
              aria-label="Metronome"
              aria-haspopup="dialog"
              aria-expanded={metronomePanelOpen}
              aria-controls="metronome-panel"
              className={metronomePanelOpen ? styles.activeButton : undefined}
              onClick={() => {
                if (metronomePanelOpen) {
                  closeMetronome()
                } else {
                  openMetronome()
                }
              }}
            />
          </ToolTip>
          <ToolTip message="Tuner (T)">
            <Button
              ref={tunerRef}
              icon={<TuningForkIcon />}
              iconButton={true}
              aria-label="Tuner"
              aria-haspopup="dialog"
              aria-expanded={tunerPanelOpen}
              aria-controls="tuner-panel"
              className={tunerPanelOpen ? styles.activeButton : undefined}
              onClick={() => {
                if (tunerPanelOpen) {
                  closeTuner()
                } else {
                  openTuner()
                }
              }}
            />
          </ToolTip>
        </div>

        <div className={styles.actionButtons}>
          <Button
            label={isScrolling ? 'stop' : 'play'}
            icon={isScrolling ? <StopIcon /> : <PlayIcon />}
            onClick={() => setTabIsScrolling(!isScrolling)}
          />
        </div>
      </div>

      {metronomePanelOpen && (
        <MetronomePanel
          triggerRef={metronomeRef}
          position={metronomePosition}
          onClose={closeMetronome}
        />
      )}
      {tunerPanelOpen && (
        <TunerPanel
          triggerRef={tunerRef}
          position={tunerPosition}
          onClose={closeTuner}
        />
      )}
    </div>
  )
}
