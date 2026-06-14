import { midiNoteToFrequency } from './audio.js';
import { pitchName, GUITAR_TUNING, BASS_TUNING } from '@klank/platform-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TuningName =
  | 'guitar-standard'
  | 'guitar-drop-d'
  | 'guitar-half-step-down'
  | 'bass-standard'
  | 'bass-5-string';

export type TuningString = { pitchClass: number; octave: number };

export type TuningDef = {
  name: TuningName;
  instrument: 'guitar' | 'bass';
  label: string;
  strings: readonly TuningString[];
};

// ---------------------------------------------------------------------------
// Tuning definitions (low → high)
// pitchClass: C=0, D=2, E=4, F=5, G=7, A=9, B=11
// Accidentals: Eb=3, Ab=8, Db=1, Gb=6, Bb=10
// ---------------------------------------------------------------------------

/**
 * Derive TuningString[] from a list of pitch classes and a starting octave.
 * Each string steps up from the previous one; when the next pitch class is
 * lower-or-equal (mod 12) to the previous (wraps around), the octave increments.
 */
function pitchClassesToStrings(
  pitchClasses: readonly number[],
  startOctave: number,
): TuningString[] {
  const result: TuningString[] = [];
  let octave = startOctave;
  for (let i = 0; i < pitchClasses.length; i++) {
    if (i > 0 && pitchClasses[i] <= pitchClasses[i - 1]) {
      octave++;
    }
    result.push({ pitchClass: pitchClasses[i], octave });
  }
  return result;
}

// guitar-standard and bass-standard derive from @klank/platform-api constants
// (GUITAR_TUNING = [4,9,2,7,11,4], BASS_TUNING = [4,9,2,7]) so the source of
// truth lives in one place. Octave numbers are tuner-local (platform-api has
// no octave information).
const GUITAR_STANDARD_STRINGS = pitchClassesToStrings(GUITAR_TUNING, 2);
const BASS_STANDARD_STRINGS = pitchClassesToStrings(BASS_TUNING, 1);

export const TUNINGS: Record<TuningName, TuningDef> = {
  'guitar-standard': {
    name: 'guitar-standard',
    instrument: 'guitar',
    label: 'Guitar — Standard (E A D G B E)',
    strings: GUITAR_STANDARD_STRINGS,
  },
  'guitar-drop-d': {
    name: 'guitar-drop-d',
    instrument: 'guitar',
    label: 'Guitar — Drop D (D A D G B E)',
    strings: [
      { pitchClass: 2, octave: 2 },  // D2
      { pitchClass: 9, octave: 2 },  // A2
      { pitchClass: 2, octave: 3 },  // D3
      { pitchClass: 7, octave: 3 },  // G3
      { pitchClass: 11, octave: 3 }, // B3
      { pitchClass: 4, octave: 4 },  // E4
    ],
  },
  'guitar-half-step-down': {
    name: 'guitar-half-step-down',
    instrument: 'guitar',
    label: 'Guitar — ½ Step Down (Eb Ab Db Gb Bb Eb)',
    strings: [
      { pitchClass: 3, octave: 2 },  // Eb2
      { pitchClass: 8, octave: 2 },  // Ab2
      { pitchClass: 1, octave: 3 },  // Db3
      { pitchClass: 6, octave: 3 },  // Gb3
      { pitchClass: 10, octave: 3 }, // Bb3
      { pitchClass: 3, octave: 4 },  // Eb4
    ],
  },
  'bass-standard': {
    name: 'bass-standard',
    instrument: 'bass',
    label: 'Bass — Standard (E A D G)',
    strings: BASS_STANDARD_STRINGS,
  },
  'bass-5-string': {
    name: 'bass-5-string',
    instrument: 'bass',
    label: 'Bass — 5-String (B E A D G)',
    strings: [
      { pitchClass: 11, octave: 0 }, // B0
      { pitchClass: 4, octave: 1 },  // E1
      { pitchClass: 9, octave: 1 },  // A1
      { pitchClass: 2, octave: 2 },  // D2
      { pitchClass: 7, octave: 2 },  // G2
    ],
  },
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Converts a TuningString to its frequency in Hz using equal temperament
 * (A4 = 440 Hz). MIDI note = 12 * (octave + 1) + pitchClass.
 *
 * Sanity checks:
 *   guitar low E2  → MIDI 40 → 82.41 Hz
 *   A4             → MIDI 69 → 440.00 Hz
 *   bass 5-string B0 → MIDI 23 → 30.87 Hz
 */
export function stringFrequency(s: TuningString): number {
  const midi = 12 * (s.octave + 1) + s.pitchClass;
  return midiNoteToFrequency(midi);
}

/**
 * Returns the note label for a TuningString, e.g. "E2", "Eb4", "D3".
 * Uses `pitchName` from @klank/platform-api (returns sharps form, e.g. "D#"
 * for pitch class 3; we remap those that are conventionally written as flats
 * in tuning contexts).
 */
const SHARP_TO_FLAT: Record<string, string> = {
  'A#': 'Bb',
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
};

export function tuningStringLabel(s: TuningString): string {
  const sharp = pitchName(s.pitchClass);
  const name = SHARP_TO_FLAT[sharp] ?? sharp;
  return `${name}${s.octave}`;
}

/**
 * Convenience function for the UI — returns all strings for a named tuning
 * with label, frequency, pitchClass and octave.
 */
export function tuningStrings(
  name: TuningName,
): { label: string; frequency: number; pitchClass: number; octave: number }[] {
  return TUNINGS[name].strings.map((s) => ({
    label: tuningStringLabel(s),
    frequency: stringFrequency(s),
    pitchClass: s.pitchClass,
    octave: s.octave,
  }));
}

/** All tuning names, for iteration and UI dropdowns. */
export const TUNING_NAMES: readonly TuningName[] = [
  'guitar-standard',
  'guitar-drop-d',
  'guitar-half-step-down',
  'bass-standard',
  'bass-5-string',
] as const;
