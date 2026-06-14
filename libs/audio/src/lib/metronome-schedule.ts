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
 * Rules (simple meters — default):
 *   - Index 0 is always 'accent' (downbeat).
 *   - The first sub-pulse of every *other* main beat (i.e. beats 1, 2, … in
 *     0-based beat index that are not the downbeat) is 'beat'.
 *   - All other sub-pulses are 'sub'.
 *
 * Compound meters (timeSignatureBottom === 8 AND timeSignatureTop divisible by
 * 3 AND timeSignatureTop > 3, e.g. 6/8, 9/8, 12/8):
 *   - The bar groups into sets of 3 main beats.
 *   - Beat 0 gets 'accent' (strong downbeat).
 *   - The first beat of each subsequent group of 3 (beats 3, 6, 9, …) also
 *     gets 'accent' (secondary group accent).
 *   - All other main-beat first sub-pulses are 'beat'.
 *   - Non-first sub-pulses within a beat are 'sub'.
 *
 * Length is always `timeSignatureTop * subdivision`.
 *
 * @param timeSignatureTop    Numerator — number of main beats per bar.
 * @param subdivision         Sub-pulses per main beat (1 | 2 | 3).
 * @param timeSignatureBottom Denominator — note value that gets the beat
 *                            (default 4). Used only for compound-meter
 *                            detection; does not affect pulse spacing.
 */
export function beatPattern(
  timeSignatureTop: number,
  subdivision: Subdivision,
  timeSignatureBottom = 4,
): BeatKind[] {
  // Compound meter: denominator 8, numerator divisible by 3, numerator > 3
  const isCompound =
    timeSignatureBottom === 8 &&
    timeSignatureTop > 3 &&
    timeSignatureTop % 3 === 0;

  const pattern: BeatKind[] = [];
  for (let beat = 0; beat < timeSignatureTop; beat++) {
    for (let sub = 0; sub < subdivision; sub++) {
      if (sub !== 0) {
        // Non-first sub-pulse of any beat is always 'sub'
        pattern.push('sub');
      } else if (beat === 0) {
        // Downbeat is always 'accent'
        pattern.push('accent');
      } else if (isCompound && beat % 3 === 0) {
        // Start of a compound group (beats 3, 6, 9, …) → secondary accent
        pattern.push('accent');
      } else {
        // First sub-pulse of any other main beat
        pattern.push('beat');
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
