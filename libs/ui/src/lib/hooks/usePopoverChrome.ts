import { useEffect } from 'react'
import { useFocusTrap } from './useFocusTrap.js'
import { type PopoverPosition } from './usePopoverPosition.js'

/**
 * Encapsulates the shared popover chrome behaviour used by MetronomePanel and
 * TunerPanel:
 *   - Focus trap within the panel while open.
 *   - Click-outside mousedown dismiss (ignores clicks on the trigger itself).
 *   - Escape key to close.
 *
 * The caller is still responsible for:
 *   - Focusing the first interactive element on open (panel-specific element).
 *   - Rendering and positioning the panel itself.
 */
export function usePopoverChrome(
  panelRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  // Focus trap
  useFocusTrap(panelRef, true, triggerRef)

  // Click-outside dismiss
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose, panelRef, triggerRef])

  // Escape-to-close (capture phase, high priority)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])
}

/**
 * Returns the React.CSSProperties object for a fixed-position portal popover
 * from a computed PopoverPosition.
 */
export function popoverStyle(position: PopoverPosition): React.CSSProperties {
  return {
    position: 'fixed',
    zIndex: 1100,
    ...(position.top !== undefined ? { top: position.top } : {}),
    ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
    ...(position.right !== undefined ? { right: position.right } : {}),
    ...(position.left !== undefined ? { left: position.left } : {}),
  }
}
