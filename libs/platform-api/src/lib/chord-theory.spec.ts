import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ChordVariant } from './chord-diagrams.js'
import {
  CHORD_ROOTS,
  DIAGRAM_ROWS,
  MAX_FRET,
  expectedChordKeys,
  findDuplicateVariants,
  getAllowedPitches,
  getRequiredPitches,
  parseChordKey,
  pitchName,
  validateChordVariant,
} from './chord-theory.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const variant = (partial: Partial<ChordVariant>): ChordVariant => ({
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [0, 0, 0, 0, 0, 0],
  baseFret: 1,
  barres: [],
  ...partial,
})

/** Open C major — canonical, fully valid. */
const C_OPEN = variant({ frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] })

/** F major barre — canonical, fully valid. */
const F_BARRE = variant({
  frets: [1, 3, 3, 2, 1, 1],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 1, fromString: 0, toString: 5 }],
})

const rules = (key: string, v: ChordVariant, instrument: 'guitar' | 'bass' = 'guitar') =>
  validateChordVariant(key, v, instrument).map((x) => x.rule)

// ── parseChordKey ─────────────────────────────────────────────────────────────

describe('parseChordKey', () => {
  it('parses plain keys', () => {
    expect(parseChordKey('C')).toEqual({ rootPitch: 0, quality: '' })
    expect(parseChordKey('A#m7')).toEqual({ rootPitch: 10, quality: 'm7' })
  })

  it('parses slash keys with a bass pitch', () => {
    expect(parseChordKey('G/B')).toEqual({ rootPitch: 7, quality: '', bassPitch: 11 })
    expect(parseChordKey('Dm/F')).toEqual({ rootPitch: 2, quality: 'm', bassPitch: 5 })
    expect(parseChordKey('D/F#')).toEqual({ rootPitch: 2, quality: '', bassPitch: 6 })
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
  it('slash bass joins the allowed and required sets', () => {
    const parsed = parseChordKey('C/B')
    expect(parsed).not.toBeNull()
    expect(getAllowedPitches(parsed!)).toEqual(new Set([0, 4, 7, 11]))
    expect(getRequiredPitches(parsed!)).toEqual(new Set([0, 4, 7, 11]))
  })

  it('triads require every tone; 7th chords may omit only the 5th', () => {
    expect(getRequiredPitches(parseChordKey('D')!)).toEqual(new Set([2, 6, 9]))
    expect(getRequiredPitches(parseChordKey('C7')!)).toEqual(new Set([0, 4, 10]))
    expect(getRequiredPitches(parseChordKey('Cmaj7')!)).toEqual(new Set([0, 4, 11]))
  })
})

// ── expectedChordKeys ─────────────────────────────────────────────────────────

describe('expectedChordKeys', () => {
  it('returns 120 plain + 84 slash keys with no duplicates', () => {
    const keys = expectedChordKeys()
    expect(keys).toHaveLength(204)
    expect(new Set(keys).size).toBe(204)
  })

  it('contains the common alternate-bass chords', () => {
    const keys = new Set(expectedChordKeys())
    for (const key of ['G/B', 'D/F#', 'Dm/F', 'C/B', 'C/E', 'C/G', 'Am/G', 'Em/D', 'A/C#']) {
      expect(keys.has(key), key).toBe(true)
    }
  })

  it('every key parses', () => {
    for (const key of expectedChordKeys()) {
      expect(parseChordKey(key), key).not.toBeNull()
    }
  })
})

// ── findDuplicateVariants ─────────────────────────────────────────────────────

describe('findDuplicateVariants', () => {
  it('flags repeated frets/baseFret combinations', () => {
    expect(findDuplicateVariants([C_OPEN, F_BARRE, variant({ frets: C_OPEN.frets })])).toEqual([2])
    expect(findDuplicateVariants([C_OPEN, F_BARRE])).toEqual([])
  })
})

// ── validateChordVariant: valid fixtures ──────────────────────────────────────

describe('validateChordVariant accepts canonical shapes', () => {
  it.each([
    ['C', C_OPEN],
    ['F', F_BARRE],
    ['D', variant({ frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] })],
    ['G', variant({ frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] })],
    ['C7', variant({ frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] })],
    ['G/B', variant({ frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 2, 3] })],
    ['D/F#', variant({ frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] })],
    [
      'Bm',
      variant({
        frets: [-1, 2, 4, 4, 3, 2],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 2,
        barres: [{ fret: 1, fromString: 1, toString: 5 }],
      }),
    ],
  ])('%s', (key, v) => {
    expect(validateChordVariant(key, v, 'guitar')).toEqual([])
  })

  it('accepts a valid bass shape', () => {
    const cMajor = { frets: [-1, 3, 2, 0], fingers: [0, 2, 1, 0], baseFret: 1, barres: [] }
    expect(validateChordVariant('C', cMajor, 'bass')).toEqual([])
  })
})

// ── validateChordVariant: one failure per rule ────────────────────────────────

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

  it('finger-presence: fingers on muted/open strings, none on fretted ones', () => {
    expect(rules('C', { ...C_OPEN, fingers: [1, 3, 2, 0, 1, 0] })).toContain('finger-presence')
    expect(rules('C', { ...C_OPEN, fingers: [0, 0, 2, 0, 1, 0] })).toContain('finger-presence')
  })

  it('window: dots outside the rendered 5-fret window', () => {
    // E-shape A at fret 5 wrongly labeled baseFret 1: dots vanish in the renderer
    const high = variant({ frets: [5, 7, 7, 6, 5, 5], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [{ fret: 5, fromString: 0, toString: 5 }] })
    expect(rules('A', high)).toContain('window')
    // baseFret must equal the lowest fretted note
    const offBase = variant({ frets: [5, 7, 7, 6, 5, 5], fingers: [1, 3, 4, 2, 1, 1], baseFret: 4, barres: [{ fret: 2, fromString: 0, toString: 5 }] })
    expect(rules('A', offBase)).toContain('window')
  })

  it('span: more than a 4-fret stretch', () => {
    const wide = variant({ frets: [-1, 3, 2, 0, 1, 7], fingers: [0, 3, 2, 0, 1, 4] })
    expect(rules('C', wide)).toContain('span')
  })

  it('mute-edges: muted string between sounding strings', () => {
    const gap = variant({ frets: [-1, 3, -1, 0, 1, 0], fingers: [0, 3, 0, 0, 1, 0] })
    expect(rules('C', gap)).toContain('mute-edges')
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

  it('bass-note: lowest sounding string is not the root / slash bass', () => {
    const cOverG = variant({ frets: [3, 3, 2, 0, 1, 0], fingers: [3, 4, 2, 0, 1, 0] })
    expect(rules('C', cOverG)).toContain('bass-note')
    expect(rules('C/G', cOverG)).not.toContain('bass-note')
    expect(rules('C/E', cOverG)).toContain('bass-note')
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

  it('anatomy: lower finger number on a higher fret', () => {
    const crossed = variant({ frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 1, 2, 0, 3, 0] })
    expect(rules('C', crossed)).toContain('anatomy')
  })
})

// ── properties ────────────────────────────────────────────────────────────────

describe('validateChordVariant properties', () => {
  const variantArb = fc.record({
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

  const keyArb = fc.oneof(
    fc.constantFrom(...expectedChordKeys()),
    fc.string({ maxLength: 8 }),
  )

  it('never throws, for any key and any malformed variant', () => {
    fc.assert(
      fc.property(keyArb, variantArb, fc.constantFrom('guitar' as const, 'bass' as const), (key, v, instrument) => {
        expect(() => validateChordVariant(key, v, instrument)).not.toThrow()
      }),
    )
  })

  it('valid variants always render fully: every dot and barre inside rows 1..5', () => {
    fc.assert(
      fc.property(keyArb, variantArb, fc.constantFrom('guitar' as const, 'bass' as const), (key, v, instrument) => {
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
      const parsed = parseChordKey(root)
      expect(parsed).not.toBeNull()
      expect(pitchName(parsed!.rootPitch)).toBe(root)
    }
  })
})
