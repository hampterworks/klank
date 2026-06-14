import { clamp, bpmToMs, midiNoteToFrequency } from './audio.js';
import * as fc from 'fast-check';

describe('@klank/audio smoke tests', () => {
  describe('clamp', () => {
    it('returns the value when it is within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('returns min when value is below range', () => {
      expect(clamp(-1, 0, 10)).toBe(0);
    });

    it('returns max when value is above range', () => {
      expect(clamp(11, 0, 10)).toBe(10);
    });

    it('always returns a value within [min, max] for any numbers (property)', () => {
      fc.assert(
        fc.property(
          fc.float({ noNaN: true }),
          fc.float({ noNaN: true }),
          fc.float({ noNaN: true }),
          (a, b, c) => {
            const [min, max] = [Math.min(b, c), Math.max(b, c)];
            const result = clamp(a, min, max);
            return result >= min && result <= max;
          },
        ),
      );
    });
  });

  describe('bpmToMs', () => {
    it('converts 60 bpm to 1000 ms', () => {
      expect(bpmToMs(60)).toBe(1000);
    });

    it('converts 120 bpm to 500 ms', () => {
      expect(bpmToMs(120)).toBe(500);
    });

    it('throws for zero or negative bpm', () => {
      expect(() => bpmToMs(0)).toThrow(RangeError);
      expect(() => bpmToMs(-1)).toThrow(RangeError);
    });
  });

  describe('midiNoteToFrequency', () => {
    it('returns 440 Hz for MIDI note 69 (A4)', () => {
      expect(midiNoteToFrequency(69)).toBeCloseTo(440, 5);
    });

    it('returns 880 Hz for MIDI note 81 (A5)', () => {
      expect(midiNoteToFrequency(81)).toBeCloseTo(880, 5);
    });

    it('returns 220 Hz for MIDI note 57 (A3)', () => {
      expect(midiNoteToFrequency(57)).toBeCloseTo(220, 5);
    });
  });
});
