import React, { useEffect, useRef } from 'react'
import styles from './sheet.module.css'
import {
  delimiterMatcher,
  isTablatureLine,
  testChords,
  testHeader,
  testSpaces,
  testTokenContext,
  transposeChord,
} from '@klank/platform-api'

const lineMatcher = (
  line: string,
  index: number,
  transpose: number
): React.ReactNode => {
  if (!line.trim()) {
    return <div key={index} className={styles.blankLine}>&nbsp;</div>
  }

  const tokens = line.split(delimiterMatcher).filter((token) => token !== '')
  const sanitizedTokens = tokens.filter((token) => !testSpaces(token))

  const isTablature = isTablatureLine(line)

  const hasValidChords = tokens.some(
    (token) => testChords(token.replace('|', '')) || token === 'e'
  )
  const isMixedContent = hasValidChords && testTokenContext(sanitizedTokens)

  if (hasValidChords && !isMixedContent) {
    const processedChords = line
      .split(delimiterMatcher)
      .map((currentValue, i) => {
        if (testChords(currentValue) || currentValue === 'e') {
          const chordToTranspose = currentValue === 'e' ? 'E' : currentValue
          const isStringIndicator = isTablature && i === 0
          return (
            <span className={styles.chord} key={`${index}-${i}`}>
              {isStringIndicator
                ? currentValue
                : transposeChord(chordToTranspose, transpose)}
            </span>
          )
        }
        return (
          <React.Fragment key={`${index}-${i}`}>
            {currentValue}
          </React.Fragment>
        )
      })
    return <div key={index} className={styles.chordLine}>{processedChords}</div>
  }

  if (testHeader(line)) {
    return <div key={index} className={styles.header}>{line}</div>
  }

  return <div key={index}>{line}</div>
}

type SheetProps = {
  tabData: string
  transpose: number
  tabScrollSpeed: number
  isScrolling: boolean
  setTabIsScrolling: (isScrolling: boolean) => void
} & React.ComponentPropsWithRef<'pre'>

export const Sheet: React.FC<SheetProps> = ({
  tabData,
  transpose,
  tabScrollSpeed,
  isScrolling,
  setTabIsScrolling,
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

    const maxScroll = container.scrollHeight - container.clientHeight
    if (maxScroll <= 0) return

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
      virtualY.current = Math.max(0, Math.min(virtualY.current + pixelDelta, maxScroll))
    }
    container.addEventListener('wheel', onWheel, { passive: false })

    const pxPerSec = 8 * Math.pow(1.5, tabScrollSpeed - 1)
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

      virtualY.current = Math.min(
        virtualY.current + pxPerSec * (delta / 1000),
        maxScroll
      )

      content.style.transform = `translateY(-${virtualY.current}px)`

      if (virtualY.current < maxScroll) {
        rafId = requestAnimationFrame(step)
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
  }, [isScrolling, tabScrollSpeed])

  const lines: string[] = tabData.split(/\r?\n|\r|\n/g)

  return (
    <pre ref={containerRef} className={styles.container} {...props}>
      <div ref={contentRef} className={styles.content}>
        {lines.map((line, index) => lineMatcher(line, index, transpose))}
        <div ref={sentinelRef}>&nbsp;</div>
      </div>
    </pre>
  )
}
