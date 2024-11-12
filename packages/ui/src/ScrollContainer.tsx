import * as React from "react";
import {useEffect, useRef, useState} from "react";
import useKlankStore, {SCROLL_SPEEDS} from "web/state/store";

type ScrollContainerProps = {
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'div'>

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
    let animationFrameId: number;

    const scroll = () => {
      if (scrollContainerRef.current) {
        animationFrameId = requestAnimationFrame(scroll)
        if (animationFrameId % 6 == 0)
          scrollContainerRef.current.scrollTop += SCROLL_SPEEDS[scrollSpeed - 1] ?? 0;
      }
    };

    if (isScrolling) {
      animationFrameId = requestAnimationFrame(scroll);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
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

  return <div style={{overflowY: "auto", transform: "rotateZ(0deg)", scrollBehavior: "smooth"}}
    ref={scrollContainerRef}
    {...props}>
    {children}
    <div ref={lastElementRef}/>
  </div>
}

export default ScrollContainer
