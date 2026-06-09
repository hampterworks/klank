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

/** Normalize a chord name to the sharps-based key used in the JSON data.
 *  Strips slash-bass notes and maps flat roots to their sharp equivalents. */
export function normalizeChordKey(chordName: string): string {
  const slashIdx = chordName.indexOf('/')
  const base = slashIdx !== -1 ? chordName.slice(0, slashIdx) : chordName

  // Try two-char root first (e.g. "Bb", "C#"), then single char
  const twoChar = base.slice(0, 2)
  if (FLAT_TO_SHARP[twoChar]) {
    return FLAT_TO_SHARP[twoChar] + base.slice(2)
  }

  return base
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
 *  Normalizes the chord name and returns an empty array when not found.
 *  Uses hasOwnProperty to guard against prototype property names (e.g. "valueOf"). */
export function lookupChordDiagram(map: ChordDiagramMap, chordName: string): ChordVariant[] {
  const key = normalizeChordKey(chordName)
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : []
}
