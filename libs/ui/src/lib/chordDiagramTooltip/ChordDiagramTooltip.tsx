import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type { Instrument, ChordVariant, ChordDiagramMap } from '@klank/platform-api'
import { loadChordDiagrams, lookupChordDiagram } from '@klank/platform-api'
import { ChordDiagram } from '../chordDiagram/ChordDiagram.js'
import styles from './chordDiagramTooltip.module.css'

type TooltipPos = { top: number; left: number }

type ChordDiagramTooltipProps = {
  chordName: string
  instrument: Instrument
  isScrolling: boolean
  children: React.ReactNode
}

export const ChordDiagramTooltip: React.FC<ChordDiagramTooltipProps> = ({
  chordName,
  instrument,
  isScrolling,
  children,
}) => {
  const [variants, setVariants] = useState<ChordVariant[]>([])
  const [altIndex, setAltIndex] = useState(0)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  // Load chord data and resolve variants whenever instrument or chord name changes.
  // loadChordDiagrams caches at the module level so repeated calls are free.
  useEffect(() => {
    let cancelled = false
    loadChordDiagrams(instrument).then((map) => {
      if (cancelled) return
      setVariants(lookupChordDiagram(map, chordName))
      setAltIndex(0)
    })
    return () => { cancelled = true }
  }, [instrument, chordName])

  // Arrow key navigation while tooltip is visible
  useEffect(() => {
    if (!tooltipPos || variants.length <= 1) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setAltIndex((idx) => (idx - 1 + variants.length) % variants.length)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setAltIndex((idx) => (idx + 1) % variants.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tooltipPos, variants.length])

  const handleMouseEnter = () => {
    if (isScrolling || variants.length === 0) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltipPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    })
  }

  const handleMouseLeave = () => setTooltipPos(null)

  const currentVariant = variants[altIndex]
  const strings = currentVariant?.frets.length ?? (instrument === 'bass' ? 4 : 6)

  const tooltip =
    tooltipPos && currentVariant
      ? ReactDOM.createPortal(
          <div
            className={styles.tooltip}
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
            role="tooltip"
            onMouseEnter={() => setTooltipPos(tooltipPos)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={styles.chordName}>{chordName}</div>
            <ChordDiagram variant={currentVariant} strings={strings} />
            {variants.length > 1 && (
              <div className={styles.nav}>
                <button
                  className={styles.navBtn}
                  onClick={() => setAltIndex((i) => (i - 1 + variants.length) % variants.length)}
                  aria-label="previous voicing"
                >
                  ‹
                </button>
                <span className={styles.altCount}>
                  {altIndex + 1}/{variants.length}
                </span>
                <button
                  className={styles.navBtn}
                  onClick={() => setAltIndex((i) => (i + 1) % variants.length)}
                  aria-label="next voicing"
                >
                  ›
                </button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={styles.wrapper}
    >
      {children}
      {tooltip}
    </span>
  )
}
