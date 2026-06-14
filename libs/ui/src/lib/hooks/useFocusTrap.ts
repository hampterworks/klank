import { useEffect } from 'react'

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab/Shift+Tab focus within `containerRef` while `active` is true.
 * On deactivation, restores focus to `triggerRef` (if provided).
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  triggerRef?: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        // Shift+Tab: if at first, wrap to last
        if (active === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if at last, wrap to first
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to trigger on deactivate
      if (triggerRef?.current) {
        triggerRef.current.focus()
      }
    }
  }, [active, containerRef, triggerRef])
}
