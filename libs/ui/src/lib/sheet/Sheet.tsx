import React, { useEffect, useMemo, useRef } from 'react'
import styles from './sheet.module.css'
import {
  classifySheetLine,
  type Instrument,
  type SheetLine,
} from '@klank/platform-api'
import { ChordDiagramTooltip } from '../chordDiagramTooltip/ChordDiagramTooltip.js'

const renderLine = (
  line: string,
  index: number,
  transpose: number,
  isScrolling: boolean,
  instrument?: Instrument
): React.ReactNode => {
  const classified = classifySheetLine(line, transpose)

  switch (classified.kind) {
    case 'blank':
      return <div key={index} className={styles.blankLine}>&nbsp;</div>

    case 'header':
      return <div key={index} className={styles.header}>{classified.text}</div>

    case 'plain':
      return <div key={index}>{classified.text}</div>

    case 'chord-line':
      return (
        <div key={index} className={styles.chordLine}>
          {classified.tokens.map((token, i) => {
            if (token.kind === 'text') {
              return (
                <React.Fragment key={`${index}-${i}`}>
                  {token.raw}
                </React.Fragment>
              )
            }
            if (token.kind === 'string-indicator') {
              return (
                <span className={styles.chord} key={`${index}-${i}`}>
                  {token.raw}
                </span>
              )
            }
            // token.kind === 'chord'
            const span = (
              <span className={styles.chord} key={`${index}-${i}`}>
                {token.display}
              </span>
            )
            if (instrument) {
              return (
                <ChordDiagramTooltip
                  key={`${index}-${i}`}
                  chordName={token.display}
                  instrument={instrument}
                  isScrolling={isScrolling}
                >
                  {span}
                </ChordDiagramTooltip>
              )
            }
            return span
          })}
        </div>
      )
  }
}

/**
 * Mobile-only: renders a chord-line + following plain-line as a flex row
 * of segments so the whole unit wraps while keeping each chord above the
 * lyric characters it annotates.
 */
const renderChordLyricPair = (
  chordLine: Extract<SheetLine, { kind: 'chord-line' }>,
  lyricText: string,
  index: number,
): React.ReactNode => {
  // Compute character position of each chord token by summing preceding raw lengths
  let charPos = 0
  const chords: Array<{ pos: number; display: string }> = []

  for (const token of chordLine.tokens) {
    if (token.kind === 'chord') {
      chords.push({ pos: charPos, display: token.display })
    }
    charPos += token.raw.length
  }

  type Segment = { chordDisplay?: string; text: string }
  const segments: Segment[] = []

  if (chords.length === 0) {
    // No chords — treat like a plain pair
    segments.push({ text: lyricText })
  } else {
    // Text before the first chord (if the first chord isn't at position 0)
    if (chords[0].pos > 0) {
      segments.push({ text: lyricText.slice(0, chords[0].pos) })
    }
    // Each chord followed by the lyric characters up to the next chord (or end)
    for (let i = 0; i < chords.length; i++) {
      const start = chords[i].pos
      const end = chords[i + 1]?.pos ?? lyricText.length
      segments.push({
        chordDisplay: chords[i].display,
        text: lyricText.slice(start, end),
      })
    }
  }

  return (
    <div key={index} className={styles.chordLyricPair}>
      {segments.map((seg, i) => (
        <span key={i} className={styles.chordLyricSegment}>
          {/* Invisible placeholder keeps lyric baseline aligned when no chord */}
          <span
            className={styles.chord}
            style={{ visibility: seg.chordDisplay ? 'visible' : 'hidden' }}
            aria-hidden={!seg.chordDisplay}
          >
            {seg.chordDisplay ?? ' '}
          </span>
          <span className={styles.lyricText}>{seg.text || ' '}</span>
        </span>
      ))}
    </div>
  )
}

type SheetProps = {
  tabData: string
  transpose: number
  tabScrollSpeed: number
  isScrolling: boolean
  setTabIsScrolling: (isScrolling: boolean) => void
  instrument?: Instrument
  /** When true, chord-line + lyric-line pairs are rendered as wrappable
   *  inline segments instead of two separate block lines. */
  isMobile?: boolean
} & React.ComponentPropsWithRef<'pre'>

export const Sheet: React.FC<SheetProps> = ({
  tabData,
  transpose,
  tabScrollSpeed,
  isScrolling,
  setTabIsScrolling,
  instrument,
  isMobile = false,
  ...props
}) => {
  const containerRef = useRef<HTMLPreElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const virtualY = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    const sentinel = sentinelRef.current
    if (!container || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setTabIsScrolling(false)
          }
        }
      },
      { root: container, threshold: 1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [setTabIsScrolling])

  useEffect(() => {
    virtualY.current = 0
    if (contentRef.current) contentRef.current.style.transform = ''
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
      containerRef.current.style.overflowY = ''
    }
  }, [tabData])

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    if (!isScrolling) return

    // Recomputed on every use so a window resize or font-size change
    // mid-scroll doesn't stop early or scroll past the end.
    const getMaxScroll = () => container.scrollHeight - container.clientHeight
    if (getMaxScroll() <= 0) {
      setTabIsScrolling(false)
      return
    }

    // Capture position, zero native scroll, compensate with transform — all in one
    // synchronous block so the browser batches them into a single paint.
    virtualY.current = container.scrollTop
    container.scrollTop = 0
    container.style.overflowY = 'hidden'
    content.style.transform = `translateY(-${virtualY.current}px)`

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const pixelDelta =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? e.deltaY * 32
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? e.deltaY * container.clientHeight
            : e.deltaY
      virtualY.current = Math.max(0, Math.min(virtualY.current + pixelDelta, getMaxScroll()))
    }
    container.addEventListener('wheel', onWheel, { passive: false })

    const pxPerSec = 4 * Math.pow(1.5, tabScrollSpeed - 1)
    let rafId: number
    let lastTime: number | null = null

    const step = (timestamp: number) => {
      if (lastTime === null) {
        lastTime = timestamp
        rafId = requestAnimationFrame(step)
        return
      }

      // Clamp delta so a tab-switch resume doesn't cause a huge jump.
      const delta = Math.min(timestamp - lastTime, 100)
      lastTime = timestamp

      const maxScroll = getMaxScroll()
      virtualY.current = Math.min(
        virtualY.current + pxPerSec * (delta / 1000),
        maxScroll
      )

      content.style.transform = `translateY(-${virtualY.current}px)`

      if (virtualY.current < maxScroll) {
        rafId = requestAnimationFrame(step)
      } else {
        setTabIsScrolling(false)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafId)
      container.removeEventListener('wheel', onWheel)
      const pos = virtualY.current
      content.style.transform = ''
      container.style.overflowY = ''
      container.scrollTop = pos
    }
  }, [isScrolling, tabScrollSpeed, setTabIsScrolling])

  // Line classification runs `classifySheetLine` over the whole tab — memoize
  // so toolbar-driven re-renders don't re-parse large sheets.
  const renderedLines = useMemo(() => {
    const lines = tabData.split(/\r?\n|\r/g)

    if (!isMobile) {
      return lines.map((line, index) => renderLine(line, index, transpose, isScrolling, instrument))
    }

    // Mobile: detect chord-line immediately followed by a plain lyric line and
    // render them as a single wrappable unit so chords stay above their lyrics.
    const result: React.ReactNode[] = []
    let i = 0
    while (i < lines.length) {
      const classified = classifySheetLine(lines[i], transpose)

      if (classified.kind === 'chord-line') {
        const isTablature = classified.tokens.some(t => t.kind === 'string-indicator')
        if (!isTablature && i + 1 < lines.length) {
          const next = classifySheetLine(lines[i + 1], transpose)
          if (next.kind === 'plain') {
            result.push(renderChordLyricPair(classified, next.text, i))
            i += 2
            continue
          }
        }
      }

      result.push(renderLine(lines[i], i, transpose, isScrolling, instrument))
      i++
    }
    return result
  }, [tabData, transpose, isScrolling, instrument, isMobile])

  return (
    <pre ref={containerRef} className={styles.container} {...props}>
      <div ref={contentRef} className={styles.content}>
        {renderedLines}
        <div ref={sentinelRef}>&nbsp;</div>
      </div>
    </pre>
  )
}
