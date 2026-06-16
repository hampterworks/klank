/**
 * Pure helpers for the guest scroll-follower in Sheet.
 * Kept separate so they can be unit-tested without a DOM.
 */

/**
 * Exponential ease toward target.
 * current + (target - current) * (1 - e^(-dt/tau))
 *
 * @param current  Current display fraction [0, 1]
 * @param target   Host target fraction [0, 1]
 * @param dtSeconds  Frame delta in seconds (should be clamped by caller)
 * @param tau      Time constant in seconds — smaller = faster catch-up
 */
export function smoothFraction(
  current: number,
  target: number,
  dtSeconds: number,
  tau: number,
): number {
  if (tau <= 0) return target
  return current + (target - current) * (1 - Math.exp(-dtSeconds / tau))
}

/**
 * Returns true when the gap is large enough that we should snap
 * immediately instead of easing (e.g. a seek or tab change).
 */
export function shouldSnap(
  current: number,
  target: number,
  threshold: number,
): boolean {
  return Math.abs(target - current) > threshold
}

/** Clamp x to [0, 1]. */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}
