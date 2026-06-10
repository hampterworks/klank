import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  normalizeChordKey,
  lookupChordDiagram,
  loadChordDiagrams,
  clearChordDiagramCache,
  type ChordDiagramMap,
  type ChordVariant,
} from './chord-diagrams.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeVariant = (strings = 6): ChordVariant => ({
  frets: Array.from({ length: strings }, () => 0),
  fingers: Array.from({ length: strings }, () => 0),
  baseFret: 1,
  barres: [],
})

const SHARP_ROOTS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
const FLAT_PAIRS: [string, string][] = [
  ['Bb', 'A#'],
  ['Db', 'C#'],
  ['Eb', 'D#'],
  ['Gb', 'F#'],
  ['Ab', 'G#'],
]

const noteArb = fc.constantFrom(...SHARP_ROOTS)
const suffixArb = fc.constantFrom('', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'dim', 'aug', '5')
const chordNameArb = fc.tuple(noteArb, suffixArb).map(([n, s]) => `${n}${s}`)

// ── normalizeChordKey ─────────────────────────────────────────────────────────

describe('normalizeChordKey', () => {
  it('is idempotent for any string', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (s) => {
        expect(normalizeChordKey(normalizeChordKey(s))).toBe(normalizeChordKey(s))
      }),
    )
  })

  it('preserves the slash-bass note for any chord/bass combination', () => {
    fc.assert(
      fc.property(
        chordNameArb,
        fc.constantFrom('G', 'B', 'D', 'F', 'A', 'C#'),
        (chord, bass) => {
          expect(normalizeChordKey(`${chord}/${bass}`)).toBe(`${chord}/${bass}`)
        },
      ),
    )
  })

  it('maps all flat roots to their sharp equivalents', () => {
    for (const [flat, sharp] of FLAT_PAIRS) {
      expect(normalizeChordKey(flat)).toBe(sharp)
      expect(normalizeChordKey(`${flat}m`)).toBe(`${sharp}m`)
      expect(normalizeChordKey(`${flat}maj7`)).toBe(`${sharp}maj7`)
    }
  })

  it('maps flat bass notes to their sharp equivalents', () => {
    for (const [flat, sharp] of FLAT_PAIRS) {
      expect(normalizeChordKey(`C/${flat}`)).toBe(`C/${sharp}`)
      expect(normalizeChordKey(`${flat}m/${flat}`)).toBe(`${sharp}m/${sharp}`)
    }
  })

  it('leaves sharp roots unchanged', () => {
    fc.assert(
      fc.property(chordNameArb, (name) => {
        expect(normalizeChordKey(name)).toBe(name)
      }),
    )
  })
})

// ── lookupChordDiagram ────────────────────────────────────────────────────────

describe('lookupChordDiagram', () => {
  it('returns array for known chords without throwing', () => {
    const map: ChordDiagramMap = { Am: [makeVariant()], C: [makeVariant(), makeVariant()] }
    fc.assert(
      fc.property(
        fc.constantFrom('Am', 'C', 'Am/G', 'Bbm', 'unknownXYZ', ''),
        (name) => {
          expect(() => lookupChordDiagram(map, name)).not.toThrow()
          expect(Array.isArray(lookupChordDiagram(map, name))).toBe(true)
        },
      ),
    )
  })

  it('returns empty array for unknown chord names', () => {
    const map: ChordDiagramMap = { Am: [makeVariant()] }
    fc.assert(
      fc.property(
        // exclude anything that legitimately resolves to "Am", incl. slash fallback
        fc.string({ maxLength: 30 }).filter((s) => normalizeChordKey(s).split('/')[0] !== 'Am'),
        (name) => {
          expect(lookupChordDiagram(map, name)).toHaveLength(0)
        },
      ),
    )
  })

  it('resolves flat names to their sharp equivalents in the map', () => {
    const variant = makeVariant()
    const map: ChordDiagramMap = { 'A#': [variant] }
    expect(lookupChordDiagram(map, 'Bb')).toEqual([variant])
    expect(lookupChordDiagram(map, 'A#')).toEqual([variant])
  })

  it('prefers the exact slash key and falls back to the plain root chord', () => {
    const plain = makeVariant()
    const slash = makeVariant()
    const map: ChordDiagramMap = { Am: [plain], 'Am/G': [slash] }
    expect(lookupChordDiagram(map, 'Am/G')).toEqual([slash])
    expect(lookupChordDiagram(map, 'Am/C')).toEqual([plain])
    expect(lookupChordDiagram(map, 'Am/Gb')).toEqual([plain])
  })

  it('returns the exact array stored in the map without copying', () => {
    const variants = [makeVariant()]
    const map: ChordDiagramMap = { Em: variants }
    expect(lookupChordDiagram(map, 'Em')).toBe(variants)
  })
})

// ── loadChordDiagrams ─────────────────────────────────────────────────────────

describe('loadChordDiagrams', () => {
  beforeEach(() => {
    clearChordDiagramCache()
    vi.restoreAllMocks()
  })

  it('returns an empty map when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const map = await loadChordDiagrams('guitar')
    expect(map).toEqual({})
  })

  it('returns an empty map when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    )
    const map = await loadChordDiagrams('bass')
    expect(map).toEqual({})
  })

  it('parses and returns the JSON on success', async () => {
    const mockData: ChordDiagramMap = { Am: [makeVariant()], C: [makeVariant()] }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) }),
    )
    const map = await loadChordDiagrams('guitar')
    expect(map).toEqual(mockData)
  })

  it('uses the correct URL per instrument', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', fetchMock)
    await loadChordDiagrams('guitar')
    await loadChordDiagrams('bass')
    const urls = fetchMock.mock.calls.map((c) => c[0] as string)
    expect(urls.some((u) => u.includes('guitar'))).toBe(true)
    expect(urls.some((u) => u.includes('bass'))).toBe(true)
  })
})
