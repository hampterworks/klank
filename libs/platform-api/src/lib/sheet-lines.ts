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
 * Re-joins minor-dash chords that the delimiter split tore apart: `-` is a
 * delimiter (tablature dashes), so `C-7` tokenizes as `C`,`-`,`7`. A note
 * token followed by a single `-` is merged back when the result is a chord —
 * together with the next token when the three parse as one chord (`C-7`),
 * or alone when the dash ends the chord and whitespace or the line end
 * follows (so lyric hyphens like `A-flat` never merge). Dash runs (`--`)
 * never merge. Callers must skip this pass on tablature lines.
 */
const mergeDashChords = (tokens: string[]): string[] => {
  const merged: string[] = []
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    const next = tokens[i + 2]
    if (tokens[i + 1] === '-' && next !== '-') {
      if (next !== undefined && testChords(token + '-' + next)) {
        merged.push(token + '-' + next)
        i += 3
        continue
      }
      if ((next === undefined || testSpaces(next)) && testChords(token + '-')) {
        merged.push(token + '-')
        i += 2
        continue
      }
    }
    merged.push(token)
    i++
  }
  return merged
}

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

  const splitTokens = line.split(delimiterMatcher).filter((token) => token !== '')
  const tokens = isTablatureLine(line) ? splitTokens : mergeDashChords(splitTokens)
  const sanitizedTokens = tokens.filter((token) => !testSpaces(token))

  const hasValidChords = tokens.some((token) => testChords(token) || token === 'e')
  const isMixedContent = hasValidChords && testTokenContext(sanitizedTokens)

  if (hasValidChords && !isMixedContent) {
    const isTablature = isTablatureLine(line)
    return {
      kind: 'chord-line',
      tokens: tokens.map((token, i): SheetToken => {
        if (!testChords(token) && token !== 'e' && !CHORD_LIKE_RE.test(token)) return { kind: 'text', raw: token }
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
