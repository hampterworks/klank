import * as React from "react";
import {useEffect, useRef, useState} from "react";
import useKlankStore from "web/state/store";

type ScrollContainerProps = {
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'div'>

const SCROLL_SPEEDS = [0, 1, 1.2, 1.8, 2.0, 1.7, 2.0] as const
type ScrollSpeeds = typeof SCROLL_SPEEDS[number]

const ScrollContainer: React.FC<ScrollContainerProps> = ({ children, ...props }) => {
  const mode = useKlankStore().mode
  const setMode = useKlankStore().setMode
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastElementRef = useRef<HTMLDivElement>(null)
  const scrollSpeed = useKlankStore().tab.scrollSpeed
  const incrementScrollSpeed = useKlankStore().incrementScrollSpeed
  const decrementScrollSpeed = useKlankStore().decrementScrollSpeed
  const isScrolling = useKlankStore().tab.isScrolling
  const setIsScrolling = useKlankStore().setTabIsScrolling

  const handleKeyInput = (event: KeyboardEvent): void => {
    console.log("key", event)
    if (event.code === 'F2') {
      setMode(mode === "Read" ? "Edit" : "Read")
      event.preventDefault()
      return
    }
    if (mode === "Read") {
      if (event.code === 'Space') {
        setIsScrolling(!isScrolling)
        event.preventDefault()
      } else if (event.code === 'NumpadAdd' || event.code === 'Equal') {
        incrementScrollSpeed()
        event.preventDefault()
      } else if (event.code === 'NumpadSubtract' || event.code === 'Minus' ) {
        decrementScrollSpeed()
        event.preventDefault()
      }
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isScrolling) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += SCROLL_SPEEDS[scrollSpeed] ?? 0;
        }
      }, 60)
    }

    return () => {
      clearInterval(interval)
    }
  }, [isScrolling, scrollSpeed, scrollContainerRef])


  useEffect(() => {
    let observer: IntersectionObserver

    document.addEventListener('keydown', handleKeyInput)

    if (lastElementRef.current !== null) {
      observer = new IntersectionObserver(entries => {
          const [entry] = entries
          if (entry?.isIntersecting)
            setIsScrolling(false)
        },
        {
          rootMargin: '0px',
          threshold: 1.0,
        })

      observer.observe(lastElementRef.current)

      return () => {
        document.removeEventListener('keydown', handleKeyInput)
        observer.disconnect();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyInput)
      if (observer) observer.disconnect()
    }
  }, [mode, isScrolling])

  return <div style={{overflowY: "auto"}}
    ref={scrollContainerRef}
    {...props}>
    {children}
    <div ref={lastElementRef}/>
  </div>
}

export default ScrollContainer
