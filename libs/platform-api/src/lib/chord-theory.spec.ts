import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ChordVariant, Instrument } from './chord-diagrams.js'
import {
  CHORD_INTERVALS,
  CHORD_QUALITIES,
  CHORD_ROOTS,
  DIAGRAM_ROWS,
  INSTRUMENT_TUNING,
  MAX_FRET,
  expectedChordKeys,
  findDuplicateVariants,
  getAllowedPitches,
  getRequiredPitches,
  parseChordKey,
  pitchName,
  validateChordVariant,
} from './chord-theory.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const variant = (partial: Partial<ChordVariant>): ChordVariant => ({
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [0, 0, 0, 0, 0, 0],
  baseFret: 1,
  barres: [],
  ...partial,
})

/** Open C major — canonical, fully valid. */
const C_OPEN = variant({ frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] })

/** F major barre — canonical, fully valid, no open strings (transposable). */
const F_BARRE = variant({
  frets: [1, 3, 3, 2, 1, 1],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 1, fromString: 0, toString: 5 }],
})

/** B minor barre — canonical, fully valid, no open strings (transposable). */
const BM_BARRE = variant({
  frets: [-1, 2, 4, 4, 3, 2],
  fingers: [0, 1, 3, 4, 2, 1],
  baseFret: 2,
  barres: [{ fret: 1, fromString: 1, toString: 5 }],
})

type Fixture = { key: string; v: ChordVariant; instrument: Instrument }

/** Canonical shapes, all asserted valid below; mutation properties start here. */
const FIXTURES: Fixture[] = [
  { key: 'C', v: C_OPEN, instrument: 'guitar' },
  { key: 'F', v: F_BARRE, instrument: 'guitar' },
  { key: 'Bm', v: BM_BARRE, instrument: 'guitar' },
  { key: 'D', v: variant({ frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] }), instrument: 'guitar' },
  { key: 'G', v: variant({ frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] }), instrument: 'guitar' },
  { key: 'C7', v: variant({ frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] }), instrument: 'guitar' },
  { key: 'G/B', v: variant({ frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 2, 3] }), instrument: 'guitar' },
  { key: 'D/F#', v: variant({ frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] }), instrument: 'guitar' },
  { key: 'C', v: { frets: [-1, 3, 2, 0], fingers: [0, 2, 1, 0], baseFret: 1, barres: [] }, instrument: 'bass' },
]

const rules = (key: string, v: ChordVariant, instrument: Instrument = 'guitar') =>
  validateChordVariant(key, v, instrument).map((x) => x.rule)

const clone = (v: ChordVariant): ChordVariant => structuredClone(v)

const lowestSoundingPitch = (f: Fixture): number => {
  const tuning = INSTRUMENT_TUNING[f.instrument]
  const lowest = f.v.frets.findIndex((fret) => fret >= 0)
  return (tuning[lowest] + f.v.frets[lowest]) % 12
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const rootArb = fc.constantFrom(...CHORD_ROOTS)
const qualityArb = fc.constantFrom(...CHORD_QUALITIES)
const knownKeyArb = fc.constantFrom(...expectedChordKeys())
const fixtureArb = fc.constantFrom(...FIXTURES)
const instrumentArb = fc.constantFrom<Instrument>('guitar', 'bass')

const malformedVariantArb = fc.record({
  frets: fc.array(fc.integer({ min: -3, max: 20 }), { minLength: 0, maxLength: 8 }),
  fingers: fc.array(fc.integer({ min: -1, max: 6 }), { minLength: 0, maxLength: 8 }),
  baseFret: fc.integer({ min: -2, max: 20 }),
  barres: fc.array(
    fc.record({
      fret: fc.integer({ min: -2, max: 10 }),
      fromString: fc.integer({ min: -2, max: 8 }),
      toString: fc.integer({ min: -2, max: 8 }),
    }),
    { maxLength: 3 },
  ),
})

const anyKeyArb = fc.oneof(knownKeyArb, fc.string({ maxLength: 8 }))

// ── parseChordKey ─────────────────────────────────────────────────────────────

describe('parseChordKey', () => {
  it('round-trips every constructible root + quality + optional slash bass', () => {
    fc.assert(
      fc.property(rootArb, qualityArb, fc.option(rootArb, { nil: undefined }), (root, quality, bass) => {
        const key = `${root}${quality}${bass !== undefined ? `/${bass}` : ''}`
        const parsed = parseChordKey(key)
        expect(parsed).not.toBeNull()
        expect(pitchName(parsed!.rootPitch)).toBe(root)
        expect(parsed!.quality).toBe(quality)
        if (bass !== undefined) {
          expect(pitchName(parsed!.bassPitch!)).toBe(bass)
        } else {
          expect(parsed!.bassPitch).toBeUndefined()
        }
      }),
    )
  })

  it('rejects unknown roots, qualities, and bass notes', () => {
    expect(parseChordKey('H')).toBeNull()
    expect(parseChordKey('Cfoo')).toBeNull()
    expect(parseChordKey('C/H')).toBeNull()
    expect(parseChordKey('')).toBeNull()
  })
})

// ── chord tone sets ───────────────────────────────────────────────────────────

describe('getAllowedPitches / getRequiredPitches', () => {
  it('for every shipped key: required ⊆ allowed, root and slash bass always required, only 7th chords may drop only the 5th', () => {
    fc.assert(
      fc.property(knownKeyArb, (key) => {
        const parsed = parseChordKey(key)!
        const allowed = getAllowedPitches(parsed)
        const required = getRequiredPitches(parsed)

        for (const pitch of required) expect(allowed).toContain(pitch)
        expect(required).toContain(parsed.rootPitch)
        if (parsed.bassPitch !== undefined) {
          expect(required).toContain(parsed.bassPitch)
          expect(allowed).toContain(parsed.bassPitch)
        }

        const optional = [...allowed].filter((p) => !required.has(p))
        if (CHORD_INTERVALS[parsed.quality].length === 4) {
          expect(optional).toEqual([(parsed.rootPitch + 7) % 12])
        } else {
          expect(optional).toEqual([])
        }
      }),
    )
  })

  it('slash bass outside the chord joins both sets (C/B)', () => {
    const parsed = parseChordKey('C/B')!
    expect(getAllowedPitches(parsed)).toEqual(new Set([0, 4, 7, 11]))
    expect(getRequiredPitches(parsed)).toEqual(new Set([0, 4, 7, 11]))
  })
})

// ── expectedChordKeys ─────────────────────────────────────────────────────────

describe('expectedChordKeys', () => {
  it('returns 120 plain + 84 slash keys, unique, all parseable', () => {
    const keys = expectedChordKeys()
    expect(keys).toHaveLength(204)
    expect(new Set(keys).size).toBe(204)
    for (const key of keys) expect(parseChordKey(key), key).not.toBeNull()
  })

  it('contains the common alternate-bass chords', () => {
    const keys = new Set(expectedChordKeys())
    for (const key of ['G/B', 'D/F#', 'Dm/F', 'C/B', 'C/E', 'C/G', 'Am/G', 'Em/D', 'A/C#']) {
      expect(keys.has(key), key).toBe(true)
    }
  })
})

// ── findDuplicateVariants ─────────────────────────────────────────────────────

describe('findDuplicateVariants', () => {
  const fretsArb = fc.array(fc.integer({ min: -1, max: MAX_FRET }), { minLength: 4, maxLength: 6 })

  it('flags exactly the variants repeating an earlier frets/baseFret pair', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fretsArb, { minLength: 1, maxLength: 5, selector: (f) => f.join(',') }), fc.nat(), (fretsList, pick) => {
        const variants = fretsList.map((frets) => variant({ frets }))
        expect(findDuplicateVariants(variants)).toEqual([])
        const copied = [...variants, clone(variants[pick % variants.length])]
        expect(findDuplicateVariants(copied)).toEqual([variants.length])
      }),
    )
  })
})

// ── validateChordVariant: canonical shapes are valid ──────────────────────────

describe('validateChordVariant accepts', () => {
  it.each(FIXTURES.map((f) => [`${f.key} (${f.instrument})`, f] as const))('%s', (_label, f) => {
    expect(validateChordVariant(f.key, f.v, f.instrument)).toEqual([])
  })

  it('every transposition of a barre shape stays valid (movable-shape law)', () => {
    const barreFixtureArb = fc.constantFrom(
      { key: 'F', v: F_BARRE },
      { key: 'Bm', v: BM_BARRE },
    )
    fc.assert(
      fc.property(barreFixtureArb, fc.integer({ min: 0, max: 8 }), ({ key, v }, semitones) => {
        const parsed = parseChordKey(key)!
        const frets = v.frets.map((f) => (f > 0 ? f + semitones : f))
        const fretted = frets.filter((f) => f > 0)
        const baseFret = Math.max(...fretted) <= DIAGRAM_ROWS ? 1 : Math.min(...fretted)
        const barres = v.barres.map((b) => ({
          ...b,
          fret: v.baseFret + b.fret - 1 + semitones - baseFret + 1,
        }))
        const transposedKey = pitchName(parsed.rootPitch + semitones) + parsed.quality
        const transposed = { frets, fingers: v.fingers, baseFret, barres }
        expect(validateChordVariant(transposedKey, transposed, 'guitar')).toEqual([])
      }),
    )
  })
})

// ── validateChordVariant: mutation properties (one per mechanisable rule) ─────

describe('validateChordVariant rejects any', () => {
  it('finger on a non-fretted string, or fretted string without a finger (finger-presence)', () => {
    fc.assert(
      fc.property(fixtureArb, fc.nat(), fc.integer({ min: 1, max: 4 }), (f, sRaw, finger) => {
        const v = clone(f.v)
        const s = sRaw % v.frets.length
        v.fingers[s] = v.frets[s] > 0 ? 0 : finger
        expect(rules(f.key, v, f.instrument)).toContain('finger-presence')
      }),
    )
  })

  it('shape whose dots fall outside the rendered window (window)', () => {
    fc.assert(
      fc.property(fixtureArb, (f) => {
        if (f.v.baseFret !== 1) return
        const v = clone(f.v)
        v.frets = v.frets.map((fret) => (fret > 0 ? fret + DIAGRAM_ROWS : fret))
        expect(rules(f.key, v, f.instrument)).toContain('window')
      }),
    )
  })

  it('shape stretched past a hand span (span)', () => {
    fc.assert(
      fc.property(fixtureArb, (f) => {
        const v = clone(f.v)
        const max = Math.max(...v.frets)
        v.frets[v.frets.indexOf(max)] = max + 5
        expect(rules(f.key, v, f.instrument)).toContain('span')
      }),
    )
  })

  it('muted string between sounding strings (mute-edges)', () => {
    fc.assert(
      fc.property(fixtureArb, fc.nat(), (f, pick) => {
        const v = clone(f.v)
        const sounding = v.frets.map((fret, i) => (fret >= 0 ? i : -1)).filter((i) => i !== -1)
        const interior = sounding.slice(1, -1)
        const s = interior[pick % interior.length]
        v.frets[s] = -1
        v.fingers[s] = 0
        expect(rules(f.key, v, f.instrument)).toContain('mute-edges')
      }),
    )
  })

  it('shape whose lowest note is not the expected bass (bass-note)', () => {
    fc.assert(
      fc.property(fixtureArb, rootArb, (f, newRoot) => {
        if (f.key.includes('/')) return // slash bass stays correct when the root moves
        const quality = parseChordKey(f.key)!.quality
        const newRootPitch = parseChordKey(newRoot)!.rootPitch
        if (newRootPitch === lowestSoundingPitch(f)) return
        expect(rules(`${newRoot}${quality}`, f.v, f.instrument)).toContain('bass-note')
      }),
    )
  })

  it('fingering with a lower finger on a higher fret (anatomy)', () => {
    fc.assert(
      fc.property(fixtureArb, fc.nat(), fc.nat(), (f, aRaw, bRaw) => {
        const fretted = f.v.frets.map((fret, i) => (fret > 0 ? i : -1)).filter((i) => i !== -1)
        const a = fretted[aRaw % fretted.length]
        const b = fretted[bRaw % fretted.length]
        if (f.v.frets[a] === f.v.frets[b]) return
        const v = clone(f.v)
        ;[v.fingers[a], v.fingers[b]] = [v.fingers[b], v.fingers[a]]
        expect(rules(f.key, v, f.instrument)).toContain('anatomy')
      }),
    )
  })
})

// ── validateChordVariant: crafted examples for the remaining rules ────────────
// These document the exact real-world bugs found in the AI-generated data.

describe('validateChordVariant rejects', () => {
  it('key: unknown chord key', () => {
    expect(rules('H7b13', C_OPEN)).toContain('key')
  })

  it('shape: wrong array length / out-of-range values', () => {
    expect(rules('C', variant({ frets: [0, 0, 0, 0, 0] }))).toContain('shape')
    expect(rules('C', variant({ frets: [-2, 3, 2, 0, 1, 0] }))).toContain('shape')
    expect(rules('C', { ...C_OPEN, baseFret: 0 })).toContain('shape')
    expect(rules('C', { ...C_OPEN, fingers: [0, 5, 2, 0, 1, 0] })).toContain('shape')
  })

  it('sounding-min: too few sounding strings', () => {
    const thin = variant({ frets: [-1, 3, 2, -1, -1, -1], fingers: [0, 3, 2, 0, 0, 0] })
    expect(rules('C', thin)).toContain('sounding-min')
  })

  it('notes-valid: notes outside the chord', () => {
    const sour = variant({ frets: [-1, 3, 2, 0, 2, 0], fingers: [0, 3, 2, 0, 1, 0] })
    expect(rules('C', sour)).toContain('notes-valid')
  })

  it('tones-complete: missing third (the real bass-data bug)', () => {
    const fifthOnly = { frets: [-1, 0, 2, 2], fingers: [0, 0, 1, 2], baseFret: 1, barres: [] }
    expect(rules('A', fifthOnly, 'bass')).toContain('tones-complete')
  })

  it('finger-reuse: same finger on two frets without a barre', () => {
    const impossible = variant({ frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [] })
    expect(rules('A#', impossible)).toContain('finger-reuse')
    const twoFrets = variant({ frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 1, 1, 2] })
    expect(rules('D7', twoFrets)).toContain('finger-reuse')
  })

  it('barre-consistency: barre over open strings or matching no fretted string', () => {
    // the real A-major bug: barre row 1 with frets at 2 and open strings underneath
    const phantom = variant({
      frets: [-1, 0, 2, 2, 2, 0],
      fingers: [0, 0, 1, 1, 1, 0],
      barres: [{ fret: 1, fromString: 1, toString: 3 }],
    })
    expect(rules('A', phantom)).toContain('barre-consistency')
    const badRow = variant({
      frets: [1, 3, 3, 2, 1, 1],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [{ fret: 0, fromString: 0, toString: 5 }],
    })
    expect(rules('F', badRow)).toContain('barre-consistency')
  })
})

// ── global properties ─────────────────────────────────────────────────────────

const KNOWN_RULES = [
  'key',
  'shape',
  'finger-presence',
  'window',
  'span',
  'mute-edges',
  'sounding-min',
  'notes-valid',
  'tones-complete',
  'bass-note',
  'finger-reuse',
  'barre-consistency',
  'anatomy',
]

describe('validateChordVariant properties', () => {
  it('never throws and only reports known rules, for any key and any malformed variant', () => {
    fc.assert(
      fc.property(anyKeyArb, malformedVariantArb, instrumentArb, (key, v, instrument) => {
        const violations = validateChordVariant(key, v, instrument)
        for (const { rule } of violations) expect(KNOWN_RULES).toContain(rule)
      }),
    )
  })

  it('valid variants always render fully: every dot and barre inside rows 1..5', () => {
    fc.assert(
      fc.property(anyKeyArb, malformedVariantArb, instrumentArb, (key, v, instrument) => {
        if (validateChordVariant(key, v, instrument).length > 0) return
        for (const fret of v.frets) {
          if (fret > 0) {
            const row = fret - v.baseFret + 1
            expect(row).toBeGreaterThanOrEqual(1)
            expect(row).toBeLessThanOrEqual(DIAGRAM_ROWS)
            expect(fret).toBeLessThanOrEqual(MAX_FRET)
          }
        }
        for (const barre of v.barres) {
          expect(barre.fret).toBeGreaterThanOrEqual(1)
          expect(barre.fret).toBeLessThanOrEqual(DIAGRAM_ROWS)
        }
      }),
    )
  })

  it('pitchName round-trips all 12 pitch classes through CHORD_ROOTS spelling', () => {
    for (const root of CHORD_ROOTS) {
      expect(pitchName(parseChordKey(root)!.rootPitch)).toBe(root)
    }
  })
})
