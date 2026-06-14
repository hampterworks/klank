import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import {
  createMetronomeEngine,
  tapTempo as computeTapTempo,
  type MetronomeEngine,
  type MetronomeConfig,
  type Subdivision,
} from '@klank/audio'
import { CloseIcon } from '../icons/CloseIcon.js'
import { type PopoverPosition } from '../hooks/usePopoverPosition.js'
import { usePopoverChrome, popoverStyle } from '../hooks/usePopoverChrome.js'
import styles from './metronomePanel.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubdivisionLabel = 'quarter' | 'eighth' | 'triplet'

const SUBDIVISION_MAP: Record<SubdivisionLabel, Subdivision> = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
}

const SUBDIVISION_LABELS: { value: SubdivisionLabel; label: string; ariaLabel: string }[] = [
  { value: 'quarter', label: '♩', ariaLabel: 'Quarter notes' },
  { value: 'eighth', label: '♪', ariaLabel: 'Eighth notes' },
  { value: 'triplet', label: '♪♪♪', ariaLabel: 'Triplets' },
]

const BPM_MIN = 20
const BPM_MAX = 300
const TAP_RESET_MS = 3000
const PULSE_DISABLE_BPM = 180

type MetronomePanelProps = {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  position: PopoverPosition | null
  onClose: () => void
  engineFactory?: () => MetronomeEngine
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MetronomePanel: React.FC<MetronomePanelProps> = ({
  triggerRef,
  position,
  onClose,
  engineFactory,
}) => {
  const [bpm, setBpm] = useState(120)
  const [isRunning, setIsRunning] = useState(false)
  const [timeSignatureNum, setTimeSignatureNum] = useState(4)
  const [timeSignatureDen, setTimeSignatureDen] = useState(4)
  const [accentDownbeat, setAccentDownbeat] = useState(true)
  const [subdivision, setSubdivision] = useState<SubdivisionLabel>('quarter')
  // Fix 7: tap history is internal-only state, never rendered — use a ref
  const tapTimesRef = useRef<number[]>([])
  const [currentBeatIndex, setCurrentBeatIndex] = useState(-1)
  const [audioAvailable, setAudioAvailable] = useState<boolean | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const startStopRef = useRef<HTMLButtonElement>(null)
  const engineRef = useRef<MetronomeEngine | null>(null)

  // Create engine on mount
  useEffect(() => {
    const factory = engineFactory ?? createMetronomeEngine
    engineRef.current = factory()
    setAudioAvailable(engineRef.current.isAvailable())
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [engineFactory])

  // Focus first interactive element on open
  useEffect(() => {
    const t = setTimeout(() => {
      startStopRef.current?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  // Fix 5: shared popover chrome (focus trap + click-outside + Escape)
  // Note: Escape is handled in usePopoverChrome; the panel-local keydown below
  // only handles ArrowUp/Down for BPM (non-Escape keys).
  usePopoverChrome(panelRef, triggerRef, onClose)

  // Panel-scoped keyboard handler (ArrowUp/Down for BPM only — Escape is in usePopoverChrome)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // Let native select handle its own arrow keys
      if (target?.tagName === 'SELECT') return

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const delta = e.shiftKey ? 10 : 1
        setBpm((prev) => Math.min(BPM_MAX, prev + delta))
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        const delta = e.shiftKey ? 10 : 1
        setBpm((prev) => Math.max(BPM_MIN, prev - delta))
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  // Sync engine config whenever state changes while running
  const buildConfig = useCallback((): MetronomeConfig => ({
    bpm,
    timeSignatureTop: timeSignatureNum,
    timeSignatureBottom: timeSignatureDen,
    subdivision: SUBDIVISION_MAP[subdivision],
    accent: accentDownbeat,
  }), [bpm, timeSignatureNum, timeSignatureDen, subdivision, accentDownbeat])

  useEffect(() => {
    if (isRunning && engineRef.current) {
      engineRef.current.setConfig(buildConfig())
    }
  }, [bpm, timeSignatureNum, timeSignatureDen, accentDownbeat, subdivision, isRunning, buildConfig])

  // Stop engine when panel unmounts
  useEffect(() => {
    return () => {
      if (engineRef.current?.isRunning()) {
        engineRef.current.stop()
      }
    }
  }, [])

  const handleStartStop = () => {
    const engine = engineRef.current
    if (!engine) return

    // Check availability on first interaction
    const available = engine.isAvailable()
    setAudioAvailable(available)
    if (!available) return

    if (isRunning) {
      engine.stop()
      setIsRunning(false)
      setCurrentBeatIndex(-1)
    } else {
      const config = buildConfig()
      engine.start(config, (info) => {
        setCurrentBeatIndex(info.index)
      })
      setIsRunning(true)
    }
  }

  // Fix 7: handleTap reads/writes tapTimesRef.current — no re-render on every tap.
  // The bpm sync useEffect already calls setConfig when running, so no redundant
  // manual setConfig({ bpm }) call needed here.
  const handleTap = () => {
    const now = performance.now()
    const prev = tapTimesRef.current
    // Reset sequence if more than 3s have passed since last tap
    const filtered = prev.length > 0 && now - prev[prev.length - 1] > TAP_RESET_MS ? [] : prev
    const next = [...filtered, now]
    tapTimesRef.current = next
    const computed = computeTapTempo(next)
    if (computed !== null) {
      setBpm(computed)
      // The bpm sync useEffect handles engine.setConfig when isRunning is true,
      // so no manual setConfig call is needed here.
    }
  }

  const handleTimeSignatureNumChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10)
    setTimeSignatureNum(val)
    // Reset beat index so no stale dot lights until the next engine tick
    setCurrentBeatIndex(-1)
    if (isRunning && engineRef.current) {
      engineRef.current.setConfig({ timeSignatureTop: val })
    }
  }

  const handleTimeSignatureDenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10)
    setTimeSignatureDen(val)
    // Reset beat index — compound/simple grouping changes the accent pattern
    setCurrentBeatIndex(-1)
    if (isRunning && engineRef.current) {
      engineRef.current.setConfig({ timeSignatureBottom: val })
    }
  }

  const handleAccentChange = (on: boolean) => {
    setAccentDownbeat(on)
    if (isRunning && engineRef.current) {
      engineRef.current.setConfig({ accent: on })
    }
  }

  const handleSubdivisionChange = (sub: SubdivisionLabel) => {
    setSubdivision(sub)
    // Fix 3: reset beat index so no stale dot lights under the new subdivision
    setCurrentBeatIndex(-1)
    if (isRunning && engineRef.current) {
      engineRef.current.setConfig({ subdivision: SUBDIVISION_MAP[sub] })
    }
  }

  // Beat dot count follows time signature
  const beatDotCount = timeSignatureNum
  const beatPulseMs = isRunning ? Math.round(60000 / bpm) : undefined
  const showPulse = isRunning && bpm <= PULSE_DISABLE_BPM

  // Compound meter: denominator 8, numerator divisible by 3, numerator > 3
  const isCompoundMeter =
    timeSignatureDen === 8 &&
    timeSignatureNum > 3 &&
    timeSignatureNum % 3 === 0

  // Compute main beat index and defensively guard against out-of-range
  const rawMainBeatIndex = currentBeatIndex < 0
    ? -1
    : Math.floor(currentBeatIndex / SUBDIVISION_MAP[subdivision])
  // Guard: if the index exceeds the dot count (e.g. time sig was just reduced),
  // treat it as inactive until the next engine tick arrives in range.
  const mainBeatIndex = rawMainBeatIndex >= 0 && rawMainBeatIndex < beatDotCount
    ? rawMainBeatIndex
    : -1

  if (!position) return null

  // Fix 5: use shared popoverStyle helper
  const posStyle = popoverStyle(position)

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      id="metronome-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Metronome"
      className={styles.panel}
      style={posStyle}
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Metronome</span>
        <button
          className={styles.closeBtn}
          aria-label="Close metronome panel"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Audio unavailable message */}
      {audioAvailable === false && (
        <div className={styles.audioUnavailable} role="alert">
          Audio not available
        </div>
      )}

      {/* Section 1: BPM + Tap Tempo */}
      <div className={styles.section}>
        <div className={styles.bpmRow}>
          <button
            className={styles.bpmBtn}
            aria-label="Decrease BPM"
            onClick={() => setBpm((p) => Math.max(BPM_MIN, p - 1))}
            disabled={bpm <= BPM_MIN}
          >
            −
          </button>
          <span
            className={styles.bpmValue}
            role="status"
            aria-live="polite"
            aria-label={`${bpm} BPM`}
          >
            {bpm}
          </span>
          <button
            className={styles.bpmBtn}
            aria-label="Increase BPM"
            onClick={() => setBpm((p) => Math.min(BPM_MAX, p + 1))}
            disabled={bpm >= BPM_MAX}
          >
            +
          </button>
          <span className={styles.bpmLabel}>BPM</span>
        </div>

        {/* Beat dots */}
        <div className={styles.beatDots} aria-hidden="true">
          {Array.from({ length: beatDotCount }, (_, i) => {
            const isActive = mainBeatIndex === i
            // Downbeat (beat 0) and compound group starts (beats 3, 6, 9, …)
            // all receive downbeat/accent styling
            const isGroupAccent = i === 0 || (isCompoundMeter && i % 3 === 0)
            return (
              <span
                key={i}
                className={[
                  styles.beatDot,
                  isGroupAccent ? styles.beatDotDownbeat : '',
                  isActive ? styles.beatDotActive : '',
                  isActive && isGroupAccent ? styles.beatDotDownbeatActive : '',
                  isActive && showPulse ? styles.beatDotPulse : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  isActive && showPulse && beatPulseMs
                    ? ({
                        animationDuration: `${beatPulseMs}ms`,
                        '--pulse-scale': isGroupAccent ? '1.5' : '1.3',
                      } as React.CSSProperties)
                    : undefined
                }
              />
            )
          })}
        </div>

        <button className={styles.tapTempo} onClick={handleTap}>
          Tap Tempo
        </button>
      </div>

      {/* Section 2: Time sig + Accent + Subdivision */}
      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Time sig</span>
          <div className={styles.rowControls}>
            <select
              className={styles.select}
              value={timeSignatureNum}
              onChange={handleTimeSignatureNumChange}
              aria-label="Beats per bar"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className={styles.divider}>/</span>
            <select
              className={styles.select}
              value={timeSignatureDen}
              onChange={handleTimeSignatureDenChange}
              aria-label="Note value"
            >
              {[2, 4, 8, 16].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Accent</span>
          <div
            role="radiogroup"
            aria-label="Accent downbeat"
            className={styles.radioGroup}
          >
            <button
              role="radio"
              aria-checked={accentDownbeat}
              className={[styles.radioBtn, accentDownbeat ? styles.radioBtnActive : ''].filter(Boolean).join(' ')}
              onClick={() => handleAccentChange(true)}
            >
              On
            </button>
            <button
              role="radio"
              aria-checked={!accentDownbeat}
              className={[styles.radioBtn, !accentDownbeat ? styles.radioBtnActive : ''].filter(Boolean).join(' ')}
              onClick={() => handleAccentChange(false)}
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Subdivide</span>
          <div
            role="radiogroup"
            aria-label="Subdivision"
            className={styles.radioGroup}
          >
            {SUBDIVISION_LABELS.map(({ value, label, ariaLabel }) => (
              <button
                key={value}
                role="radio"
                aria-checked={subdivision === value}
                aria-label={ariaLabel}
                className={[styles.radioBtn, subdivision === value ? styles.radioBtnActive : ''].filter(Boolean).join(' ')}
                onClick={() => handleSubdivisionChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Start/Stop */}
      <div className={styles.section}>
        <button
          ref={startStopRef}
          className={[styles.startStop, isRunning ? styles.startStopRunning : ''].filter(Boolean).join(' ')}
          aria-label={isRunning ? 'Stop metronome' : 'Start metronome'}
          aria-pressed={isRunning}
          onClick={handleStartStop}
          disabled={audioAvailable === false}
        >
          {isRunning ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
