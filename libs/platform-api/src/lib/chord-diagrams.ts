import { canonicalSuffix, formatChordSymbol, parseChordSymbol, parseNotePrefix } from './chord-symbol.js'
import { pitchName } from './chord-theory.js'

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

/** Respell a token's leading note in sharps form ("Bbm7..." → "A#m7...").
 *  Tokens that do not start with a note pass through unchanged. */
function sharpenToken(token: string): string {
  const note = parseNotePrefix(token)
  return note === null ? token : pitchName(note.pitch) + note.rest
}

/** Normalize a chord name to the sharps-based key used in the JSON data.
 *  Valid chord symbols get their root and bass respelled in sharps and their
 *  quality canonicalized (e.g. "Dm/Gb" → "Dm/F#", "D-7" → "Dm7", "Cø" →
 *  "Cm7b5", "CM7" → "Cmaj7"). Names the grammar rejects still get their note
 *  prefixes respelled so near-miss lookups stay stable. */
export function normalizeChordKey(chordName: string): string {
  const parsed = parseChordSymbol(chordName)
  if (parsed !== null) {
    return formatChordSymbol({ ...parsed, suffix: canonicalSuffix(parsed.suffix) })
  }
  const slashIdx = chordName.indexOf('/')
  if (slashIdx === -1) return sharpenToken(chordName)
  return `${sharpenToken(chordName.slice(0, slashIdx))}/${sharpenToken(chordName.slice(slashIdx + 1))}`
}

// Caches the in-flight promise, not the resolved map, so N tooltips mounting
// at once share a single fetch instead of each firing their own.
const cache = new Map<Instrument, Promise<ChordDiagramMap>>()

/** Clear the in-memory cache. Intended for use in tests only. */
export function clearChordDiagramCache(): void {
  cache.clear()
}

/** Fetch and parse chord diagram JSON for the given instrument.
 *  Results are cached at the module level — safe to call repeatedly.
 *  Returns an empty map on network or parse errors (failures are not cached,
 *  so a later call can retry). */
export function loadChordDiagrams(instrument: Instrument): Promise<ChordDiagramMap> {
  const cached = cache.get(instrument)
  if (cached) return cached

  const url = instrument === 'guitar' ? '/chords-guitar.json' : '/chords-bass.json'
  const loading = (async (): Promise<ChordDiagramMap> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
    return (await res.json()) as ChordDiagramMap
  })()

  cache.set(instrument, loading)
  return loading.catch(() => {
    cache.delete(instrument)
    return {}
  })
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
