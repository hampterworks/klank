import * as React from "react";
import {useEffect, useRef, useState} from "react";
import useKlankStore, {SCROLL_SPEEDS} from "web/state/store";
import styled, {css} from "styled-components";

const ScrollWrapper = styled.div<{$isEdit: boolean}>`
  overflow-Y: auto;
  transform: rotateZ(0deg);
  scroll-behavior: auto;

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

  // Animation refs
  const animationIdRef = useRef<number>(0)
  const totalPixelsScrolledRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastKnownScrollTopRef = useRef<number>(0)
  const isManualScrollingRef = useRef<boolean>(false)
  const manualScrollTimeoutRef = useRef<NodeJS.Timeout>(null)

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

  // Handle manual scroll detection
  const handleScroll = () => {
    if (!scrollContainerRef.current || !isScrolling) return

    const currentScrollTop = scrollContainerRef.current.scrollTop
    const expectedScrollTop = lastKnownScrollTopRef.current

    // If the scroll position differs significantly from what we expect,
    // it means the user manually scrolled
    if (Math.abs(currentScrollTop - expectedScrollTop) > 2) {
      isManualScrollingRef.current = true

      // Clear any existing timeout
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current)
      }

      // Resume autoscroll after user stops manual scrolling (much shorter delay)
      manualScrollTimeoutRef.current = setTimeout(() => {
        isManualScrollingRef.current = false
        // Reset autoscroll from current position
        if (scrollContainerRef.current) {
          startTimeRef.current = 0
          totalPixelsScrolledRef.current = scrollContainerRef.current.scrollTop
        }
      }, 200) // Reduced from 1000ms to 200ms
    }
  }

  // Calculate pixels per second with smooth progression
  const getPixelsPerSecond = (speed: number): number => {
    return speed * 5
  }

  useEffect(() => {
    const scroll = (currentTime: number) => {
      if (!scrollContainerRef.current || isManualScrollingRef.current) {
        // Keep the animation running but don't actually scroll
        if (isScrolling) {
          animationIdRef.current = requestAnimationFrame(scroll)
        }
        return
      }

      if (!startTimeRef.current) {
        startTimeRef.current = currentTime
        totalPixelsScrolledRef.current = scrollContainerRef.current.scrollTop
      }

      const elapsedTimeInSeconds = (currentTime - startTimeRef.current) / 1000
      const pixelsPerSecond = getPixelsPerSecond(scrollSpeed)
      const targetScrollTop = totalPixelsScrolledRef.current + (elapsedTimeInSeconds * pixelsPerSecond)

      const maxScrollTop = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight

      if (targetScrollTop >= maxScrollTop) {
        scrollContainerRef.current.scrollTop = maxScrollTop
        lastKnownScrollTopRef.current = maxScrollTop
        setIsScrolling(false)
        return
      }

      // Use smooth interpolation to avoid stuttering
      const currentScrollTop = scrollContainerRef.current.scrollTop
      const diff = targetScrollTop - currentScrollTop

      // Apply small incremental movement for smoothness
      if (Math.abs(diff) > 0.1) {
        const smoothedScrollTop = currentScrollTop + (diff * 0.3)
        scrollContainerRef.current.scrollTop = smoothedScrollTop
        lastKnownScrollTopRef.current = smoothedScrollTop
      }

      if (isScrolling) {
        animationIdRef.current = requestAnimationFrame(scroll)
      }
    }

    if (isScrolling) {
      startTimeRef.current = 0
      totalPixelsScrolledRef.current = scrollContainerRef.current?.scrollTop || 0
      lastKnownScrollTopRef.current = scrollContainerRef.current?.scrollTop || 0
      isManualScrollingRef.current = false
      animationIdRef.current = requestAnimationFrame(scroll)
    } else {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = 0
      }
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = 0
      }
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current)
      }
    }
  }, [isScrolling, scrollSpeed])

  // Reset scroll position when speed changes during scrolling
  useEffect(() => {
    if (isScrolling && scrollContainerRef.current && !isManualScrollingRef.current) {
      startTimeRef.current = 0
      totalPixelsScrolledRef.current = scrollContainerRef.current.scrollTop
      lastKnownScrollTopRef.current = scrollContainerRef.current.scrollTop
    }
  }, [scrollSpeed])

  useEffect(() => {
    let observer: IntersectionObserver

    document.addEventListener('keydown', handleKeyInput)

    // Add scroll event listener to detect manual scrolling
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    }

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
        if (scrollContainer) {
          scrollContainer.removeEventListener('scroll', handleScroll)
        }
        observer.disconnect()
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyInput)
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
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