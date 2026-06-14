// NOTE: keep this module free of runtime imports (type-only imports are fine).
// tools/chord-data/ imports it directly as a .ts file under Node's type
// stripping, which cannot resolve the workspace's `.js`-suffixed specifiers.

export type ScaleCategory =
  | 'Major modes'
  | 'Melodic minor modes'
  | 'Harmonic minor'
  | 'Pentatonic / Blues'
  | 'Symmetric'

export type ScaleDefinition = {
  id: string
  name: string
  category: ScaleCategory
  intervals: readonly number[]
  degrees: readonly string[]
  modeOf?: string
  modeDegree?: number
}

export type FretCell = { pitch: number; degree: string; isRoot: boolean }

// Private note names in sharps form (C=0). Not exported to avoid barrel collision
// with NOTE_PITCH / pitchName in chord-theory.ts.
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const SCALES: readonly ScaleDefinition[] = [
  // ── Major modes ──────────────────────────────────────────────────────────────
  {
    id: 'ionian',
    name: 'Ionian (Major)',
    category: 'Major modes',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['1', '2', '3', '4', '5', '6', '7'],
    modeDegree: 1,
  },
  {
    id: 'dorian',
    name: 'Dorian',
    category: 'Major modes',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'],
    modeOf: 'ionian',
    modeDegree: 2,
  },
  {
    id: 'phrygian',
    name: 'Phrygian',
    category: 'Major modes',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    modeOf: 'ionian',
    modeDegree: 3,
  },
  {
    id: 'lydian',
    name: 'Lydian',
    category: 'Major modes',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ['1', '2', '3', '#4', '5', '6', '7'],
    modeOf: 'ionian',
    modeDegree: 4,
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    category: 'Major modes',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ['1', '2', '3', '4', '5', '6', 'b7'],
    modeOf: 'ionian',
    modeDegree: 5,
  },
  {
    id: 'aeolian',
    name: 'Aeolian (Natural Minor)',
    category: 'Major modes',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    modeOf: 'ionian',
    modeDegree: 6,
  },
  {
    id: 'locrian',
    name: 'Locrian',
    category: 'Major modes',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    modeOf: 'ionian',
    modeDegree: 7,
  },
  // ── Melodic minor modes ───────────────────────────────────────────────────────
  {
    id: 'melodic-minor',
    name: 'Melodic Minor',
    category: 'Melodic minor modes',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degrees: ['1', '2', 'b3', '4', '5', '6', '7'],
    modeDegree: 1,
  },
  {
    id: 'dorian-b2',
    name: 'Dorian b2',
    category: 'Melodic minor modes',
    intervals: [0, 1, 3, 5, 7, 9, 10],
    degrees: ['1', 'b2', 'b3', '4', '5', '6', 'b7'],
    modeOf: 'melodic-minor',
    modeDegree: 2,
  },
  {
    id: 'lydian-augmented',
    name: 'Lydian Augmented',
    category: 'Melodic minor modes',
    intervals: [0, 2, 4, 6, 8, 9, 11],
    degrees: ['1', '2', '3', '#4', '#5', '6', '7'],
    modeOf: 'melodic-minor',
    modeDegree: 3,
  },
  {
    id: 'lydian-dominant',
    name: 'Lydian Dominant',
    category: 'Melodic minor modes',
    intervals: [0, 2, 4, 6, 7, 9, 10],
    degrees: ['1', '2', '3', '#4', '5', '6', 'b7'],
    modeOf: 'melodic-minor',
    modeDegree: 4,
  },
  {
    id: 'mixolydian-b6',
    name: 'Mixolydian b6',
    category: 'Melodic minor modes',
    intervals: [0, 2, 4, 5, 7, 8, 10],
    degrees: ['1', '2', '3', '4', '5', 'b6', 'b7'],
    modeOf: 'melodic-minor',
    modeDegree: 5,
  },
  {
    id: 'locrian-nat2',
    name: 'Locrian ♮2 (Half-Diminished)',
    category: 'Melodic minor modes',
    intervals: [0, 2, 3, 5, 6, 8, 10],
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', 'b7'],
    modeOf: 'melodic-minor',
    modeDegree: 6,
  },
  {
    id: 'altered',
    name: 'Altered (Super Locrian)',
    category: 'Melodic minor modes',
    intervals: [0, 1, 3, 4, 6, 8, 10],
    degrees: ['1', 'b9', '#9', '3', 'b5', '#5', 'b7'],
    modeOf: 'melodic-minor',
    modeDegree: 7,
  },
  // ── Harmonic minor ────────────────────────────────────────────────────────────
  {
    id: 'harmonic-minor',
    name: 'Harmonic Minor',
    category: 'Harmonic minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'],
    modeDegree: 1,
  },
  {
    id: 'phrygian-dominant',
    name: 'Phrygian Dominant',
    category: 'Harmonic minor',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    degrees: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
    modeOf: 'harmonic-minor',
    modeDegree: 5,
  },
  // ── Pentatonic / Blues ────────────────────────────────────────────────────────
  {
    id: 'major-pentatonic',
    name: 'Major Pentatonic',
    category: 'Pentatonic / Blues',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['1', '2', '3', '5', '6'],
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor Pentatonic',
    category: 'Pentatonic / Blues',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['1', 'b3', '4', '5', 'b7'],
  },
  {
    id: 'blues-minor',
    name: 'Minor Blues',
    category: 'Pentatonic / Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    degrees: ['1', 'b3', '4', 'b5', '5', 'b7'],
  },
  {
    id: 'blues-major',
    name: 'Major Blues',
    category: 'Pentatonic / Blues',
    intervals: [0, 2, 3, 4, 7, 9],
    degrees: ['1', '2', 'b3', '3', '5', '6'],
  },
  // ── Symmetric ─────────────────────────────────────────────────────────────────
  {
    id: 'whole-tone',
    name: 'Whole Tone',
    category: 'Symmetric',
    intervals: [0, 2, 4, 6, 8, 10],
    degrees: ['1', '2', '3', '#4', '#5', 'b7'],
  },
  {
    id: 'diminished-wh',
    name: 'Diminished (Whole-Half)',
    category: 'Symmetric',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    degrees: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'],
  },
  {
    id: 'diminished-hw',
    name: 'Diminished (Half-Whole)',
    category: 'Symmetric',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    degrees: ['1', 'b9', '#9', '3', '#4', '5', '6', 'b7'],
  },
  {
    id: 'chromatic',
    name: 'Chromatic',
    category: 'Symmetric',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    degrees: ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'],
  },
] as const

/** Map of chord quality suffix → ordered list of compatible scale ids. */
export const CHORD_SCALE_MAP: Record<string, readonly string[]> = {
  '': ['ionian', 'lydian', 'major-pentatonic'],
  m: ['dorian', 'aeolian', 'phrygian', 'minor-pentatonic'],
  '7': ['mixolydian', 'lydian-dominant', 'altered', 'diminished-hw'],
  m7: ['dorian', 'aeolian', 'phrygian'],
  maj7: ['ionian', 'lydian'],
  sus2: ['mixolydian', 'dorian', 'major-pentatonic'],
  sus4: ['mixolydian', 'dorian'],
  dim: ['locrian', 'diminished-wh', 'locrian-nat2'],
  aug: ['whole-tone', 'lydian-augmented'],
  '5': ['minor-pentatonic', 'major-pentatonic', 'mixolydian'],
  m7b5: ['locrian-nat2', 'locrian'],
  dim7: ['diminished-wh'],
  '6': ['ionian', 'major-pentatonic', 'lydian'],
  m6: ['dorian', 'melodic-minor'],
  '69': ['ionian', 'major-pentatonic', 'lydian'],
  add9: ['ionian', 'lydian', 'major-pentatonic'],
  '9': ['mixolydian', 'lydian-dominant'],
  m9: ['dorian', 'aeolian'],
  maj9: ['ionian', 'lydian'],
  '7b5': ['lydian-dominant', 'altered', 'whole-tone'],
  '7#5': ['altered', 'whole-tone'],
  '7b9': ['diminished-hw', 'altered', 'phrygian-dominant'],
  '7#9': ['altered', 'diminished-hw'],
  '11': ['mixolydian'],
  m11: ['dorian', 'aeolian'],
  '13': ['mixolydian', 'lydian-dominant'],
  m13: ['dorian'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOD12 = (n: number) => ((n % 12) + 12) % 12

/** All pitch classes (0..11) sounded by this scale when rooted at rootPitch. */
export function getScalePitches(rootPitch: number, scale: ScaleDefinition): number[] {
  return scale.intervals.map((interval) => MOD12(rootPitch + interval))
}

/** Map from pitch class (0..11) → scale degree label for this root + scale. */
export function getDegreeByPitch(rootPitch: number, scale: ScaleDefinition): Map<number, string> {
  const map = new Map<number, string>()
  for (let i = 0; i < scale.intervals.length; i++) {
    map.set(MOD12(rootPitch + scale.intervals[i]), scale.degrees[i])
  }
  return map
}

/** Look up a scale by its stable kebab id. */
export function getScaleById(id: string): ScaleDefinition | undefined {
  return SCALES.find((s) => s.id === id)
}

/** All ScaleDefinitions recommended for a given chord quality suffix. */
export function scalesForQuality(quality: string): ScaleDefinition[] {
  return (CHORD_SCALE_MAP[quality] ?? [])
    .map(getScaleById)
    .filter((scale): scale is ScaleDefinition => scale !== undefined)
}

/**
 * Build a fretboard grid for a given root + scale + tuning.
 *
 * Returns a 2-D array [string][fret] where each cell is either null (pitch not
 * in scale) or a FretCell { pitch, degree, isRoot }.
 *
 * @param tuning  Open-string pitches, low-to-high string order (e.g. GUITAR_TUNING).
 * @param fretCount  Number of frets to include (columns = fretCount + 1, fret 0 = open).
 */
export function getScaleFretboard(
  rootPitch: number,
  scale: ScaleDefinition,
  tuning: readonly number[],
  fretCount = 12,
): (FretCell | null)[][] {
  const degreeMap = getDegreeByPitch(rootPitch, scale)
  const root = MOD12(rootPitch)
  return tuning.map((open) => {
    const row: (FretCell | null)[] = []
    for (let fret = 0; fret <= fretCount; fret++) {
      const pitch = MOD12(open + fret)
      const degree = degreeMap.get(pitch)
      if (degree === undefined) {
        row.push(null)
      } else {
        row.push({ pitch, degree, isRoot: pitch === root })
      }
    }
    return row
  })
}

/**
 * Candidate position start frets for a scale: the frets (0..11, ascending)
 * where the root lands on the lowest string. Each marks a playable hand
 * position anchored on the root; the renderer labels the window itself.
 */
export function getScalePositions(
  rootPitch: number,
  tuning: readonly number[],
): number[] {
  const root = MOD12(rootPitch)
  const lowestOpen = tuning[0]
  const positions: number[] = []
  for (let fret = 0; fret <= 11; fret++) {
    if (MOD12(lowestOpen + fret) === root) positions.push(fret)
  }
  return positions
}

/**
 * For each scale degree, attempt to build a diatonic triad (stack of 3rds)
 * and classify it as major (''), minor ('m'), diminished ('dim'), or
 * augmented ('aug').  Returns one entry per scale degree; chordKey is null
 * when the intervals do not form a recognised tertian triad.
 *
 * NOTE: pitchName is needed here but scales.ts must stay runtime-import-free.
 * A private NOTE_NAMES constant is used in place of importing from chord-theory.
 */
export function getDiatonicTriads(
  rootPitch: number,
  scale: ScaleDefinition,
): { degree: string; chordKey: string | null }[] {
  const pitches = getScalePitches(rootPitch, scale)
  const n = pitches.length
  const result: { degree: string; chordKey: string | null }[] = []

  for (let i = 0; i < n; i++) {
    const root = pitches[i]
    const third = pitches[(i + 2) % n]
    const fifth = pitches[(i + 4) % n]

    const thirdInterval = MOD12(third - root)
    const fifthInterval = MOD12(fifth - root)

    let quality: string | null = null
    if (thirdInterval === 3 && fifthInterval === 7) quality = 'm'
    else if (thirdInterval === 4 && fifthInterval === 7) quality = ''
    else if (thirdInterval === 3 && fifthInterval === 6) quality = 'dim'
    else if (thirdInterval === 4 && fifthInterval === 8) quality = 'aug'

    result.push({
      degree: scale.degrees[i],
      chordKey: quality !== null ? NOTE_NAMES[root] + quality : null,
    })
  }

  return result
}
