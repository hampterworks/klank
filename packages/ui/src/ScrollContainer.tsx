import * as React from "react";
import {useEffect, useRef, useState} from "react";
import useKlankStore from "web/state/store";

type ScrollContainerProps = {
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'div'>

const ScrollContainer: React.FC<ScrollContainerProps> = ({ children, ...props }) => {
  const mode = useKlankStore().mode
  const setMode = useKlankStore().setMode
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastElementRef = useRef<HTMLDivElement>(null)
  const scrollSpeed = useKlankStore().tab.scrollSpeed
  const setScrollSpeed = useKlankStore().setTabScrollSpeed
  const isScrolling = useKlankStore().tab.isScrolling
  const setIsScrolling = useKlankStore().setTabIsScrolling

  const handleKeyInput = (event: KeyboardEvent): void => {
    if (event.code === 'F2') {
      console.log("xouioui")
      setMode(mode === "Read" ? "Edit" : "Read")
      event.preventDefault()
      return
    }
    if (mode === "Read") {
      if (event.code === 'Space') {
        setIsScrolling(!isScrolling)
        event.preventDefault()
      } else if (event.code === 'ArrowUp') {
        setScrollSpeed(scrollSpeed + 1)
        event.preventDefault()
      } else if (event.code === 'ArrowDown' && scrollSpeed) {
        setScrollSpeed(scrollSpeed - 1)
        event.preventDefault()
      }
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isScrolling) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += scrollSpeed;
        }
      }, 80 / scrollSpeed)
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
