import fc from 'fast-check'
import {
  isTablatureLine,
  testHeader,
  testChords,
  testSpaces,
  transposeChord,
  testTokenContext,
} from './chords.js'
import { formatChordSymbol, parseChordSymbol } from './chord-symbol.js'

describe('isTablatureLine', () => {
  it('returns true for a standard E string tablature line', () => {
    // Given a line starting with E followed by |
    // When isTablatureLine is called
    // Then it returns true
    expect(isTablatureLine('E|---0--2---')).toBe(true)
  })

  it('returns true for a sharp note tablature line', () => {
    // Given a line starting with A# followed by |
    // When isTablatureLine is called
    // Then it returns true
    expect(isTablatureLine('A#|---0--')).toBe(true)
  })

  it('returns true for lowercase e string tablature line', () => {
    expect(isTablatureLine('e|---0--2---')).toBe(true)
  })

  it('returns false for a chord line', () => {
    // Given a line with chord names separated by spaces
    // When isTablatureLine is called
    // Then it returns false
    expect(isTablatureLine('Am      C      G')).toBe(false)
  })

  it('returns false for a header line', () => {
    expect(isTablatureLine('[Verse]')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isTablatureLine('')).toBe(false)
  })
})

describe('testHeader', () => {
  it('returns true for a simple verse header', () => {
    // Given a string in bracket notation
    // When testHeader is called
    // Then it returns true
    expect(testHeader('[Verse]')).toBe(true)
  })

  it('returns true for a chorus header with a number', () => {
    expect(testHeader('[Chorus 1]')).toBe(true)
  })

  it('returns false for a plain chord name', () => {
    // Given a string with no bracket
    // When testHeader is called
    // Then it returns false
    expect(testHeader('Am')).toBe(false)
  })

  it('returns false for a tablature line', () => {
    expect(testHeader('E|---')).toBe(false)
  })
})

describe('testChords', () => {
  it('returns true for a minor chord', () => {
    expect(testChords('Am')).toBe(true)
  })

  it('returns true for a sharp major seventh chord', () => {
    expect(testChords('C#maj7')).toBe(true)
  })

  it('returns true for a slash chord', () => {
    expect(testChords('Dm7/G')).toBe(true)
  })

  it('returns true for a flat chord', () => {
    expect(testChords('Eb')).toBe(true)
  })

  it('returns true for a suspended chord', () => {
    expect(testChords('Bsus4')).toBe(true)
  })

  it('returns true for a minor seventh with added ninth', () => {
    expect(testChords('Am7add9')).toBe(true)
  })

  it('returns false for a common English word', () => {
    // Given a plain English word that is not a chord symbol
    // When testChords is called
    // Then it returns false
    expect(testChords('hello')).toBe(false)
  })

  it('returns false for the word "the"', () => {
    expect(testChords('the')).toBe(false)
  })
})

describe('testSpaces', () => {
  it('returns true for a string of spaces', () => {
    expect(testSpaces('   ')).toBe(true)
  })

  it('returns true for a tab character', () => {
    expect(testSpaces('\t')).toBe(true)
  })

  it('returns true for an empty string', () => {
    // Given an empty string (vacuously all whitespace)
    // When testSpaces is called
    // Then it returns true
    expect(testSpaces('')).toBe(true)
  })

  it('returns false for a string containing a chord', () => {
    expect(testSpaces('Am')).toBe(false)
  })
})

describe('transposeChord', () => {
  it('transposes A up by 2 semitones to B', () => {
    // Given the chord A and a transpose of +2
    // When transposeChord is called
    // Then it returns B
    expect(transposeChord('A', 2)).toBe('B')
  })

  it('transposes A up by 1 semitone to A#', () => {
    expect(transposeChord('A', 1)).toBe('A#')
  })

  it('transposes G# up by 1 semitone to A', () => {
    // Given G# and +1, wraps around the chromatic scale to A
    expect(transposeChord('G#', 1)).toBe('A')
  })

  it('transposes G# down by 1 semitone to G', () => {
    expect(transposeChord('G#', -1)).toBe('G')
  })

  it('returns the chord unchanged when transpose is 0', () => {
    // Given a no-op transpose value of 0
    // When transposeChord is called
    // Then the chord is returned as-is
    expect(transposeChord('C', 0)).toBe('C')
  })

  it('transposes a minor chord — Am up by 2 gives Bm', () => {
    // Given the minor chord Am and +2
    // When transposeChord is called
    // Then the suffix is preserved and the root is transposed
    expect(transposeChord('Am', 2)).toBe('Bm')
  })

  it('transposes a complex chord — C#maj7 up by 2 gives D#maj7', () => {
    expect(transposeChord('C#maj7', 2)).toBe('D#maj7')
  })

  it('transposes both root and bass note in a slash chord', () => {
    // Given Dm7/G and +2
    // When transposeChord is called
    // Then both Dm7→Em7 and G→A are transposed
    expect(transposeChord('Dm7/G', 2)).toBe('Em7/A')
  })

  it('transposes a flat chord — Bb up by 2 gives C', () => {
    // Given Bb (B flat) and +2, B is index 2, -1 for flat +2 = index 3 = C
    expect(transposeChord('Bb', 2)).toBe('C')
  })

  it('returns the same chord after a full 12-semitone transpose up', () => {
    // Given A and +12 (one full octave)
    // When transposeChord is called
    // Then A is returned unchanged
    expect(transposeChord('A', 12)).toBe('A')
  })

  it('returns the same chord after a full 12-semitone transpose down', () => {
    expect(transposeChord('A', -12)).toBe('A')
  })

  it('transposes A down by 1 semitone to G#', () => {
    expect(transposeChord('A', -1)).toBe('G#')
  })

  it('returns non-chord input unchanged for any transpose amount', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 10 }), fc.integer({ min: -24, max: 24 }), (s, n) => {
        fc.pre(parseChordSymbol(s) === null)
        expect(transposeChord(s, n)).toBe(s)
      }),
    )
  })

  it('composes additively on canonical chord strings', () => {
    const canonicalChordArb = fc
      .tuple(
        fc.integer({ min: 0, max: 11 }),
        fc.constantFrom('', 'm', '7', 'm7', 'maj7', 'sus4', 'dim', 'aug', '5', 'm7b5', '6/9'),
        fc.option(fc.integer({ min: 0, max: 11 })),
      )
      .map(([rootPitch, suffix, bassPitch]) =>
        formatChordSymbol(bassPitch === null ? { rootPitch, suffix } : { rootPitch, suffix, bassPitch }),
      )
    fc.assert(
      fc.property(canonicalChordArb, fc.integer({ min: -24, max: 24 }), fc.integer({ min: -24, max: 24 }), (chord, a, b) => {
        expect(transposeChord(transposeChord(chord, a), b)).toBe(transposeChord(chord, a + b))
      }),
    )
  })
})

describe('testTokenContext', () => {
  it('returns false when all tokens are chord symbols', () => {
    // Given a token array of only chord names (pure chord line)
    // When testTokenContext is called
    // Then it returns false (not a lyric-with-chords context)
    expect(testTokenContext(['Am', 'C', 'G', 'Em'])).toBe(false)
  })

  it('returns false when all tokens are non-chord words', () => {
    // Given a token array with no chord symbols at all
    // When testTokenContext is called
    // Then it returns false
    expect(testTokenContext(['the', 'quick', 'brown', 'fox'])).toBe(false)
  })

  it('returns true when chords are a minority among word tokens', () => {
    // Given a mix where chords are outnumbered by plain words (minority)
    // When testTokenContext is called
    // Then it returns true (lyric line with chord annotations)
    expect(testTokenContext(['the', 'Am', 'quick', 'C', 'brown'])).toBe(true)
  })

  it('returns false when chords equal or outnumber non-chord tokens', () => {
    // Given a token array where chord count >= non-chord count
    // When testTokenContext is called
    // Then it returns false (treated as a chord line, not a lyric line)
    expect(testTokenContext(['Am', 'C', 'hello'])).toBe(false)
  })

  it('returns false when second token is | (tablature line detection)', () => {
    // Given a token array where tokens[1] === '|'
    // When testTokenContext is called
    // Then it short-circuits and returns false
    expect(testTokenContext(['E', '|', '---', '0', '--'])).toBe(false)
  })
})
