import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { classifySheetLine, type SheetLine } from './sheet-lines.js'
import {
  CHORD_LIKE_RE,
  delimiterMatcher,
  isTablatureLine,
  testChords,
  testHeader,
  testSpaces,
  testTokenContext,
  transposeChord,
} from './chords.js'

// ── Legacy classification oracle ──────────────────────────────────────────────
//
// The decision logic of the old Sheet.tsx lineMatcher, reproduced without JSX
// (including the `.replace('|', '')` it applied during detection, kept here
// verbatim to prove it was dead code). classifySheetLine must classify every
// line identically.

type LegacyDecision =
  | { kind: 'blank' }
  | { kind: 'chord-line'; chordFlags: boolean[]; stringIndicatorIndex: number | null }
  | { kind: 'header' }
  | { kind: 'plain' }

const legacyLineMatcher = (line: string): LegacyDecision => {
  if (!line.trim()) return { kind: 'blank' }

  const tokens = line.split(delimiterMatcher).filter((token) => token !== '')
  const sanitizedTokens = tokens.filter((token) => !testSpaces(token))

  const isTablature = isTablatureLine(line)
  const hasValidChords = tokens.some(
    (token) => testChords(token.replace('|', '')) || token === 'e',
  )
  const isMixedContent = hasValidChords && testTokenContext(sanitizedTokens)

  if (hasValidChords && !isMixedContent) {
    return {
      kind: 'chord-line',
      chordFlags: tokens.map((token) => testChords(token) || token === 'e'),
      stringIndicatorIndex:
        isTablature && (testChords(tokens[0]) || tokens[0] === 'e') ? 0 : null,
    }
  }

  if (testHeader(line)) return { kind: 'header' }
  return { kind: 'plain' }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const chordArb = fc.constantFrom(
  'Am', 'C', 'G', 'Em', 'Dm7/G', 'Bb', 'C#maj7', 'Asus4', 'Caug', 'Am7b5', 'e',
  'C-', 'C-7', 'A-7/G', 'C+', 'C°7', 'Cø', 'C6/9',
)
const wordArb = fc.constantFrom('the', 'quick', 'hello', 'la', 'darling', 'oo', 'Hm', 'A-flat', 're-do')
const fragmentArb = fc.oneof(
  chordArb,
  wordArb,
  fc.constantFrom('E|--0--2--', 'e|-3-', 'A#|--5--', '[Verse]', '[Chorus 1]', '(', ')', '|', '-', '*', '  ', '\t'),
)

/** Lines assembled from tab-flavoured fragments. */
const sheetLineArb = fc
  .array(fragmentArb, { maxLength: 8 })
  .map((parts) => parts.join(' '))

const anyLineArb = fc.oneof(sheetLineArb, fc.string({ maxLength: 30 }))
const transposeArb = fc.integer({ min: -12, max: 12 })

const chordLineTokens = (classified: SheetLine) =>
  classified.kind === 'chord-line' ? classified.tokens : []

// ── Properties ────────────────────────────────────────────────────────────────

describe('classifySheetLine', () => {
  it('never throws and always returns a known kind', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), fc.integer(), (line, transpose) => {
        const classified = classifySheetLine(line, transpose)
        expect(['blank', 'chord-line', 'header', 'plain']).toContain(classified.kind)
      }),
    )
  })

  it('classifies a line as blank exactly when it has no visible characters', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
        expect(classifySheetLine(line, transpose).kind === 'blank').toBe(line.trim() === '')
      }),
    )
  })

  it('reconstructs chord lines losslessly from token raws', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
        const classified = classifySheetLine(line, transpose)
        fc.pre(classified.kind === 'chord-line')
        expect(chordLineTokens(classified).map((t) => t.raw).join('')).toBe(line)
      }),
    )
  })

  it('matches the legacy lineMatcher decision on every line without a dash-merged chord', () => {
    // A dash merge can occur where a token is followed by a single `-` and the
    // pieces join into a chord — the one approved tokenization change.
    const dashMergePossible = (line: string): boolean => {
      if (isTablatureLine(line)) return false
      const tokens = line.split(delimiterMatcher).filter((token) => token !== '')
      return tokens.some(
        (token, i) =>
          tokens[i + 1] === '-' &&
          tokens[i + 2] !== '-' &&
          (testChords(`${token}-`) ||
            (tokens[i + 2] !== undefined && testChords(`${token}-${tokens[i + 2]}`))),
      )
    }

    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
        fc.pre(!dashMergePossible(line))
        // Skip lines carrying chord-voicing tokens (A1, G1, F#1…). Their presence
        // makes classifySheetLine treat every chord-like-shaped token as a voicing
        // label (so F#2, which also parses as a sus2 chord, is not boxed). The
        // legacy matcher predates voicing tokens and boxes them, so flag
        // classification intentionally diverges on these lines.
        const hasVoicingToken = line
          .split(delimiterMatcher)
          .filter((t) => t !== '' && !testSpaces(t))
          .some((t) => CHORD_LIKE_RE.test(t) && !testChords(t))
        fc.pre(!hasVoicingToken)
        const classified = classifySheetLine(line, transpose)
        const legacy = legacyLineMatcher(line)
        expect(classified.kind).toBe(legacy.kind)
        if (classified.kind === 'chord-line' && legacy.kind === 'chord-line') {
          const flags = classified.tokens.map((t) => t.kind !== 'text')
          expect(flags).toEqual(legacy.chordFlags)
          const indicator = classified.tokens.findIndex((t) => t.kind === 'string-indicator')
          expect(indicator === -1 ? null : indicator).toBe(legacy.stringIndicatorIndex)
        }
      }),
    )
  })

  it('places string indicators only at token 0 of tablature lines', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
        const tokens = chordLineTokens(classifySheetLine(line, transpose))
        tokens.forEach((token, i) => {
          if (token.kind === 'string-indicator') {
            expect(i).toBe(0)
            expect(isTablatureLine(line)).toBe(true)
          }
        })
      }),
    )
  })

  it('displays raw names at transpose 0, mapping a lone e to E', () => {
    fc.assert(
      fc.property(anyLineArb, (line) => {
        for (const token of chordLineTokens(classifySheetLine(line, 0))) {
          if (token.kind !== 'chord') continue
          expect(token.display).toBe(token.raw === 'e' ? 'E' : token.raw)
        }
      }),
    )
  })

  it('always produces chord displays that are valid chords', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
        for (const token of chordLineTokens(classifySheetLine(line, transpose))) {
          if (token.kind === 'chord') expect(testChords(token.display)).toBe(true)
        }
      }),
    )
  })

  it('keeps token kinds independent of the transpose amount', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, transposeArb, (line, a, b) => {
        const kindsAt = (transpose: number) => {
          const classified = classifySheetLine(line, transpose)
          return classified.kind === 'chord-line'
            ? classified.tokens.map((t) => t.kind)
            : classified.kind
        }
        expect(kindsAt(a)).toEqual(kindsAt(b))
      }),
    )
  })

  it('transposes chord displays through transposeChord', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
        const tokens = chordLineTokens(classifySheetLine(line, transpose))
        for (const token of tokens) {
          if (token.kind !== 'chord') continue
          expect(token.display).toBe(transposeChord(token.raw === 'e' ? 'E' : token.raw, transpose))
        }
      }),
    )
  })
})

// ── Examples pinning the renderer-facing contract ─────────────────────────────

describe('classifySheetLine examples', () => {
  it('classifies a pure chord line with transposed displays', () => {
    expect(classifySheetLine('Am  C', 2)).toEqual({
      kind: 'chord-line',
      tokens: [
        { kind: 'chord', raw: 'Am', display: 'Bm' },
        { kind: 'text', raw: '  ' },
        { kind: 'chord', raw: 'C', display: 'D' },
      ],
    })
  })

  it('keeps the tablature string label untransposed as a string indicator', () => {
    const classified = classifySheetLine('e|--0--2--', 3)
    expect(classified.kind).toBe('chord-line')
    expect(chordLineTokens(classified)[0]).toEqual({ kind: 'string-indicator', raw: 'e' })
  })

  it('treats lyric lines with minority chords as plain text', () => {
    expect(classifySheetLine('the Am quick C brown', 2)).toEqual({
      kind: 'plain',
      text: 'the Am quick C brown',
    })
  })

  it('classifies headers after ruling out chord lines', () => {
    expect(classifySheetLine('[Verse]', 0)).toEqual({ kind: 'header', text: '[Verse]' })
    expect(classifySheetLine('[Chorus] Am G', 0).kind).toBe('chord-line')
  })

  it('re-joins dash-spelled minor chords that the delimiter split apart', () => {
    expect(classifySheetLine('C- G-', 0)).toEqual({
      kind: 'chord-line',
      tokens: [
        { kind: 'chord', raw: 'C-', display: 'C-' },
        { kind: 'text', raw: ' ' },
        { kind: 'chord', raw: 'G-', display: 'G-' },
      ],
    })
    expect(classifySheetLine('C-7  F-7', 2)).toEqual({
      kind: 'chord-line',
      tokens: [
        { kind: 'chord', raw: 'C-7', display: 'D-7' },
        { kind: 'text', raw: '  ' },
        { kind: 'chord', raw: 'F-7', display: 'G-7' },
      ],
    })
  })

  it('never merges tablature dashes or lyric hyphens', () => {
    const tab = classifySheetLine('E|--0--2--', 0)
    expect(tab.kind).toBe('chord-line')
    expect(chordLineTokens(tab).filter((t) => t.kind === 'chord')).toEqual([])
    expect(classifySheetLine('the A-flat major scale', 0)).toEqual({
      kind: 'plain',
      text: 'the A-flat major scale',
    })
  })

  it('classifies jazz symbol chords without dashes directly', () => {
    expect(classifySheetLine('C+ Cø B°7', 0)).toEqual({
      kind: 'chord-line',
      tokens: [
        { kind: 'chord', raw: 'C+', display: 'C+' },
        { kind: 'text', raw: ' ' },
        { kind: 'chord', raw: 'Cø', display: 'Cø' },
        { kind: 'text', raw: ' ' },
        { kind: 'chord', raw: 'B°7', display: 'B°7' },
      ],
    })
  })

  it('classifies a line with valid chords and chord-voicing tokens as a chord-line, with voicing tokens as text', () => {
    // G, F are valid chords; A1, G1, F#1, F#2, F#3 are chord-voicing tokens that
    // count toward the chord-majority check so the line is a chord-line, but they
    // label a string/fret and must never be boxed. F#2 also parses as a sus2
    // chord, so it is the regression case: its box must be suppressed because the
    // line carries unambiguous voicing tokens (A1/G1/F#1) alongside it.
    const result = classifySheetLine('G      F     A1      G1                 F#1   F#2   F#3  F', 0)
    expect(result.kind).toBe('chord-line')
    const tokens = result.kind === 'chord-line' ? result.tokens : []
    const chordRaws = tokens.filter(t => t.kind === 'chord').map(t => t.raw)
    expect(chordRaws).toContain('G')
    expect(chordRaws).toContain('F')
    expect(chordRaws).not.toContain('A1')
    expect(chordRaws).not.toContain('G1')
    expect(chordRaws).not.toContain('F#1')
    expect(chordRaws).not.toContain('F#2')
    expect(chordRaws).not.toContain('F#3')
  })

  it('classifies a line of only chord-voicing tokens as plain (no valid chords)', () => {
    // A1, G1, F#1 are chord-like but not valid chords, so hasValidChords is
    // false and classifySheetLine falls through to plain.
    expect(classifySheetLine('A1 G1 F#1', 0)).toEqual({
      kind: 'plain',
      text: 'A1 G1 F#1',
    })
  })
})
