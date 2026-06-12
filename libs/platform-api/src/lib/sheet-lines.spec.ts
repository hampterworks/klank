import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { classifySheetLine, type SheetLine } from './sheet-lines.js'
import {
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

const chordArb = fc.constantFrom('Am', 'C', 'G', 'Em', 'Dm7/G', 'Bb', 'C#maj7', 'Asus4', 'Caug', 'Am7b5', 'e')
const wordArb = fc.constantFrom('the', 'quick', 'hello', 'la', 'darling', 'oo', 'Hm')
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

  it('matches the legacy lineMatcher decision on every line', () => {
    fc.assert(
      fc.property(anyLineArb, transposeArb, (line, transpose) => {
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

  it('always produces chord displays that are themselves valid chords', () => {
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
})
