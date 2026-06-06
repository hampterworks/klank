import type { ChordVariant, Instrument } from './chord-diagrams.js'

/** Open string pitches for each instrument, C=0, low-to-high string order. */
export const GUITAR_TUNING = [4, 9, 2, 7, 11, 4] as const  // E A D G B E
export const BASS_TUNING   = [4, 9, 2, 7]         as const  // E A D G

export const INSTRUMENT_TUNING: Record<Instrument, readonly number[]> = {
  guitar: GUITAR_TUNING,
  bass: BASS_TUNING,
}

/** Allowed semitone intervals above root for each chord quality suffix. */
export const CHORD_INTERVALS: Record<string, readonly number[]> = {
  '': [0, 4, 7],           // major
  m: [0, 3, 7],            // minor
  '7': [0, 4, 7, 10],      // dominant 7
  m7: [0, 3, 7, 10],       // minor 7
  maj7: [0, 4, 7, 11],     // major 7
  sus2: [0, 2, 7],         // suspended 2nd
  sus4: [0, 5, 7],         // suspended 4th
  dim: [0, 3, 6],          // diminished triad
  aug: [0, 4, 8],          // augmented triad
  '5': [0, 7],             // power chord
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const NOTE_PITCH: Record<string, number> = {
  A: 9, 'A#': 10, B: 11, C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8,
}

export type ParsedChord = { rootPitch: number; quality: string }

/** Split a chord key (in sharps form) into root pitch and quality suffix. */
export function parseChordKey(key: string): ParsedChord | null {
  const root    = key[1] === '#' ? key.slice(0, 2) : key[0]
  const quality = key[1] === '#' ? key.slice(2)    : key.slice(1)
  const rootPitch = NOTE_PITCH[root]
  if (rootPitch === undefined || !(quality in CHORD_INTERVALS)) return null
  return { rootPitch, quality }
}

/** Pitch classes (C=0) played by a variant; muted strings (-1) are excluded. */
export function getVariantNotes(variant: ChordVariant, tuning: readonly number[]): Set<number> {
  const notes = new Set<number>()
  for (let i = 0; i < tuning.length; i++) {
    const fret = variant.frets[i]
    if (fret === -1) continue
    notes.add((tuning[i] + fret) % 12)
  }
  return notes
}

export type InvalidNote = { name: string; pitch: number }

/**
 * Returns the list of pitch classes in the variant that do not belong to the chord.
 * An empty array means the variant is musically correct.
 */
export function getInvalidNotes(
  chordKey: string,
  variant: ChordVariant,
  tuning: readonly number[],
): InvalidNote[] {
  const parsed = parseChordKey(chordKey)
  if (!parsed) return []
  const { rootPitch, quality } = parsed
  const intervals = CHORD_INTERVALS[quality]
  const allowed = new Set(intervals.map((i) => (rootPitch + i) % 12))
  const errors: InvalidNote[] = []
  for (const pitch of getVariantNotes(variant, tuning)) {
    if (!allowed.has(pitch)) {
      errors.push({ name: NOTE_NAMES[pitch], pitch })
    }
  }
  return errors
}
