export type PopoverPosition = {
  top?: number
  bottom?: number
  right?: number
  left?: number
}

/**
 * Computes the CSS position (top/bottom + right/left) for a portal popover
 * anchored to a trigger button's bounding rect.
 *
 * Desktop (width > 599px):
 *   - top = buttonRect.bottom + 6, right = window.innerWidth - buttonRect.right
 *   - Flips upward if panel would overflow the bottom of the viewport.
 *
 * Mobile (width <= 599px):
 *   - bottom = window.innerHeight - buttonRect.top + 6
 *   - left = max(8, buttonRect.left)
 */
export function computePopoverPosition(
  buttonRect: DOMRect,
  panelHeight = 320,
): PopoverPosition {
  const isMobile = window.innerWidth <= 599

  if (isMobile) {
    return {
      bottom: window.innerHeight - buttonRect.top + 6,
      left: Math.max(8, buttonRect.left),
    }
  }

  const desiredTop = buttonRect.bottom + 6
  const wouldOverflow = desiredTop + panelHeight > window.innerHeight - 16

  if (wouldOverflow) {
    return {
      bottom: window.innerHeight - buttonRect.top + 6,
      right: window.innerWidth - buttonRect.right,
    }
  }

  return {
    top: desiredTop,
    right: window.innerWidth - buttonRect.right,
  }
}
