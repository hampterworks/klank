import * as fc from 'fast-check';
import {
  TUNINGS,
  TUNING_NAMES,
  tuningStrings,
  stringFrequency,
  tuningStringLabel,
  type TuningName,
} from './tuner.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_TUNING_NAMES = TUNING_NAMES as readonly TuningName[];

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('tuner unit tests', () => {
  describe('guitar-standard', () => {
    const strings = tuningStrings('guitar-standard');

    it('has 6 strings', () => {
      expect(strings).toHaveLength(6);
    });

    it('low E2 is ≈ 82.407 Hz', () => {
      expect(strings[0].frequency).toBeCloseTo(82.4069, 2);
    });

    it('B3 (5th string) is ≈ 246.94 Hz', () => {
      expect(strings[4].frequency).toBeCloseTo(246.94, 1);
    });

    it('high E4 (6th string) is ≈ 329.63 Hz', () => {
      expect(strings[5].frequency).toBeCloseTo(329.63, 1);
    });

    it('labels are E2 A2 D3 G3 B3 E4', () => {
      expect(strings.map((s) => s.label)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    });
  });

  describe('guitar-drop-d', () => {
    const strings = tuningStrings('guitar-drop-d');

    it('has 6 strings', () => {
      expect(strings).toHaveLength(6);
    });

    it('low D2 is ≈ 73.42 Hz', () => {
      expect(strings[0].frequency).toBeCloseTo(73.416, 2);
    });

    it('labels are D2 A2 D3 G3 B3 E4', () => {
      expect(strings.map((s) => s.label)).toEqual(['D2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    });
  });

  describe('guitar-half-step-down', () => {
    const strings = tuningStrings('guitar-half-step-down');

    it('has 6 strings', () => {
      expect(strings).toHaveLength(6);
    });

    it('labels are Eb2 Ab2 Db3 Gb3 Bb3 Eb4', () => {
      expect(strings.map((s) => s.label)).toEqual(['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4']);
    });

    it('low Eb2 is one semitone below E2', () => {
      const eStandard = tuningStrings('guitar-standard')[0].frequency;
      const ebDown = strings[0].frequency;
      // One semitone down: frequency ratio ≈ 2^(-1/12)
      expect(ebDown / eStandard).toBeCloseTo(Math.pow(2, -1 / 12), 9);
    });
  });

  describe('bass-standard', () => {
    const strings = tuningStrings('bass-standard');

    it('has 4 strings', () => {
      expect(strings).toHaveLength(4);
    });

    it('labels are E1 A1 D2 G2', () => {
      expect(strings.map((s) => s.label)).toEqual(['E1', 'A1', 'D2', 'G2']);
    });

    it('low E1 is ≈ 41.20 Hz', () => {
      expect(strings[0].frequency).toBeCloseTo(41.2034, 2);
    });
  });

  describe('bass-5-string', () => {
    const strings = tuningStrings('bass-5-string');

    it('has 5 strings', () => {
      expect(strings).toHaveLength(5);
    });

    it('low B0 is ≈ 30.868 Hz', () => {
      expect(strings[0].frequency).toBeCloseTo(30.868, 2);
    });

    it('labels are B0 E1 A1 D2 G2', () => {
      expect(strings.map((s) => s.label)).toEqual(['B0', 'E1', 'A1', 'D2', 'G2']);
    });
  });

  describe('A4 sanity check', () => {
    it('pitch class 9, octave 4 gives exactly 440 Hz', () => {
      expect(stringFrequency({ pitchClass: 9, octave: 4 })).toBeCloseTo(440, 9);
    });
  });

  describe('tuningStringLabel', () => {
    it('sharp pitch classes use flat names in tuning context', () => {
      // Eb = pitch class 3
      expect(tuningStringLabel({ pitchClass: 3, octave: 2 })).toBe('Eb2');
      // Ab = pitch class 8
      expect(tuningStringLabel({ pitchClass: 8, octave: 2 })).toBe('Ab2');
      // Db = pitch class 1
      expect(tuningStringLabel({ pitchClass: 1, octave: 3 })).toBe('Db3');
      // Gb = pitch class 6
      expect(tuningStringLabel({ pitchClass: 6, octave: 3 })).toBe('Gb3');
      // Bb = pitch class 10
      expect(tuningStringLabel({ pitchClass: 10, octave: 3 })).toBe('Bb3');
    });

    it('natural notes keep their names', () => {
      expect(tuningStringLabel({ pitchClass: 4, octave: 2 })).toBe('E2');
      expect(tuningStringLabel({ pitchClass: 9, octave: 4 })).toBe('A4');
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('tuner properties', () => {
  it('tuningStrings length matches TUNINGS strings array for every TuningName', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_TUNING_NAMES), (name) => {
        const result = tuningStrings(name);
        return result.length === TUNINGS[name].strings.length;
      }),
    );
  });

  it('every frequency in every tuning is positive', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_TUNING_NAMES), (name) => {
        return tuningStrings(name).every((s) => s.frequency > 0);
      }),
    );
  });

  it('raising a string octave by 1 doubles its frequency (within floating-point precision)', () => {
    // Sample over all pitch classes (0-11) and octaves (0-7)
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: 0, max: 7 }),
        (pitchClass, octave) => {
          const f1 = stringFrequency({ pitchClass, octave });
          const f2 = stringFrequency({ pitchClass, octave: octave + 1 });
          return Math.abs(f2 / f1 - 2) < 1e-9;
        },
      ),
    );
  });

  it('guitar-standard has exactly 6 strings', () => {
    expect(tuningStrings('guitar-standard')).toHaveLength(6);
  });

  it('bass-standard has exactly 4 strings', () => {
    expect(tuningStrings('bass-standard')).toHaveLength(4);
  });

  it('bass-5-string has exactly 5 strings', () => {
    expect(tuningStrings('bass-5-string')).toHaveLength(5);
  });

  it('TUNING_NAMES contains all 5 expected names', () => {
    expect(TUNING_NAMES).toHaveLength(5);
    expect(TUNING_NAMES).toContain('guitar-standard');
    expect(TUNING_NAMES).toContain('guitar-drop-d');
    expect(TUNING_NAMES).toContain('guitar-half-step-down');
    expect(TUNING_NAMES).toContain('bass-standard');
    expect(TUNING_NAMES).toContain('bass-5-string');
  });
});
