import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import {
  createTunerEngine,
  tuningStrings,
  TUNINGS,
  TUNING_NAMES,
  type TunerEngine,
  type TuningName,
} from '@klank/audio'
import { CloseIcon } from '../icons/CloseIcon.js'
import { type PopoverPosition } from '../hooks/usePopoverPosition.js'
import { usePopoverChrome, popoverStyle } from '../hooks/usePopoverChrome.js'
import styles from './tunerPanel.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Instrument = 'guitar' | 'bass'

const INSTRUMENT_DEFAULTS: Record<Instrument, TuningName> = {
  guitar: 'guitar-standard',
  bass: 'bass-standard',
}

type TunerPanelProps = {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  position: PopoverPosition | null
  onClose: () => void
  engineFactory?: () => TunerEngine
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TunerPanel: React.FC<TunerPanelProps> = ({
  triggerRef,
  position,
  onClose,
  engineFactory,
}) => {
  const [instrument, setInstrument] = useState<Instrument>('guitar')
  const [tuning, setTuning] = useState<TuningName>('guitar-standard')
  const [soundingIndex, setSoundingIndex] = useState<number | null>(null)
  const [audioAvailable, setAudioAvailable] = useState<boolean | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<TunerEngine | null>(null)
  const firstStringBtnRef = useRef<HTMLButtonElement | null>(null)

  // Create engine on mount
  useEffect(() => {
    const factory = engineFactory ?? createTunerEngine
    engineRef.current = factory()
    setAudioAvailable(engineRef.current.isAvailable())
    return () => {
      engineRef.current?.stop()
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [engineFactory])

  // Stop + clear on unmount/close
  const handleClose = useCallback(() => {
    engineRef.current?.stop()
    setSoundingIndex(null)
    onClose()
  }, [onClose])

  // Focus first string button on open
  useEffect(() => {
    const t = setTimeout(() => {
      firstStringBtnRef.current?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  // Fix 5: shared popover chrome (focus trap + click-outside + Escape).
  // Pass handleClose so that closing via Escape or click-outside also stops the engine.
  usePopoverChrome(panelRef, triggerRef, handleClose)

  // Panel-scoped keyboard handler (digit keys only — Escape is in usePopoverChrome)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null

      // Skip when target is a form control that needs keys
      if (target?.tagName === 'SELECT') return

      // Digit keys 1..N: play/stop the Nth string
      const digit = parseInt(e.key, 10)
      if (!isNaN(digit) && digit >= 1) {
        // Guard: ignore when target is INPUT/SELECT/TEXTAREA
        if (
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA'
        ) return
        e.preventDefault()
        e.stopPropagation()
        const strings = tuningStrings(tuning)
        const idx = digit - 1
        if (idx < strings.length) {
          handleStringClick(idx, strings[idx].frequency)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuning, soundingIndex])

  const handleStringClick = useCallback((idx: number, frequency: number) => {
    const engine = engineRef.current
    if (!engine) return

    const available = engine.isAvailable()
    setAudioAvailable(available)
    if (!available) return

    if (soundingIndex === idx) {
      engine.stop()
      setSoundingIndex(null)
    } else {
      engine.playFrequency(frequency)
      setSoundingIndex(idx)
    }
  }, [soundingIndex])

  const handleInstrumentChange = (inst: Instrument) => {
    engineRef.current?.stop()
    setSoundingIndex(null)
    setInstrument(inst)
    setTuning(INSTRUMENT_DEFAULTS[inst])
  }

  const handleTuningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    engineRef.current?.stop()
    setSoundingIndex(null)
    setTuning(e.target.value as TuningName)
  }

  // Tunings filtered to current instrument
  const instrumentTunings = TUNING_NAMES.filter(
    (name) => TUNINGS[name].instrument === instrument,
  )

  // Current strings
  const strings = tuningStrings(tuning)

  const soundingLabel = soundingIndex !== null ? strings[soundingIndex]?.label : null

  if (!position) return null

  // Fix 5: use shared popoverStyle helper
  const posStyle = popoverStyle(position)

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      id="tuner-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Tuner"
      className={styles.panel}
      style={posStyle}
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Tuner</span>
        <button
          className={styles.closeBtn}
          aria-label="Close tuner panel"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Audio unavailable */}
      {audioAvailable === false && (
        <div className={styles.audioUnavailable} role="alert">
          Audio not available
        </div>
      )}

      {/* Instrument toggle */}
      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Instrument</span>
          <div
            role="radiogroup"
            aria-label="Instrument"
            className={styles.radioGroup}
          >
            {(['guitar', 'bass'] as const).map((inst) => (
              <button
                key={inst}
                role="radio"
                aria-checked={instrument === inst}
                className={[
                  styles.radioBtn,
                  instrument === inst ? styles.radioBtnActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleInstrumentChange(inst)}
              >
                {inst.charAt(0).toUpperCase() + inst.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tuning select */}
        <div className={styles.row}>
          <span className={styles.rowLabel}>Tuning</span>
          <div className={styles.rowControls}>
            <select
              className={styles.select}
              aria-label="Tuning"
              value={tuning}
              onChange={handleTuningChange}
              disabled={audioAvailable === false}
            >
              {instrumentTunings.map((name) => (
                <option key={name} value={name}>
                  {TUNINGS[name].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* String buttons */}
      <div className={styles.section}>
        <div className={styles.stringButtons} aria-label="Strings">
          {strings.map((s, i) => {
            const isActive = soundingIndex === i
            return (
              <button
                key={i}
                ref={i === 0 ? firstStringBtnRef : undefined}
                className={[styles.stringBtn, isActive ? styles.stringBtnActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`Play ${s.label} string`}
                aria-pressed={isActive}
                onClick={() => handleStringClick(i, s.frequency)}
                disabled={audioAvailable === false}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Status line — always in a11y tree; hide visually when not sounding */}
        <p
          className={[styles.status, soundingLabel === null ? styles.statusHidden : '']
            .filter(Boolean)
            .join(' ')}
          aria-live="polite"
        >
          {soundingLabel !== null ? `Sounding: ${soundingLabel}` : ' '}
        </p>
      </div>
    </div>,
    document.body,
  )
}
