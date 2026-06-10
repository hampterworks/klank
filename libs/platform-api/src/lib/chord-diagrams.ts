export type Instrument = 'guitar' | 'bass'

export type ChordBarre = {
  fret: number
  fromString: number
  toString: number
}

export type ChordVariant = {
  frets: number[]
  fingers: number[]
  baseFret: number
  barres: ChordBarre[]
}

export type ChordDiagramMap = Record<string, ChordVariant[]>

const FLAT_TO_SHARP: Record<string, string> = {
  Bb: 'A#',
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
}

/** Map a flat-spelled note prefix to its sharp equivalent ("Bb..." → "A#..."). */
function sharpen(note: string): string {
  const twoChar = note.slice(0, 2)
  return FLAT_TO_SHARP[twoChar] ? FLAT_TO_SHARP[twoChar] + note.slice(2) : note
}

/** Normalize a chord name to the sharps-based key used in the JSON data.
 *  Keeps slash-bass notes and maps flat roots and bass notes to sharps
 *  (e.g. "Dm/Gb" → "Dm/F#"). */
export function normalizeChordKey(chordName: string): string {
  const slashIdx = chordName.indexOf('/')
  if (slashIdx === -1) return sharpen(chordName)
  return `${sharpen(chordName.slice(0, slashIdx))}/${sharpen(chordName.slice(slashIdx + 1))}`
}

const cache = new Map<Instrument, ChordDiagramMap>()

/** Clear the in-memory cache. Intended for use in tests only. */
export function clearChordDiagramCache(): void {
  cache.clear()
}

/** Fetch and parse chord diagram JSON for the given instrument.
 *  Results are cached at the module level — safe to call repeatedly.
 *  Returns an empty map on network or parse errors. */
export async function loadChordDiagrams(instrument: Instrument): Promise<ChordDiagramMap> {
  const cached = cache.get(instrument)
  if (cached) return cached

  try {
    const url = instrument === 'guitar' ? '/chords-guitar.json' : '/chords-bass.json'
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = (await res.json()) as ChordDiagramMap
    cache.set(instrument, data)
    return data
  } catch {
    return {}
  }
}

/** Look up chord variants from a pre-loaded map.
 *  Normalizes the chord name; slash chords missing from the map fall back to
 *  the plain root chord (e.g. "Am/B" → "Am"). Returns an empty array when not
 *  found. Uses hasOwnProperty to guard against prototype property names. */
export function lookupChordDiagram(map: ChordDiagramMap, chordName: string): ChordVariant[] {
  const key = normalizeChordKey(chordName)
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]
  const slashIdx = key.indexOf('/')
  if (slashIdx !== -1) {
    const plain = key.slice(0, slashIdx)
    if (Object.prototype.hasOwnProperty.call(map, plain)) return map[plain]
  }
  return []
}
