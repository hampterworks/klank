import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computePopoverPosition } from './usePopoverPosition.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  const defaults = {
    top: 50,
    bottom: 56,
    left: 100,
    right: 116,
    width: 16,
    height: 6,
    x: 100,
    y: 50,
    toJSON() { return this },
  }
  return { ...defaults, ...overrides } as DOMRect
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computePopoverPosition — desktop (width > 599)', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1024)
    vi.stubGlobal('innerHeight', 768)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('places panel below trigger by default (no overflow)', () => {
    const rect = makeRect({ bottom: 56, top: 50, right: 116, left: 100 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    expect(pos.top).toBe(56 + 6)
    expect(pos.bottom).toBeUndefined()
  })

  it('flips upward when panel would overflow bottom of viewport', () => {
    // button near bottom: bottom=700, panelHeight=320 would push past 768-16=752
    const rect = makeRect({ bottom: 700, top: 694, right: 116, left: 100 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    expect(pos.bottom).toBeDefined()
    expect(pos.top).toBeUndefined()
  })

  it('right-aligned trigger stays on screen (no clamp needed)', () => {
    // trigger right edge at x=116; viewport=1024; rawRight=1024-116=908; panel left=1024-908-280=−164 → clamp
    // Actually with this rect rawRight=908 and panel left edge = 1024-908-280 = -164 < 8 → clamp
    // clampedRight = 1024-280-8 = 736
    const rect = makeRect({ right: 116, left: 100 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    // Panel right edge should not push left edge off screen
    // left edge = 1024 - right - 280 >= 8
    const leftEdge = 1024 - (pos.right ?? 0) - 280
    expect(leftEdge).toBeGreaterThanOrEqual(8)
  })

  it('horizontal clamp: trigger on far right, panel stays within viewport', () => {
    // Trigger right at 1020 (near right edge); viewport 1024
    // rawRight = 1024-1020 = 4; panel left edge = 1024-4-280 = 740 (>= 8, no clamp on left)
    // right edge = viewport - right = 1020; panel goes from 740 to 1020 — fine
    const rect = makeRect({ right: 1020, left: 1004 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    expect(pos.right).toBeGreaterThanOrEqual(8)
  })

  it('horizontal clamp: trigger on far left forces minimum right margin', () => {
    // Trigger right at 20; rawRight=1024-20=1004; panel left=1024-1004-280=-260 < 8 → clamp
    // clampedRight = 1024-280-8 = 736
    const rect = makeRect({ right: 20, left: 4 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    const leftEdge = 1024 - (pos.right ?? 0) - 280
    expect(leftEdge).toBeGreaterThanOrEqual(8)
  })

  it('default params work (backward-compatible call with only buttonRect)', () => {
    const rect = makeRect()
    // Should not throw; uses panelHeight=320, panelWidth=280, margin=8 defaults
    expect(() => computePopoverPosition(rect)).not.toThrow()
    const pos = computePopoverPosition(rect)
    expect(pos.top !== undefined || pos.bottom !== undefined).toBe(true)
    expect(pos.right !== undefined || pos.left !== undefined).toBe(true)
  })
})

describe('computePopoverPosition — mobile (width <= 599)', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 375)
    vi.stubGlobal('innerHeight', 667)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('places panel above the trigger (bottom anchor)', () => {
    const rect = makeRect({ top: 400, bottom: 406, left: 50, right: 66 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    expect(pos.bottom).toBe(667 - 400 + 6)
    expect(pos.top).toBeUndefined()
  })

  it('left position is at least the margin', () => {
    const rect = makeRect({ left: 0, right: 16 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    expect(pos.left).toBeGreaterThanOrEqual(8)
  })

  it('horizontal clamp: trigger on far right keeps panel within viewport', () => {
    // Trigger left at 340; rawLeft=max(8,340)=340; panel would end at 340+280=620; viewport=375; overflow
    // clampedLeft = min(340, 375-280-8) = min(340, 87) = 87
    const rect = makeRect({ left: 340, right: 356 })
    const pos = computePopoverPosition(rect, 320, 280, 8)
    const rightEdge = (pos.left ?? 0) + 280
    expect(rightEdge).toBeLessThanOrEqual(375 - 8)
  })
})
