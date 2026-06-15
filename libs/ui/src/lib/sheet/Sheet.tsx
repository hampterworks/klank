import React, { useEffect, useMemo, useRef, useState } from 'react'
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
 * Mobile-only: renders a chord-line + following plain-line as a flex row of
 * per-word units. Each word is its own column (chord cell above, word below),
 * so the row wraps between whole words - never mid-word and never off-screen -
 * while each chord stays anchored above the word it annotates.
 */
const renderChordLyricPair = (
  chordLine: Extract<SheetLine, { kind: 'chord-line' }>,
  lyricText: string,
  index: number,
  instrument?: Instrument,
  isScrolling = false,
): React.ReactNode => {
  // Character position of each chord token (sum of preceding raw lengths).
  let charPos = 0
  const chords: Array<{ pos: number; display: string }> = []
  for (const token of chordLine.tokens) {
    if (token.kind === 'chord') {
      chords.push({ pos: charPos, display: token.display })
    }
    charPos += token.raw.length
  }

  // Split the lyric into word units: each non-space run plus its trailing
  // spaces. Trailing spaces ride along so monospace spacing is preserved and
  // each unit stays a single, unbreakable word.
  type Unit = { text: string; start: number; chord?: string }
  const units: Unit[] = []
  const wordRe = /\S+\s*/g
  let m: RegExpExecArray | null
  while ((m = wordRe.exec(lyricText)) !== null) {
    units.push({ text: m[0], start: m.index })
  }
  if (units.length === 0) {
    units.push({ text: lyricText.length ? lyricText : ' ', start: 0 })
  } else if (units[0].start > 0) {
    // Fold any leading whitespace into the first word unit.
    units[0] = { text: lyricText.slice(0, units[0].start) + units[0].text, start: 0 }
  }

  // Anchor each chord above the word it sits over (the last word starting at or
  // before the chord position). On collision push right so no chord is dropped
  // and their left-to-right order is preserved.
  let lastIdx = -1
  for (const c of chords) {
    let idx = 0
    for (let u = 0; u < units.length; u++) {
      if (units[u].start <= c.pos) idx = u
      else break
    }
    if (idx <= lastIdx) idx = lastIdx + 1
    if (idx >= units.length) break // no room left
    units[idx].chord = c.display
    lastIdx = idx
  }

  return (
    <div key={index} className={styles.chordLyricPair}>
      {units.map((u, i) => (
        <span key={i} className={styles.chordLyricSegment}>
          {instrument && u.chord ? (
            <ChordDiagramTooltip chordName={u.chord} instrument={instrument} isScrolling={isScrolling}>
              <span className={styles.chord}>{u.chord}</span>
            </ChordDiagramTooltip>
          ) : (
            <span
              className={styles.chord}
              style={{ visibility: u.chord ? 'visible' : 'hidden' }}
              aria-hidden={!u.chord}
            >
              {u.chord ?? ' '}
            </span>
          )}
          <span className={styles.lyricText}>{u.text}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * Reflow a tablature block (consecutive string lines) into stacked "systems"
 * that fit `cols` characters wide, so the tab reads top-to-bottom and stays
 * playable under vertical auto-scroll instead of overflowing sideways. Each
 * line keeps its string-label prefix (everything up to and including the first
 * `|`); the body is split in sync across all strings, preferring a measure-bar
 * (`|`) boundary and otherwise a column that is blank on every string so a fret
 * number is never cut in half.
 */
const reflowTablature = (rawLines: string[], cols: number): string[][] => {
  if (!Number.isFinite(cols) || cols <= 0 || rawLines.length === 0) return [rawLines]

  const prefixes = rawLines.map(l => {
    const bar = l.indexOf('|')
    return bar >= 0 ? l.slice(0, bar + 1) : ''
  })
  const bodies = rawLines.map((l, i) => l.slice(prefixes[i].length))
  const prefixLen = Math.max(0, ...prefixes.map(p => p.length))
  const bodyCols = Math.max(4, cols - prefixLen)
  const bodyMax = Math.max(0, ...bodies.map(b => b.length))
  if (bodyMax <= bodyCols) return [rawLines]

  const isClean = (k: number) =>
    bodies.every(b => { const ch = b[k]; return ch === undefined || ch === '-' || ch === ' ' })
  const barCount = (k: number) => bodies.reduce((n, b) => n + (b[k] === '|' ? 1 : 0), 0)

  const systems: string[][] = []
  let pos = 0
  while (pos < bodyMax) {
    const hardEnd = Math.min(pos + bodyCols, bodyMax)
    let end = hardEnd
    if (hardEnd < bodyMax) {
      const need = Math.ceil(rawLines.length / 2)
      let cut = -1
      // Prefer cutting just after a measure bar shared by most strings.
      for (let k = hardEnd - 1; k > pos + 3; k--) {
        if (barCount(k) >= need) { cut = k + 1; break }
      }
      // Otherwise snap back to a column blank on every string.
      if (cut < 0) {
        for (let k = hardEnd; k > pos + 3; k--) {
          if (isClean(k)) { cut = k; break }
        }
      }
      if (cut > pos) end = cut
    }
    const segStart = pos, segEnd = end
    systems.push(rawLines.map((l, i) => prefixes[i] + bodies[i].slice(segStart, segEnd)))
    pos = end
  }
  return systems
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
  const measureRef = useRef<HTMLSpanElement>(null)
  // How many monospace characters fit across the sheet, used to reflow tab.
  const [colsPerRow, setColsPerRow] = useState<number>(Number.POSITIVE_INFINITY)

  useEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return
    const recompute = () => {
      const charWidth = measure.getBoundingClientRect().width / 100
      const cs = getComputedStyle(container)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const avail = container.clientWidth - (Number.isFinite(padX) ? padX : 0)
      if (charWidth > 0 && avail > 0) {
        // Leave ~1 char of slack so nothing kisses the right edge.
        setColsPerRow(Math.max(8, Math.floor(avail / charWidth) - 1))
      }
    }
    recompute()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(recompute)
    ro.observe(container)
    ro.observe(measure)
    return () => ro.disconnect()
  }, [])

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

        if (isTablature) {
          // Tablature is fixed-width ASCII art. Collect the run of consecutive
          // tab lines, then reflow it into stacked systems that fit the screen
          // so it reads top-to-bottom and stays playable under vertical
          // auto-scroll instead of overflowing sideways.
          const rawBlock: string[] = []
          let j = i
          while (j < lines.length) {
            const c = classifySheetLine(lines[j], transpose)
            const tab = c.kind === 'chord-line' && c.tokens.some(t => t.kind === 'string-indicator')
            if (!tab) break
            rawBlock.push(lines[j])
            j++
          }
          const systems = reflowTablature(rawBlock, colsPerRow)
          result.push(
            <div key={`tab-${i}`} className={styles.tablatureBlock}>
              {systems.map((sys, s) => (
                <div key={s} className={styles.tablatureSystem}>
                  {sys.map((ln, k) => renderLine(ln, k, transpose, isScrolling, instrument))}
                </div>
              ))}
            </div>
          )
          i = j
          continue
        }

        if (i + 1 < lines.length) {
          const next = classifySheetLine(lines[i + 1], transpose)
          if (next.kind === 'plain') {
            result.push(renderChordLyricPair(classified, next.text, i, instrument, isScrolling))
            i += 2
            continue
          }
        }
      }

      result.push(renderLine(lines[i], i, transpose, isScrolling, instrument))
      i++
    }
    return result
  }, [tabData, transpose, isScrolling, instrument, isMobile, colsPerRow])

  return (
    <pre ref={containerRef} className={styles.container} {...props}>
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: 'hidden',
          whiteSpace: 'pre',
          pointerEvents: 'none',
        }}
      >
        {'0'.repeat(100)}
      </span>
      <div ref={contentRef} className={styles.content}>
        {renderedLines}
        <div ref={sentinelRef}>&nbsp;</div>
      </div>
    </pre>
  )
}
