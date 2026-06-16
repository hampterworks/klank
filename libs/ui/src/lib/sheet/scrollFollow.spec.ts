import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { clamp01, shouldSnap, smoothFraction } from './scrollFollow.js'

// ─── clamp01 ─────────────────────────────────────────────────────────────────

describe('clamp01', () => {
  it('returns 0 for values below 0', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it('returns 1 for values above 1', () => {
    expect(clamp01(2)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })

  it('returns identity for values in [0, 1]', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
  })

  it('property: output is always in [0, 1]', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: -1e6, max: 1e6 }), (x) => {
        const r = clamp01(x)
        return r >= 0 && r <= 1
      }),
    )
  })
})

// ─── shouldSnap ──────────────────────────────────────────────────────────────

describe('shouldSnap', () => {
  const THRESHOLD = 0.3

  it('returns true when gap exceeds threshold', () => {
    expect(shouldSnap(0, 0.5, THRESHOLD)).toBe(true)
    expect(shouldSnap(1, 0.3, THRESHOLD)).toBe(true)   // exactly 0.3 is NOT > threshold
  })

  it('returns false when gap is at or below threshold', () => {
    expect(shouldSnap(0, 0.3, THRESHOLD)).toBe(false)   // exactly equal → false
    expect(shouldSnap(0, 0.29, THRESHOLD)).toBe(false)
    expect(shouldSnap(0.5, 0.5, THRESHOLD)).toBe(false)
  })

  it('is symmetric (absolute value)', () => {
    expect(shouldSnap(0.8, 0.1, THRESHOLD)).toBe(shouldSnap(0.1, 0.8, THRESHOLD))
  })

  it('property: symmetric in current/target', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: 0, max: 1 }),
        fc.double({ noNaN: true, min: 0, max: 1 }),
        fc.double({ noNaN: true, min: 0, max: 1 }),
        (a, b, threshold) => {
          return shouldSnap(a, b, threshold) === shouldSnap(b, a, threshold)
        },
      ),
    )
  })
})

// ─── smoothFraction ──────────────────────────────────────────────────────────

describe('smoothFraction', () => {
  const TAU = 0.15
  const ONE_FRAME = 1 / 60 // ~16.7 ms

  it('returns target when current == target', () => {
    expect(smoothFraction(0.5, 0.5, ONE_FRAME, TAU)).toBeCloseTo(0.5)
  })

  it('moves toward target (not away)', () => {
    const next = smoothFraction(0, 1, ONE_FRAME, TAU)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })

  it('never overshoots for a single frame', () => {
    // Moving up
    expect(smoothFraction(0, 1, ONE_FRAME, TAU)).toBeLessThanOrEqual(1)
    // Moving down
    expect(smoothFraction(1, 0, ONE_FRAME, TAU)).toBeGreaterThanOrEqual(0)
  })

  it('converges monotonically over several steps', () => {
    let val = 0
    const target = 0.8
    for (let i = 0; i < 20; i++) {
      const next = smoothFraction(val, target, ONE_FRAME, TAU)
      // Gap must strictly shrink
      expect(Math.abs(target - next)).toBeLessThan(Math.abs(target - val))
      val = next
    }
  })

  it('returns target immediately when tau is 0', () => {
    expect(smoothFraction(0, 0.7, ONE_FRAME, 0)).toBe(0.7)
  })

  it('property: output stays within [current, target] range', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: 0, max: 1 }),
        fc.double({ noNaN: true, min: 0, max: 1 }),
        fc.double({ noNaN: true, min: 0.001, max: 0.1 }), // realistic dt in seconds
        (current, target, dt) => {
          const result = smoothFraction(current, target, dt, TAU)
          const lo = Math.min(current, target)
          const hi = Math.max(current, target)
          // Allow tiny floating-point slack
          return result >= lo - 1e-12 && result <= hi + 1e-12
        },
      ),
    )
  })

  it('property: reduces the gap from target', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, min: 0, max: 1 }),
        fc.double({ noNaN: true, min: 0, max: 1 }),
        fc.double({ noNaN: true, min: 0.001, max: 0.1 }),
        (current, target, dt) => {
          if (Math.abs(current - target) < 1e-10) return true // already converged
          const result = smoothFraction(current, target, dt, TAU)
          return Math.abs(result - target) < Math.abs(current - target)
        },
      ),
    )
  })
})
