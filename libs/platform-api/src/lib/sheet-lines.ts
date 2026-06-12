import {
  delimiterMatcher,
  isTablatureLine,
  testChords,
  testHeader,
  testSpaces,
  testTokenContext,
  transposeChord,
} from './chords.js'

/**
 * Pure classification of tab-sheet lines, extracted from the Sheet renderer
 * so the decision logic is testable without React. The renderer maps the
 * returned structure to markup one-to-one.
 */

export type SheetToken =
  /** A chord to highlight; `display` is the transposed, sharps-spelled name. */
  | { kind: 'chord'; raw: string; display: string }
  /** The leading note label of a tablature line — styled like a chord but
   *  never transposed and never given a diagram tooltip. */
  | { kind: 'string-indicator'; raw: string }
  /** Anything else, including whitespace and delimiters, verbatim. */
  | { kind: 'text'; raw: string }

export type SheetLine =
  | { kind: 'blank' }
  | { kind: 'chord-line'; tokens: SheetToken[] }
  | { kind: 'header'; text: string }
  | { kind: 'plain'; text: string }

/**
 * Classifies one line of tab text.
 *
 * - Blank lines are `blank`.
 * - Lines whose tokens contain chords — unless chords are a minority among
 *   words (a lyric line with chord annotations, kept as `plain`) — are
 *   `chord-line`s; their chord tokens carry the transposed display name.
 *   Tablature lines fall in here too: their leading note label becomes a
 *   `string-indicator` token. A lone `e` token counts as the high-E chord.
 * - Remaining lines are `header` (e.g. `[Verse]`) or `plain`.
 *
 * For chord-lines, concatenating `tokens[].raw` reproduces `line` exactly.
 */
export const classifySheetLine = (line: string, transpose: number): SheetLine => {
  if (!line.trim()) return { kind: 'blank' }

  const tokens = line.split(delimiterMatcher).filter((token) => token !== '')
  const sanitizedTokens = tokens.filter((token) => !testSpaces(token))

  const hasValidChords = tokens.some((token) => testChords(token) || token === 'e')
  const isMixedContent = hasValidChords && testTokenContext(sanitizedTokens)

  if (hasValidChords && !isMixedContent) {
    const isTablature = isTablatureLine(line)
    return {
      kind: 'chord-line',
      tokens: tokens.map((token, i): SheetToken => {
        if (!testChords(token) && token !== 'e') return { kind: 'text', raw: token }
        if (isTablature && i === 0) return { kind: 'string-indicator', raw: token }
        return {
          kind: 'chord',
          raw: token,
          display: transposeChord(token === 'e' ? 'E' : token, transpose),
        }
      }),
    }
  }

  if (testHeader(line)) return { kind: 'header', text: line }

  return { kind: 'plain', text: line }
}
