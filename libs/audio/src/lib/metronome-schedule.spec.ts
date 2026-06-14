import * as fc from 'fast-check';
import {
  beatPattern,
  secondsPerSubPulse,
  nextPulseTime,
  tapTempo,
  MIN_BPM,
  MAX_BPM,
  type Subdivision,
  type BeatKind,
} from './metronome-schedule.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_BEAT_KINDS: BeatKind[] = ['accent', 'beat', 'sub'];

const fcSubdivision = fc.constantFrom<Subdivision>(1, 2, 3);
const fcBpm = fc.integer({ min: MIN_BPM, max: MAX_BPM });

// ---------------------------------------------------------------------------
// beatPattern — property-based
// ---------------------------------------------------------------------------

describe('beatPattern properties', () => {
  it('length always equals timeSignatureTop * subdivision', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fcSubdivision,
        (top, sub) => {
          return beatPattern(top, sub).length === top * sub;
        },
      ),
    );
  });

  it('index 0 is always accent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fcSubdivision,
        (top, sub) => {
          return beatPattern(top, sub)[0] === 'accent';
        },
      ),
    );
  });

  it('pattern contains only valid BeatKind values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fcSubdivision,
        (top, sub) => {
          return beatPattern(top, sub).every((kind: BeatKind) => VALID_BEAT_KINDS.includes(kind));
        },
      ),
    );
  });

  it('first sub-pulse of every non-downbeat main beat is "beat" or "accent" (never "sub")', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 12 }),
        fcSubdivision,
        // Test with both common denominators (4 = simple, 8 = may be compound)
        fc.constantFrom(4, 8),
        (top, sub, bottom) => {
          const pattern = beatPattern(top, sub, bottom);
          for (let beat = 1; beat < top; beat++) {
            // In compound meters, group-start beats get 'accent'; all others get 'beat'.
            // Either way, the first sub-pulse of a main beat is never 'sub'.
            if (pattern[beat * sub] === 'sub') return false;
          }
          return true;
        },
      ),
    );
  });

  it('sub-pulses within a beat (not the first) are all "sub"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fcSubdivision,
        (top, sub) => {
          const pattern = beatPattern(top, sub);
          for (let beat = 0; beat < top; beat++) {
            for (let s = 1; s < sub; s++) {
              if (pattern[beat * sub + s] !== 'sub') return false;
            }
          }
          return true;
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// beatPattern — unit tests
// ---------------------------------------------------------------------------

describe('beatPattern unit tests', () => {
  it('4/4 quarter-note: [accent, beat, beat, beat]', () => {
    expect(beatPattern(4, 1)).toEqual(['accent', 'beat', 'beat', 'beat']);
  });

  it('4/4 eighth-note: [accent, sub, beat, sub, beat, sub, beat, sub]', () => {
    expect(beatPattern(4, 2)).toEqual([
      'accent', 'sub',
      'beat',   'sub',
      'beat',   'sub',
      'beat',   'sub',
    ]);
  });

  it('3/4 quarter-note: [accent, beat, beat]', () => {
    expect(beatPattern(3, 1)).toEqual(['accent', 'beat', 'beat']);
  });

  it('3/4 triplet: length 9, index 0 accent', () => {
    const p = beatPattern(3, 3);
    expect(p).toHaveLength(9);
    expect(p[0]).toBe('accent');
    expect(p[3]).toBe('beat');
    expect(p[6]).toBe('beat');
  });

  it('1/4 (single beat): just [accent]', () => {
    expect(beatPattern(1, 1)).toEqual(['accent']);
  });

  // --- simple meter: denominator 4, quarter-note beat ---

  it('3/4 bottom=4 quarter-note: accent only at index 0, beat elsewhere', () => {
    // Not compound (bottom=4), so only the downbeat is 'accent'
    expect(beatPattern(3, 1, 4)).toEqual(['accent', 'beat', 'beat']);
  });

  it('4/4 bottom=4 quarter-note: identical to default (no bottom arg)', () => {
    expect(beatPattern(4, 1, 4)).toEqual(beatPattern(4, 1));
  });

  // --- compound meters: denominator 8 ---

  it('6/8 sub=1: accents at indices 0 and 3; beats at 1,2,4,5', () => {
    // 6 beats, groups of 3 → group starts at beats 0 and 3
    expect(beatPattern(6, 1, 8)).toEqual([
      'accent', 'beat', 'beat',
      'accent', 'beat', 'beat',
    ]);
  });

  it('6/8 sub=2: accent at index 0, sub at 1, beat at 2, sub at 3, accent at 6, sub at 7, beat at 8, sub at 9', () => {
    // sub=2 means each of the 6 beats gets [first, sub] → total 12 pulses
    // beat pattern for main beats: [accent, beat, beat, accent, beat, beat]
    const p = beatPattern(6, 2, 8);
    expect(p).toHaveLength(12);
    expect(p[0]).toBe('accent');  // beat 0, sub 0
    expect(p[1]).toBe('sub');     // beat 0, sub 1
    expect(p[2]).toBe('beat');    // beat 1, sub 0
    expect(p[3]).toBe('sub');     // beat 1, sub 1
    expect(p[6]).toBe('accent');  // beat 3, sub 0 (group start)
    expect(p[7]).toBe('sub');     // beat 3, sub 1
    expect(p[8]).toBe('beat');    // beat 4, sub 0
    expect(p[9]).toBe('sub');     // beat 4, sub 1
  });

  it('9/8 sub=1: accents at indices 0, 3, 6; beats at others', () => {
    expect(beatPattern(9, 1, 8)).toEqual([
      'accent', 'beat', 'beat',
      'accent', 'beat', 'beat',
      'accent', 'beat', 'beat',
    ]);
  });

  it('12/8 sub=1: accents at indices 0, 3, 6, 9; beats at others', () => {
    expect(beatPattern(12, 1, 8)).toEqual([
      'accent', 'beat', 'beat',
      'accent', 'beat', 'beat',
      'accent', 'beat', 'beat',
      'accent', 'beat', 'beat',
    ]);
  });

  it('3/8 sub=1: NOT compound (top=3 is not > 3), accent only at 0', () => {
    // 3/8: top=3, not > 3, so falls through to simple meter rules
    expect(beatPattern(3, 1, 8)).toEqual(['accent', 'beat', 'beat']);
  });

  it('6/8 length = 6 * subdivision', () => {
    expect(beatPattern(6, 1, 8)).toHaveLength(6);
    expect(beatPattern(6, 2, 8)).toHaveLength(12);
    expect(beatPattern(6, 3, 8)).toHaveLength(18);
  });
});

// ---------------------------------------------------------------------------
// secondsPerSubPulse — property-based + unit
// ---------------------------------------------------------------------------

describe('secondsPerSubPulse', () => {
  it('subdivision=1 gives exactly 60/bpm', () => {
    fc.assert(
      fc.property(fcBpm, (bpm) => {
        return Math.abs(secondsPerSubPulse(bpm, 1) - 60 / bpm) < 1e-12;
      }),
    );
  });

  it('is always positive for valid bpm', () => {
    fc.assert(
      fc.property(fcBpm, fcSubdivision, (bpm, sub) => {
        return secondsPerSubPulse(bpm, sub) > 0;
      }),
    );
  });

  it('is strictly smaller as subdivision increases (same bpm)', () => {
    fc.assert(
      fc.property(fcBpm, (bpm) => {
        const q  = secondsPerSubPulse(bpm, 1);
        const e  = secondsPerSubPulse(bpm, 2);
        const tr = secondsPerSubPulse(bpm, 3);
        return q > e && e > tr;
      }),
    );
  });

  it('60 bpm, subdivision 1 → 1.0 second', () => {
    expect(secondsPerSubPulse(60, 1)).toBeCloseTo(1.0, 12);
  });

  it('120 bpm, subdivision 2 → 0.25 seconds', () => {
    expect(secondsPerSubPulse(120, 2)).toBeCloseTo(0.25, 12);
  });

  it('60 bpm, subdivision 3 → 1/3 second', () => {
    expect(secondsPerSubPulse(60, 3)).toBeCloseTo(1 / 3, 9);
  });
});

// ---------------------------------------------------------------------------
// nextPulseTime — property-based
// ---------------------------------------------------------------------------

describe('nextPulseTime', () => {
  it('strictly greater than currentPulseTime for any valid bpm/subdivision', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, min: 0, max: 1e6 }),
        fcBpm,
        fcSubdivision,
        (t, bpm, sub) => {
          return nextPulseTime(t, bpm, sub) > t;
        },
      ),
    );
  });

  it('advances by exactly secondsPerSubPulse', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, min: 0, max: 1e6 }),
        fcBpm,
        fcSubdivision,
        (t, bpm, sub) => {
          const expected = t + secondsPerSubPulse(bpm, sub);
          return Math.abs(nextPulseTime(t, bpm, sub) - expected) < 1e-12;
        },
      ),
    );
  });

  it('120 bpm, sub=1, t=0 → 0.5 s', () => {
    expect(nextPulseTime(0, 120, 1)).toBeCloseTo(0.5, 9);
  });
});

// ---------------------------------------------------------------------------
// tapTempo — unit tests
// ---------------------------------------------------------------------------

describe('tapTempo unit tests', () => {
  it('returns null for 0 taps', () => {
    expect(tapTempo([])).toBeNull();
  });

  it('returns null for 1 tap', () => {
    expect(tapTempo([1000])).toBeNull();
  });

  it('4 taps 500 ms apart → 120 BPM', () => {
    const result = tapTempo([0, 500, 1000, 1500]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(119);
    expect(result!).toBeLessThanOrEqual(121);
  });

  it('4 taps 1000 ms apart → 60 BPM', () => {
    const result = tapTempo([0, 1000, 2000, 3000]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(59);
    expect(result!).toBeLessThanOrEqual(61);
  });

  it('2 taps exactly 200 ms apart → 300 BPM (boundary)', () => {
    expect(tapTempo([0, 200])).toBe(300);
  });

  it('2 taps exactly 2000 ms apart → 30 BPM (boundary)', () => {
    expect(tapTempo([0, 2000])).toBe(30);
  });

  it('returns null when inferred BPM would exceed MAX_BPM', () => {
    // Taps 100 ms apart → 600 BPM — outside [30, 300]
    expect(tapTempo([0, 100, 200, 300])).toBeNull();
  });

  it('returns null when inferred BPM is below MIN_BPM', () => {
    // Taps 3000 ms apart → 20 BPM — outside [30, 300]
    expect(tapTempo([0, 3000, 6000])).toBeNull();
  });

  it('returns null for erratic/inconsistent intervals (max > 2× min)', () => {
    // Intervals: 500, 500, 1500 — max (1500) > 2 × min (500)
    expect(tapTempo([0, 500, 1000, 2500])).toBeNull();
  });

  it('handles exactly MAX_TAPS+1 entries by using only the 5 most recent', () => {
    // 6 taps, first interval is massive; only last 5 should be used
    // Last 5 timestamps: 5000, 5500, 6000, 6500, 7000 → 4 intervals of 500 ms → 120 BPM
    const result = tapTempo([0, 5000, 5500, 6000, 6500, 7000]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(119);
    expect(result!).toBeLessThanOrEqual(121);
  });
});

// ---------------------------------------------------------------------------
// tapTempo — property-based
// ---------------------------------------------------------------------------

describe('tapTempo properties', () => {
  it('result is always in [MIN_BPM, MAX_BPM] or null', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 0, maxLength: 10 }),
        (rawTaps) => {
          // Make timestamps strictly increasing
          const taps = rawTaps.sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
          const result = tapTempo(taps);
          if (result === null) return true;
          return result >= MIN_BPM && result <= MAX_BPM;
        },
      ),
    );
  });

  it('evenly-spaced taps at known BPM yield that BPM (within rounding)', () => {
    // Test at a handful of "clean" BPMs where rounding won't cause issues
    const cleanBpms = [60, 80, 100, 120, 160, 200];
    for (const bpm of cleanBpms) {
      const intervalMs = 60_000 / bpm;
      const taps = [0, intervalMs, intervalMs * 2, intervalMs * 3, intervalMs * 4];
      const result = tapTempo(taps);
      expect(result).not.toBeNull();
      expect(Math.abs(result! - bpm)).toBeLessThanOrEqual(1);
    }
  });

  it('always returns null for fewer than 2 taps', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 10_000 }), { minLength: 0, maxLength: 1 }),
        (taps) => tapTempo(taps) === null,
      ),
    );
  });
});
