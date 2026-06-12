import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import type { Instrument, ChordVariant } from '@klank/platform-api'
import { loadChordDiagrams, lookupChordDiagram } from '@klank/platform-api'
import { ChordDiagram } from '../chordDiagram/ChordDiagram.js'
import styles from './chordDiagramTooltip.module.css'

type TooltipPos = { bottom: number; left: number }

// Custom event used so opening one tooltip closes all others.
const TOOLTIP_OPEN_EVENT = 'klank-tooltip-open'

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
  const [isPinned, setIsPinned] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Unique object reference per instance — used to filter self-dispatched events
  const instanceId = useRef<object>({})

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setTooltipPos(null)
      setIsPinned(false)
    }, 1000)
  }

  // Load chord data and resolve variants whenever instrument or chord name changes.
  useEffect(() => {
    let cancelled = false
    loadChordDiagrams(instrument).then((map) => {
      if (cancelled) return
      setVariants(lookupChordDiagram(map, chordName))
      setAltIndex(0)
    })
    return () => {
      cancelled = true
    }
  }, [instrument, chordName])

  // Arrow key navigation — only while pinned (clicked open), so a transient
  // hover doesn't hijack arrow keys from the rest of the app.
  useEffect(() => {
    if (!tooltipPos || !isPinned || variants.length <= 1) return
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
  }, [tooltipPos, isPinned, variants.length])

  // Click outside: close immediately when tooltip is visible
  useEffect(() => {
    if (!tooltipPos) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return
      if (tooltipRef.current?.contains(e.target as Node)) return
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      setTooltipPos(null)
      setIsPinned(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [tooltipPos])

  // Close when another tooltip instance opens
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<object>).detail === instanceId.current) return
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      setTooltipPos(null)
      setIsPinned(false)
    }
    window.addEventListener(TOOLTIP_OPEN_EVENT, handler)
    return () => window.removeEventListener(TOOLTIP_OPEN_EVENT, handler)
  }, [])

  // Cleanup any pending close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const getChordPos = (): TooltipPos | null => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left + rect.width / 2,
    }
  }

  const openTooltipAt = (pos: TooltipPos) => {
    window.dispatchEvent(new CustomEvent(TOOLTIP_OPEN_EVENT, { detail: instanceId.current }))
    setTooltipPos(pos)
  }

  const handleMouseEnter = () => {
    clearCloseTimer()
    if (isScrolling || variants.length === 0) return
    const pos = getChordPos()
    if (pos) openTooltipAt(pos)
  }

  const handleMouseLeave = () => {
    if (!isPinned) scheduleClose()
  }

  const handleClick = () => {
    if (variants.length === 0 || isScrolling) return
    clearCloseTimer()
    setIsPinned(true)
    if (!tooltipPos) {
      const pos = getChordPos()
      if (pos) openTooltipAt(pos)
    }
  }

  const currentVariant = variants[altIndex]
  const strings = currentVariant?.frets.length ?? (instrument === 'bass' ? 4 : 6)

  const tooltip =
    tooltipPos && currentVariant
      ? ReactDOM.createPortal(
          <div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{ bottom: tooltipPos.bottom, left: tooltipPos.left }}
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={() => {
              if (!isPinned) scheduleClose()
            }}
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
      onClick={handleClick}
      className={styles.wrapper}
    >
      {children}
      {tooltip}
    </span>
  )
}
