import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  formatChordSymbol,
  isChordSymbol,
  parseChordSymbol,
  parseNotePrefix,
  toTheoryChord,
  transposeChordSymbol,
  type ParsedChordSymbol,
} from './chord-symbol.js'
import { expectedChordKeys, parseChordKey, pitchName } from './chord-theory.js'
import { normalizeChordKey } from './chord-diagrams.js'

// ── Legacy detection oracle ───────────────────────────────────────────────────
//
// The regex grammar that powered testChords before the chord-symbol layer,
// copied verbatim. The new grammar deliberately diverges from it in two
// approved directions (see the bounded-divergence property below):
//   - it ADDS forms the old grammar missed: aug, altered tones (m7b5, 7#9),
//     and the 6/9 extension;
//   - it DROPS non-chords the old grammar accepted: extensions that name no
//     chord tone (Cmaj23, C8) and m/M stacked as a second quality (C7m7).
// Any divergence outside those two classes is a regression and fails here.

const legacyNotePattern = '(?<note>[A-G])(?<accidentals>(?:bb|b|♭♭|♭)|(?:##|#))?'
const legacyQuality = '(maj|[Mm]|min|sus|dim|add)?'
const legacyQualityRequired = '(?:maj|[Mm]|min|sus|dim|add)'
const legacyNumber = '(?:[1-9]|1[0-9]|2[0-3])?'
const legacyNumberRequired = '(?:[1-9]|1[0-9]|2[0-3])'
const legacyNoTriples = '^(?!.*(?:#{3}|b{3}|♭{3}))'
const legacyChordsPattern =
  `(?<chords>${legacyQuality}${legacyNumber}(?:${legacyQualityRequired}${legacyNumberRequired})?)?`
const legacyBassPattern =
  '(?:\\/(?<bass>(?<bassNote>[A-G])(?<bassAccidentals>(?:b|bb|♭|♭♭)|(?:#|##))?))?'
const legacyMatcher = legacyNotePattern + legacyChordsPattern + legacyBassPattern

const legacyTestChords = (string: string): boolean => {
  const match = new RegExp(legacyNoTriples + legacyMatcher + '$').exec(string)
  return match !== null && match[0] === string
}

/** Numbers the new grammar accepts as extensions/alterations. */
const ALLOWED_NUMBERS = new Set(['2', '4', '5', '6', '7', '9', '11', '13'])

const stripRoot = (s: string) => s.replace(/^[A-G](?:##|bb|♭♭|#|b|♭)?/, '')

/** New-only accepts must be one of the added forms. */
const isApprovedAddition = (s: string) => /aug|6\/9|[#b♭]\d/.test(s)

/** Legacy-only accepts must be one of the dropped non-chord forms. */
const isApprovedRemoval = (s: string) => {
  const runs = s.match(/\d+/g) ?? []
  if (runs.some((run) => !ALLOWED_NUMBERS.has(run))) return true
  // m/M stacked after the start of the suffix, e.g. C7m7, Cmm7
  return /[mM]/.test(stripRoot(s).slice(1))
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const letterArb = fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G')
const accidentalArb = fc.constantFrom('', '#', '##', 'b', 'bb', '♭', '♭♭')
const qualityArb = fc.constantFrom('', 'maj', 'min', 'm', 'M', 'dim', 'aug', 'sus', 'add')
const numberArb = fc.constantFrom('2', '4', '5', '6', '7', '9', '11', '13')
const extensionArb = fc.constantFrom('', '2', '4', '5', '6', '6/9', '7', '9', '11', '13')
const tailArb = fc.oneof(
  fc.constant(''),
  fc
    .tuple(fc.constantFrom('maj', 'min', 'sus', 'dim', 'add'), numberArb)
    .map(([q, n]) => q + n),
)
const alterationArb = fc.array(
  fc.tuple(fc.constantFrom('#', 'b', '♭'), numberArb).map(([a, n]) => a + n),
  { maxLength: 2 },
)

/** Suffixes drawn from the new grammar. */
const suffixArb = fc
  .tuple(qualityArb, extensionArb, tailArb, alterationArb)
  .map(([quality, extension, tail, alterations]) => quality + extension + tail + alterations.join(''))

/** Well-formed chord strings (grammar-valid by construction). */
const chordStringArb = fc
  .tuple(letterArb, accidentalArb, suffixArb, fc.option(fc.tuple(letterArb, accidentalArb)))
  .map(([letter, accidental, suffix, bass]) =>
    bass === null ? letter + accidental + suffix : `${letter}${accidental}${suffix}/${bass[0]}${bass[1]}`,
  )

/** Parsed symbols with grammar-valid suffixes (the parser's output domain). */
const parsedArb: fc.Arbitrary<ParsedChordSymbol> = fc
  .tuple(fc.integer({ min: 0, max: 11 }), suffixArb, fc.option(fc.integer({ min: 0, max: 11 })))
  .map(([rootPitch, suffix, bassPitch]) =>
    bassPitch === null ? { rootPitch, suffix } : { rootPitch, suffix, bassPitch },
  )

/** Adversarial near-chord strings over a chord-flavoured alphabet. */
const chordishStringArb = fc
  .array(
    fc.constantFrom(...'ABCDEFGmajsudin#b♭/0123456789Mhe '.split('')),
    { maxLength: 10 },
  )
  .map((chars) => chars.join(''))

const knownKeyArb = fc.constantFrom(...expectedChordKeys())

// ── parseNotePrefix ───────────────────────────────────────────────────────────

describe('parseNotePrefix', () => {
  it('resolves every letter/accidental spelling and returns the remainder', () => {
    fc.assert(
      fc.property(letterArb, accidentalArb, fc.string({ maxLength: 5 }), (letter, accidental, rest) => {
        const parsed = parseNotePrefix(letter + accidental + rest)
        expect(parsed).not.toBeNull()
        // Accidentals starting the rest get consumed by the prefix instead;
        // only assert the round trip when the rest is not accidental-leading.
        if (!/^[#b♭]/.test(rest) || accidental.length === 2) {
          expect(parsed?.rest).toBe(rest)
        }
        expect(parsed?.pitch).toBeGreaterThanOrEqual(0)
        expect(parsed?.pitch).toBeLessThanOrEqual(11)
      }),
    )
  })

  it('collapses enharmonic spellings to the same pitch class', () => {
    expect(parseNotePrefix('Cb')?.pitch).toBe(parseNotePrefix('B')?.pitch)
    expect(parseNotePrefix('B#')?.pitch).toBe(parseNotePrefix('C')?.pitch)
    expect(parseNotePrefix('C##')?.pitch).toBe(parseNotePrefix('D')?.pitch)
    expect(parseNotePrefix('D♭♭')?.pitch).toBe(parseNotePrefix('C')?.pitch)
  })

  it('rejects strings that do not start with a note letter', () => {
    expect(parseNotePrefix('hello')).toBeNull()
    expect(parseNotePrefix('e')).toBeNull()
    expect(parseNotePrefix('')).toBeNull()
    expect(parseNotePrefix('#C')).toBeNull()
  })
})

// ── Grammar examples ──────────────────────────────────────────────────────────

describe('parseChordSymbol grammar', () => {
  it.each([
    'Am', 'C#maj7', 'Dm7/G', 'Eb', 'B♭♭', 'Bsus4', 'Cadd9', 'Am7add9',
    'Cmaj13', 'C7sus4', 'Dmin7', 'CM7', 'Cmmaj7', 'C5', 'Cdim7',
    // forms the legacy grammar missed
    'Caug', 'Am7b5', 'C6/9', 'E7#9', 'Fadd11', 'G7b9#5',
  ])('accepts %s', (chord) => {
    expect(parseChordSymbol(chord)).not.toBeNull()
  })

  it.each([
    'hello', 'the', 'e', '', '/G', 'H7',
    // non-chords the legacy grammar accepted
    'Cmaj23', 'C8', 'C97', 'Cmin1', 'C7m7',
  ])('rejects %s', (chord) => {
    expect(parseChordSymbol(chord)).toBeNull()
  })

  it('keeps the suffix verbatim and the 6/9 extension out of the bass', () => {
    expect(parseChordSymbol('Dmin7')).toEqual({ rootPitch: 2, suffix: 'min7' })
    expect(parseChordSymbol('C6/9')).toEqual({ rootPitch: 0, suffix: '6/9' })
    expect(parseChordSymbol('C6/9/E')).toEqual({ rootPitch: 0, suffix: '6/9', bassPitch: 4 })
    expect(parseChordSymbol('Dm7/G')).toEqual({ rootPitch: 2, suffix: 'm7', bassPitch: 7 })
  })
})

// ── Bounded legacy-divergence oracle ──────────────────────────────────────────

describe('detection grammar vs legacy regex', () => {
  const assertBoundedDivergence = (s: string) => {
    const next = isChordSymbol(s)
    const legacy = legacyTestChords(s)
    if (next === legacy) return
    if (next && !legacy) {
      expect(isApprovedAddition(s), `unapproved new accept: "${s}"`).toBe(true)
    } else {
      expect(isApprovedRemoval(s), `unapproved removal: "${s}"`).toBe(true)
    }
  }

  it('diverges only in the approved classes (adversarial alphabet)', () => {
    fc.assert(fc.property(chordishStringArb, assertBoundedDivergence))
  })

  it('diverges only in the approved classes (arbitrary strings)', () => {
    fc.assert(fc.property(fc.string({ maxLength: 12 }), assertBoundedDivergence))
  })

  it('accepts every grammar-built chord string', () => {
    fc.assert(
      fc.property(chordStringArb, (s) => {
        expect(isChordSymbol(s)).toBe(true)
      }),
    )
  })
})

// ── Round trips and normalization ─────────────────────────────────────────────

describe('parse/format round trip', () => {
  it('parseChordSymbol(formatChordSymbol(p)) recovers p exactly', () => {
    fc.assert(
      fc.property(parsedArb, (parsed) => {
        expect(parseChordSymbol(formatChordSymbol(parsed))).toEqual(parsed)
      }),
    )
  })

  it('format∘parse is idempotent on parseable strings', () => {
    fc.assert(
      fc.property(chordStringArb, (s) => {
        const once = formatChordSymbol(parseChordSymbol(s)!)
        const twice = formatChordSymbol(parseChordSymbol(once)!)
        expect(twice).toBe(once)
      }),
    )
  })
})

// ── Transpose group laws ──────────────────────────────────────────────────────

describe('transposeChordSymbol', () => {
  it('transposing by 0 is the identity', () => {
    fc.assert(
      fc.property(parsedArb, (p) => {
        expect(transposeChordSymbol(p, 0)).toEqual(p)
      }),
    )
  })

  it('composes additively: T_a ∘ T_b = T_(a+b)', () => {
    fc.assert(
      fc.property(parsedArb, fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), (p, a, b) => {
        expect(transposeChordSymbol(transposeChordSymbol(p, a), b)).toEqual(transposeChordSymbol(p, a + b))
      }),
    )
  })

  it('is periodic with period 12 and invertible', () => {
    fc.assert(
      fc.property(parsedArb, fc.integer({ min: -50, max: 50 }), (p, n) => {
        expect(transposeChordSymbol(p, n + 12)).toEqual(transposeChordSymbol(p, n))
        expect(transposeChordSymbol(transposeChordSymbol(p, n), -n)).toEqual(p)
      }),
    )
  })

  it('moves the root by exactly n semitones and never touches the suffix', () => {
    fc.assert(
      fc.property(parsedArb, fc.integer({ min: -50, max: 50 }), (p, n) => {
        const moved = transposeChordSymbol(p, n)
        expect(moved.rootPitch).toBe((((p.rootPitch + n) % 12) + 12) % 12)
        expect(moved.suffix).toBe(p.suffix)
        expect(moved.bassPitch === undefined).toBe(p.bassPitch === undefined)
      }),
    )
  })
})

// ── Cross-system consistency (the unification contract) ──────────────────────

describe('chord-symbol vs chord-theory on canonical keys', () => {
  it('parses every expected chord key and agrees with parseChordKey', () => {
    fc.assert(
      fc.property(knownKeyArb, (key) => {
        const symbol = parseChordSymbol(key)
        const theory = parseChordKey(key)
        expect(symbol).not.toBeNull()
        expect(theory).not.toBeNull()
        expect(symbol?.rootPitch).toBe(theory?.rootPitch)
        expect(symbol?.suffix).toBe(theory?.quality)
        expect(symbol?.bassPitch).toBe(theory?.bassPitch)
      }),
    )
  })

  it('canonical keys are fixpoints of format and normalizeChordKey', () => {
    fc.assert(
      fc.property(knownKeyArb, (key) => {
        expect(formatChordSymbol(parseChordSymbol(key)!)).toBe(key)
        expect(normalizeChordKey(key)).toBe(key)
      }),
    )
  })

  it('toTheoryChord bridges exactly the canonical qualities', () => {
    fc.assert(
      fc.property(knownKeyArb, (key) => {
        expect(toTheoryChord(parseChordSymbol(key)!)).toEqual(parseChordKey(key))
      }),
    )
    // permissive-only suffixes do not bridge
    expect(toTheoryChord(parseChordSymbol('Dmin7')!)).toBeNull()
    expect(toTheoryChord(parseChordSymbol('Am7b5')!)).toBeNull()
  })

  it('formats every pitch class to its sharps-only name', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), (pitch) => {
        expect(formatChordSymbol({ rootPitch: pitch, suffix: '' })).toBe(pitchName(pitch))
      }),
    )
  })
})
