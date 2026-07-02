import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import {
  createTunerEngine,
  tuningStrings,
  tuningStringLabel,
  stringFrequency,
  TUNINGS,
  TUNING_NAMES,
  type TunerEngine,
  type TuningName,
  type TuningString,
} from '@klank/audio'
import { useKlankStore } from '@klank/store'
import type { CustomTuning } from '@klank/store'
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
// Helper — get strings for built-in or custom tuning
// ---------------------------------------------------------------------------

function getStringsForTuning(
  tuning: TuningName | string,
  customTunings: CustomTuning[],
): { label: string; frequency: number; pitchClass: number; octave: number }[] {
  if (tuning in TUNINGS) {
    return tuningStrings(tuning as TuningName)
  }
  const custom = customTunings.find((c) => c.id === tuning)
  if (!custom) return []
  return custom.strings.map((s: TuningString) => ({
    label: tuningStringLabel(s),
    frequency: stringFrequency(s),
    pitchClass: s.pitchClass,
    octave: s.octave,
  }))
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
  const [tuning, setTuning] = useState<TuningName | string>('guitar-standard')
  const [soundingIndex, setSoundingIndex] = useState<number | null>(null)
  const [audioAvailable, setAudioAvailable] = useState<boolean | null>(null)

  // Custom tuning form state
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')

  const { customTunings, addCustomTuning, deleteCustomTuning } = useKlankStore()

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

  // Current strings (built-in or custom)
  const strings = getStringsForTuning(tuning, customTunings)

  // Panel-scoped keyboard handler (digit keys only — Escape is in usePopoverChrome)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null

      // Skip when target is a form control that needs keys
      if (target?.tagName === 'SELECT') return

      // Digit keys 1..N: play the Nth string
      const digit = parseInt(e.key, 10)
      if (!isNaN(digit) && digit >= 1) {
        // Guard: ignore when target is INPUT/SELECT/TEXTAREA
        if (
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA'
        ) return
        e.preventDefault()
        e.stopPropagation()
        const idx = digit - 1
        if (idx < strings.length) {
          handleStringClick(idx, strings[idx].frequency)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuning, strings])

  const handleStringClick = useCallback((idx: number, frequency: number) => {
    const engine = engineRef.current
    if (!engine) return

    const available = engine.isAvailable()
    setAudioAvailable(available)
    if (!available) return

    engine.playFrequency(frequency)
    setSoundingIndex(idx)
  }, [])

  const handleInstrumentChange = (inst: Instrument) => {
    engineRef.current?.stop()
    setSoundingIndex(null)
    setInstrument(inst)
    setTuning(INSTRUMENT_DEFAULTS[inst])
    setShowCustomForm(false)
  }

  const handleTuningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    engineRef.current?.stop()
    setSoundingIndex(null)
    setTuning(e.target.value)
    setShowCustomForm(false)
  }

  const handleDeleteCustom = () => {
    const id = tuning
    deleteCustomTuning(id)
    setTuning(INSTRUMENT_DEFAULTS[instrument])
    engineRef.current?.stop()
    setSoundingIndex(null)
  }

  const handleSaveCustom = () => {
    if (!customName.trim()) return
    const newTuning: CustomTuning = {
      id: crypto.randomUUID(),
      name: customName.trim(),
      instrument,
      strings: strings.map((s) => ({ pitchClass: s.pitchClass, octave: s.octave })),
    }
    addCustomTuning(newTuning)
    setTuning(newTuning.id)
    setCustomName('')
    setShowCustomForm(false)
  }

  // Tunings filtered to current instrument
  const instrumentTunings = TUNING_NAMES.filter(
    (name) => TUNINGS[name].instrument === instrument,
  )

  // Custom tunings for current instrument
  const instrumentCustomTunings = customTunings.filter(
    (c) => c.instrument === instrument,
  )

  // Is the currently selected tuning a custom one?
  const selectedCustomTuning = customTunings.find((c) => c.id === tuning) ?? null

  const soundingLabel = soundingIndex !== null ? strings[soundingIndex]?.label : null

  // Pitch display for the custom form (shows current selection's string labels)
  const pitchDisplay = strings.map((s) => s.label).join(' ')

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
          <div className={styles.tuningRow}>
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
              {instrumentCustomTunings.length > 0 && (
                <optgroup label="Custom">
                  {instrumentCustomTunings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedCustomTuning !== null && (
              <button
                className={styles.deleteBtn}
                aria-label={`Delete custom tuning ${selectedCustomTuning.name}`}
                onClick={handleDeleteCustom}
              >
                Delete
              </button>
            )}
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
          {soundingLabel !== null ? `Sounding: ${soundingLabel}` : ' '}
        </p>
      </div>

      {/* Custom tuning section */}
      <div className={styles.section}>
        {!showCustomForm ? (
          <button
            className={styles.addCustomBtn}
            onClick={() => setShowCustomForm(true)}
            aria-label="New custom tuning"
          >
            + New custom tuning
          </button>
        ) : (
          <div className={styles.customForm}>
            <input
              className={styles.customFormInput}
              type="text"
              aria-label="Custom tuning name"
              placeholder="Name (e.g. My Open A)"
              maxLength={30}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <span className={styles.customFormPitches}>{pitchDisplay}</span>
            <div className={styles.customFormActions}>
              <button
                className={styles.customFormBtn}
                onClick={() => {
                  setShowCustomForm(false)
                  setCustomName('')
                }}
              >
                Cancel
              </button>
              <button
                className={styles.customFormBtn}
                onClick={handleSaveCustom}
                disabled={!customName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
