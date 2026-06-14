// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 1 = quarter-note subdivisions, 2 = eighth-note, 3 = triplet */
export type Subdivision = 1 | 2 | 3;

export type BeatKind = 'accent' | 'beat' | 'sub';

// ---------------------------------------------------------------------------
// BPM bounds
// ---------------------------------------------------------------------------

export const MIN_BPM = 30;
export const MAX_BPM = 300;

// ---------------------------------------------------------------------------
// Beat pattern
// ---------------------------------------------------------------------------

/**
 * Generates the beat-kind pattern for a single bar.
 *
 * Rules:
 *   - Index 0 is always 'accent' (downbeat).
 *   - The first sub-pulse of every *other* main beat (i.e. beats 1, 2, … in
 *     0-based beat index that are not the downbeat) is 'beat'.
 *   - All other sub-pulses are 'sub'.
 *
 * Length is always `timeSignatureTop * subdivision`.
 */
export function beatPattern(
  timeSignatureTop: number,
  subdivision: Subdivision,
): BeatKind[] {
  const pattern: BeatKind[] = [];
  for (let beat = 0; beat < timeSignatureTop; beat++) {
    for (let sub = 0; sub < subdivision; sub++) {
      if (beat === 0 && sub === 0) {
        pattern.push('accent');
      } else if (sub === 0) {
        // First sub-pulse of a non-downbeat main beat
        pattern.push('beat');
      } else {
        pattern.push('sub');
      }
    }
  }
  return pattern;
}

// ---------------------------------------------------------------------------
// Timing math
// ---------------------------------------------------------------------------

/**
 * Duration in seconds between consecutive sub-pulses.
 * A quarter-note beat = 60/bpm seconds; a sub-pulse is that divided by subdivision.
 */
export function secondsPerSubPulse(bpm: number, subdivision: Subdivision): number {
  return 60 / bpm / subdivision;
}

/**
 * Returns the time (in seconds) of the next sub-pulse after `currentPulseTime`.
 * Strictly increasing for any positive bpm.
 */
export function nextPulseTime(
  currentPulseTime: number,
  bpm: number,
  subdivision: Subdivision,
): number {
  return currentPulseTime + secondsPerSubPulse(bpm, subdivision);
}

// ---------------------------------------------------------------------------
// Tap tempo
// ---------------------------------------------------------------------------

/** Maximum number of recent taps to consider when averaging. */
const MAX_TAPS = 5;

/**
 * Infers BPM from the average interval between consecutive tap timestamps
 * (in milliseconds). Uses the most recent `MAX_TAPS` taps.
 *
 * Returns `null` when:
 *   - Fewer than 2 taps are provided.
 *   - The inferred BPM is outside [MIN_BPM, MAX_BPM].
 *   - Intervals are wildly inconsistent: max interval > 2× min interval
 *     among the considered taps.
 */
export function tapTempo(tapTimestampsMs: readonly number[]): number | null {
  if (tapTimestampsMs.length < 2) return null;

  // Take the most recent MAX_TAPS timestamps
  const recent = tapTimestampsMs.slice(-MAX_TAPS);

  // Compute consecutive intervals
  const intervals: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const interval = recent[i] - recent[i - 1];
    if (interval <= 0) return null; // timestamps must be strictly increasing
    intervals.push(interval);
  }

  if (intervals.length === 0) return null;

  const minInterval = Math.min(...intervals);
  const maxInterval = Math.max(...intervals);

  // Reject wildly inconsistent taps (max > 2× min)
  if (maxInterval > 2 * minInterval) return null;

  const avgIntervalMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
  const bpm = Math.round(60_000 / avgIntervalMs);

  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;

  return bpm;
}
