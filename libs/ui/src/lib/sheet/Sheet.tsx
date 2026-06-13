import React, { useEffect, useMemo, useRef } from 'react'
import styles from './sheet.module.css'
import {
  classifySheetLine,
  type Instrument,
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

type SheetProps = {
  tabData: string
  transpose: number
  tabScrollSpeed: number
  isScrolling: boolean
  setTabIsScrolling: (isScrolling: boolean) => void
  instrument?: Instrument
} & React.ComponentPropsWithRef<'pre'>

export const Sheet: React.FC<SheetProps> = ({
  tabData,
  transpose,
  tabScrollSpeed,
  isScrolling,
  setTabIsScrolling,
  instrument,
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
    return lines.map((line, index) => renderLine(line, index, transpose, isScrolling, instrument))
  }, [tabData, transpose, isScrolling, instrument])

  return (
    <pre ref={containerRef} className={styles.container} {...props}>
      <div ref={contentRef} className={styles.content}>
        {renderedLines}
        <div ref={sentinelRef}>&nbsp;</div>
      </div>
    </pre>
  )
}
