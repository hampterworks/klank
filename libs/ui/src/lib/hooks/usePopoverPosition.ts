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
 *   - Clamps horizontally so the panel never extends off either viewport edge.
 *
 * Mobile (width <= 599px):
 *   - bottom = window.innerHeight - buttonRect.top + 6
 *   - left = max(8, buttonRect.left), clamped so panel stays within viewport.
 */
export function computePopoverPosition(
  buttonRect: DOMRect,
  panelHeight = 320,
  panelWidth = 280,
  margin = 8,
): PopoverPosition {
  const isMobile = window.innerWidth <= 599

  if (isMobile) {
    const rawLeft = Math.max(margin, buttonRect.left)
    // Clamp right edge: left must not push panel beyond viewport
    const clampedLeft = Math.min(rawLeft, window.innerWidth - panelWidth - margin)
    return {
      bottom: window.innerHeight - buttonRect.top + 6,
      left: Math.max(margin, clampedLeft),
    }
  }

  // Desktop: anchor right edge of panel to right edge of trigger.
  // rawRight is distance from viewport right edge.
  const rawRight = window.innerWidth - buttonRect.right

  // The panel's left edge = viewport.width - rawRight - panelWidth.
  // Clamp so left edge >= margin.
  const panelLeftEdge = window.innerWidth - rawRight - panelWidth
  const clampedRight = panelLeftEdge < margin
    ? window.innerWidth - panelWidth - margin
    : rawRight

  // Clamp also so right edge doesn't go off-screen (right >= margin)
  const finalRight = Math.max(margin, clampedRight)

  const desiredTop = buttonRect.bottom + 6
  const wouldOverflow = desiredTop + panelHeight > window.innerHeight - 16

  if (wouldOverflow) {
    return {
      bottom: window.innerHeight - buttonRect.top + 6,
      right: finalRight,
    }
  }

  return {
    top: desiredTop,
    right: finalRight,
  }
}
