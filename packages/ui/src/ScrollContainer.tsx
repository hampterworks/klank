import * as React from "react";
import {useEffect, useRef, useState} from "react";
import useKlankStore, {SCROLL_SPEEDS} from "web/state/store";
import styled, {css} from "styled-components";

const ScrollWrapper = styled.div<{$isEdit: boolean}>`
    overflow-Y: auto; 
    transform: rotateZ(0deg); 
    scroll-behavior: smooth;

    ${props => props.$isEdit && css`
        display: flex;
        flex-direction: column;
    `}
`

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
  const tabPath = useKlankStore().tab.path
  const lastTimeRef = useRef<number>(0)
  const accumulatedDeltaRef = useRef<number>(0)

  useEffect(() => {
    if (scrollContainerRef.current)
      scrollContainerRef.current.scrollTop = 0

    setIsScrolling(false)
  }, [tabPath])

  const handleKeyInput = (event: KeyboardEvent): void => {
    if (event.code === 'F2') {
      setMode(mode === "Read" ? "Edit" : "Read")
      event.preventDefault()
      return
    }
    if (mode === "Read" && (event.target as HTMLElement).tagName !== 'INPUT') {
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

    const scroll = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime
      }

      const deltaTime = currentTime - lastTimeRef.current
      lastTimeRef.current = currentTime

      if (scrollContainerRef.current) {
        const baseSpeed = (SCROLL_SPEEDS[scrollSpeed - 1] ?? 0) * 3 + 3
        const pixelsPerMillisecond = baseSpeed / 1000
        accumulatedDeltaRef.current += deltaTime * pixelsPerMillisecond

        if (accumulatedDeltaRef.current >= 1) {
          const pixels = Math.floor(accumulatedDeltaRef.current)
          scrollContainerRef.current.scrollTop += pixels
          accumulatedDeltaRef.current -= pixels
        }

        animationFrameId = requestAnimationFrame(scroll)
      }
    };

    if (isScrolling) {
      accumulatedDeltaRef.current = 0;
      lastTimeRef.current = 0;
      animationFrameId = requestAnimationFrame(scroll)
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    };
  }, [isScrolling, scrollSpeed])

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
          rootMargin: '8px',
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

  return <ScrollWrapper
    ref={scrollContainerRef}
    $isEdit={mode === 'Edit'}
    {...props}>
    {children}
    <div ref={lastElementRef}/>
  </ScrollWrapper>
}

export default ScrollContainer