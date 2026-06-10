import type { ChordBarre, ChordVariant, Instrument } from './chord-diagrams.js'

// NOTE: keep this module free of runtime imports (type-only imports are fine).
// tools/chord-data/ imports it directly as a .ts file under Node's type
// stripping, which cannot resolve the workspace's `.js`-suffixed specifiers.

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

/** Roots in the order the chord JSON files enumerate them. */
export const CHORD_ROOTS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] as const

/** Alternate-bass intervals shipped as slash-chord keys, per quality.
 *  Major: 3rd, 5th, maj7 bass (C/B), b7 bass (A/G). Minor: b3rd, 5th, b7 bass (Am/G). */
export const SLASH_BASS_INTERVALS: Record<string, readonly number[]> = {
  '': [4, 7, 11, 10],
  m: [3, 7, 10],
}

/** Number of fret rows a chord diagram renders (see ChordDiagram.tsx). */
export const DIAGRAM_ROWS = 5
/** Maximum fret distance between lowest and highest fretted note (4-fret hand span). */
export const MAX_SPAN = 3
/** Highest absolute fret the data may use. */
export const MAX_FRET = 15

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const NOTE_PITCH: Record<string, number> = {
  A: 9, 'A#': 10, B: 11, C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8,
}

export type ParsedChord = { rootPitch: number; quality: string; bassPitch?: number }

/** Split a chord key (in sharps form) into root pitch, quality suffix, and
 *  optional slash-bass pitch (e.g. "Dm/F" → { rootPitch: 2, quality: 'm', bassPitch: 5 }). */
export function parseChordKey(key: string): ParsedChord | null {
  const slashIdx = key.indexOf('/')
  const base = slashIdx !== -1 ? key.slice(0, slashIdx) : key
  const bass = slashIdx !== -1 ? key.slice(slashIdx + 1) : undefined

  const root    = base[1] === '#' ? base.slice(0, 2) : base[0]
  const quality = base[1] === '#' ? base.slice(2)    : base.slice(1)
  const rootPitch = NOTE_PITCH[root]
  if (rootPitch === undefined || !(quality in CHORD_INTERVALS)) return null

  if (bass === undefined) return { rootPitch, quality }
  const bassPitch = NOTE_PITCH[bass]
  if (bassPitch === undefined) return null
  return { rootPitch, quality, bassPitch }
}

/** Pitch class name in sharps form (C=0). */
export function pitchName(pitch: number): string {
  return NOTE_NAMES[((pitch % 12) + 12) % 12]
}

/** Pitch classes a parsed chord may sound: chord tones plus the slash bass, if any. */
export function getAllowedPitches(parsed: ParsedChord): Set<number> {
  const allowed = new Set(CHORD_INTERVALS[parsed.quality].map((i) => (parsed.rootPitch + i) % 12))
  if (parsed.bassPitch !== undefined) allowed.add(parsed.bassPitch)
  return allowed
}

/** Pitch classes a variant must contain to be a complete chord.
 *  All chord tones are required; only 4-note qualities (7, m7, maj7) may omit the 5th. */
export function getRequiredPitches(parsed: ParsedChord): Set<number> {
  const intervals = CHORD_INTERVALS[parsed.quality]
  const fifthOptional = intervals.length === 4
  const required = new Set<number>()
  for (const interval of intervals) {
    if (fifthOptional && interval === 7) continue
    required.add((parsed.rootPitch + interval) % 12)
  }
  if (parsed.bassPitch !== undefined) required.add(parsed.bassPitch)
  return required
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
 * Returns the list of pitch classes in the variant that do not belong to the chord
 * (slash-bass notes count as belonging). An empty array means the notes are correct.
 */
export function getInvalidNotes(
  chordKey: string,
  variant: ChordVariant,
  tuning: readonly number[],
): InvalidNote[] {
  const parsed = parseChordKey(chordKey)
  if (!parsed) return []
  const allowed = getAllowedPitches(parsed)
  const errors: InvalidNote[] = []
  for (const pitch of getVariantNotes(variant, tuning)) {
    if (!allowed.has(pitch)) {
      errors.push({ name: pitchName(pitch), pitch })
    }
  }
  return errors
}

/** Every chord key the JSON data files must define, in file order:
 *  plain keys grouped by quality, then slash keys grouped by root. */
export function expectedChordKeys(): string[] {
  const keys: string[] = []
  for (const quality of Object.keys(CHORD_INTERVALS)) {
    for (const root of CHORD_ROOTS) keys.push(root + quality)
  }
  for (const root of CHORD_ROOTS) {
    for (const [quality, intervals] of Object.entries(SLASH_BASS_INTERVALS)) {
      const rootPitch = NOTE_PITCH[root]
      for (const interval of intervals) {
        keys.push(`${root}${quality}/${pitchName(rootPitch + interval)}`)
      }
    }
  }
  return keys
}

/** Indices of variants that repeat an earlier variant's frets and baseFret. */
export function findDuplicateVariants(variants: readonly ChordVariant[]): number[] {
  const seen = new Set<string>()
  const duplicates: number[] = []
  variants.forEach((variant, i) => {
    const signature = `${variant.frets.join(',')}|${variant.baseFret}`
    if (seen.has(signature)) duplicates.push(i)
    seen.add(signature)
  })
  return duplicates
}

export type VariantViolation = { rule: string; message: string }

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

function checkShape(variant: ChordVariant, tuning: readonly number[]): VariantViolation[] {
  const violations: VariantViolation[] = []
  const { frets, fingers, baseFret, barres } = variant
  if (!Array.isArray(frets) || frets.length !== tuning.length) {
    violations.push({ rule: 'shape', message: `frets must have ${tuning.length} entries` })
  }
  if (!Array.isArray(fingers) || fingers.length !== tuning.length) {
    violations.push({ rule: 'shape', message: `fingers must have ${tuning.length} entries` })
  }
  if (violations.length > 0) return violations

  frets.forEach((fret, i) => {
    if (!isInt(fret) || fret < -1 || fret > MAX_FRET) {
      violations.push({ rule: 'shape', message: `frets[${i}]=${fret} outside -1..${MAX_FRET}` })
    }
  })
  fingers.forEach((finger, i) => {
    if (!isInt(finger) || finger < 0 || finger > 4) {
      violations.push({ rule: 'shape', message: `fingers[${i}]=${finger} outside 0..4` })
    }
  })
  if (!isInt(baseFret) || baseFret < 1) {
    violations.push({ rule: 'shape', message: `baseFret=${baseFret} must be >= 1` })
  }
  if (!Array.isArray(barres)) {
    violations.push({ rule: 'shape', message: 'barres must be an array' })
  }
  return violations
}

function checkBarre(
  barre: ChordBarre,
  variant: ChordVariant,
  tuning: readonly number[],
): VariantViolation[] {
  const violations: VariantViolation[] = []
  const { frets, fingers, baseFret } = variant
  const { fret: row, fromString, toString } = barre

  if (!isInt(row) || row < 1 || row > DIAGRAM_ROWS) {
    violations.push({ rule: 'barre-consistency', message: `barre row ${row} outside 1..${DIAGRAM_ROWS}` })
    return violations
  }
  if (!isInt(fromString) || !isInt(toString) ||
      fromString < 0 || toString >= tuning.length || fromString >= toString) {
    violations.push({ rule: 'barre-consistency', message: `barre strings ${fromString}..${toString} invalid` })
    return violations
  }

  const absFret = baseFret + row - 1
  if (frets[fromString] !== absFret || frets[toString] !== absFret) {
    violations.push({
      rule: 'barre-consistency',
      message: `barre at fret ${absFret} must start and end on strings fretted there`,
    })
  }

  const barred: number[] = []
  for (let s = fromString; s <= toString; s++) {
    if (frets[s] < absFret) {
      violations.push({
        rule: 'barre-consistency',
        message: `string ${s} (fret ${frets[s]}) lies under the barre at fret ${absFret}`,
      })
    }
    if (frets[s] === absFret) barred.push(s)
  }
  if (barred.length < 2) {
    violations.push({ rule: 'barre-consistency', message: `barre at fret ${absFret} covers fewer than 2 strings` })
  }
  const barreFingers = new Set(barred.map((s) => fingers[s]))
  if (barreFingers.size > 1) {
    violations.push({ rule: 'barre-consistency', message: `barred strings use different fingers` })
  }
  return violations
}

/**
 * Validates a chord variant against every structural, musical, and playability
 * invariant the renderer and the data contract rely on. Returns one entry per
 * violated rule; an empty array means the variant is valid.
 */
export function validateChordVariant(
  chordKey: string,
  variant: ChordVariant,
  instrument: Instrument,
): VariantViolation[] {
  const tuning = INSTRUMENT_TUNING[instrument]
  const parsed = parseChordKey(chordKey)
  if (!parsed) return [{ rule: 'key', message: `unknown chord key "${chordKey}"` }]

  const shapeViolations = checkShape(variant, tuning)
  if (shapeViolations.length > 0) return shapeViolations

  const violations: VariantViolation[] = []
  const { frets, fingers, baseFret, barres } = variant
  const fretted = frets.filter((f) => f > 0)
  const soundingIdx = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i !== -1)

  // finger-presence: a finger is assigned exactly to the fretted strings
  frets.forEach((fret, i) => {
    if (fret > 0 && fingers[i] === 0) {
      violations.push({ rule: 'finger-presence', message: `string ${i} fretted at ${fret} has no finger` })
    }
    if (fret <= 0 && fingers[i] !== 0) {
      violations.push({ rule: 'finger-presence', message: `string ${i} is ${fret === 0 ? 'open' : 'muted'} but has finger ${fingers[i]}` })
    }
  })

  // window: every dot must land in the rendered 5-row window
  if (fretted.length === 0) {
    if (baseFret !== 1) {
      violations.push({ rule: 'window', message: `baseFret=${baseFret} with no fretted notes` })
    }
  } else {
    const min = Math.min(...fretted)
    const max = Math.max(...fretted)
    if (baseFret === 1) {
      if (max > DIAGRAM_ROWS) {
        violations.push({ rule: 'window', message: `fret ${max} outside rows 1..${DIAGRAM_ROWS} at baseFret 1` })
      }
    } else {
      if (baseFret !== min) {
        violations.push({ rule: 'window', message: `baseFret=${baseFret} but lowest fretted note is ${min}` })
      }
      if (max > baseFret + DIAGRAM_ROWS - 1) {
        violations.push({ rule: 'window', message: `fret ${max} outside window ${baseFret}..${baseFret + DIAGRAM_ROWS - 1}` })
      }
    }

    // span: must fit a hand
    if (max - min > MAX_SPAN) {
      violations.push({ rule: 'span', message: `fret span ${min}..${max} exceeds ${MAX_SPAN + 1} frets` })
    }
  }

  // mute-edges: muted strings only at the outside edges
  if (soundingIdx.length > 0) {
    for (let i = soundingIdx[0]; i <= soundingIdx[soundingIdx.length - 1]; i++) {
      if (frets[i] === -1) {
        violations.push({ rule: 'mute-edges', message: `muted string ${i} between sounding strings` })
      }
    }
  }

  // sounding-min: enough strings to voice the chord
  const minSounding = parsed.quality === '5' ? 2 : 3
  if (soundingIdx.length < minSounding) {
    violations.push({ rule: 'sounding-min', message: `only ${soundingIdx.length} sounding strings (need ${minSounding})` })
  }

  // notes-valid: every sounding note belongs to the chord
  for (const { name } of getInvalidNotes(chordKey, variant, tuning)) {
    violations.push({ rule: 'notes-valid', message: `note ${name} does not belong to ${chordKey}` })
  }

  // tones-complete: the chord contains all of its tones (5th omissible on 7th chords)
  const sounded = getVariantNotes(variant, tuning)
  for (const pitch of getRequiredPitches(parsed)) {
    if (!sounded.has(pitch)) {
      violations.push({ rule: 'tones-complete', message: `missing chord tone ${pitchName(pitch)}` })
    }
  }

  // bass-note: lowest sounding string plays the root (or the slash bass)
  if (soundingIdx.length > 0) {
    const lowest = soundingIdx[0]
    const expected = parsed.bassPitch ?? parsed.rootPitch
    const actual = (tuning[lowest] + frets[lowest]) % 12
    if (actual !== expected) {
      violations.push({
        rule: 'bass-note',
        message: `lowest note is ${pitchName(actual)}, expected ${pitchName(expected)}`,
      })
    }
  }

  // finger-reuse: a finger on several strings means a barre at one fret
  const stringsByFinger = new Map<number, number[]>()
  frets.forEach((fret, i) => {
    if (fret > 0 && fingers[i] > 0) {
      const list = stringsByFinger.get(fingers[i]) ?? []
      list.push(i)
      stringsByFinger.set(fingers[i], list)
    }
  })
  for (const [finger, strings] of stringsByFinger) {
    if (strings.length < 2) continue
    const fretsUsed = new Set(strings.map((s) => frets[s]))
    if (fretsUsed.size > 1) {
      violations.push({
        rule: 'finger-reuse',
        message: `finger ${finger} on different frets ${[...fretsUsed].join(', ')} without a barre`,
      })
      continue
    }
    const fret = frets[strings[0]]
    const row = fret - baseFret + 1
    const covering = barres.find(
      (b) => b.fret === row && b.fromString <= strings[0] && b.toString >= strings[strings.length - 1],
    )
    if (!covering) {
      violations.push({
        rule: 'finger-reuse',
        message: `finger ${finger} spans strings ${strings.join(', ')} at fret ${fret} but no barre covers them`,
      })
    }
  }

  // barre-consistency
  for (const barre of barres) {
    violations.push(...checkBarre(barre, variant, tuning))
  }

  // anatomy: finger numbers must not decrease as frets rise
  for (const i of soundingIdx) {
    for (const j of soundingIdx) {
      if (frets[i] > 0 && frets[j] > 0 && frets[i] < frets[j] && fingers[i] > fingers[j]) {
        violations.push({
          rule: 'anatomy',
          message: `finger ${fingers[i]} at fret ${frets[i]} below finger ${fingers[j]} at fret ${frets[j]}`,
        })
      }
    }
  }

  return violations
}
