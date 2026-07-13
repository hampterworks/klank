import { isChordSymbol, parseChordSymbol, formatChordSymbol, transposeChordSymbol } from './chord-symbol.js'
import { pitchName } from './chord-theory.js'

/** The 12-note chromatic scale starting at A, in the sharps-only spelling
 *  shared with chord-theory (A = pitch class 9). */
export const notes = Array.from({ length: 12 }, (_, i) => pitchName(9 + i))

/** Splits a token stream on whitespace, pipe, parentheses, and common punctuation. */
export const delimiterMatcher = /(?<whitespace>\s+|\||\(|\)|-|,|\*|%)/

/**
 * Returns true if the line is a guitar tablature line.
 * Tablature lines start with a note letter (optionally sharped/flatted) followed by `|`,
 * e.g. `E|---0--2---` or `A#|--5--`.
 */
export const isTablatureLine = (line: string): boolean =>
  /^[A-Ga-g][#b]?\|/.test(line)

/**
 * Returns true if the string looks like a section header, e.g. `[Verse]` or `[Chorus 1]`.
 */
export const testHeader = (string: string) => /^\s*\[[a-zA-Z0-9\s]+\]/.test(string)

/**
 * Returns true if `string` is a valid chord symbol.
 *
 * Thin wrapper over `isChordSymbol` — see chord-symbol.ts for the grammar.
 * Prefer `parseChordSymbol` in new code when the parsed structure is needed.
 *
 * Examples: `Am`, `C#maj7`, `Dm7/G`, `Eb`, `Bsus4`, `Am7b5`, `C6/9`.
 */
export const testChords = (string: string) => isChordSymbol(string)

/** Returns true if `string` contains only whitespace (or is empty). */
export const testSpaces = (string: string) => /^\s*$/.test(string)

/**
 * Matches chord-voicing tokens like A1, G1, F#1, F#2, F#3 — a note letter,
 * optional accidental(s), then only digits. These are not chords (they label a
 * string + fret), but they should not count as plain words when classifying
 * chord lines, and they must never be boxed/diagrammed as chords in the sheet.
 */
export const CHORD_LIKE_RE = /^[A-G][#b♭]{0,2}\d+$/

/**
 * Transposes a chord symbol by `transpose` semitones.
 *
 * - Positive `transpose` shifts up; negative shifts down; wraps at 12.
 * - Accidentals are resolved to a pitch class before transposing, so `Bb`
 *   transposed +2 correctly yields `C` (not `B#`). Output uses sharp notation.
 * - Bass notes (e.g. the `G` in `C/G`) are transposed by the same amount.
 * - Returns `chord` unchanged when `transpose === 0` or when `chord` is not
 *   a valid chord symbol.
 *
 * Prefer `transposeChordSymbol` in new code when working with parsed chords.
 */
export const transposeChord = (chord: string, transpose: number): string => {
  if (transpose === 0) return chord
  const parsed = parseChordSymbol(chord)
  if (parsed === null) return chord
  return formatChordSymbol(transposeChordSymbol(parsed, transpose))
}

/**
 * Returns true if `tokens` represent a lyric line with embedded chord annotations,
 * i.e. chords are in the minority among non-delimiter tokens.
 *
 * Returns false if all tokens are chords (chord line), all tokens are non-chords
 * (lyric-only line), or chords are in the majority (strictly more than other
 * tokens). Ties → mixed → plain, unless `hasWideGaps` marks the line as
 * column-aligned (tokens separated by 2+-space runs, the layout of chord lines
 * positioned over lyrics), which breaks the tie toward chord line. Also returns
 * false immediately if `tokens[1]` is `|` (tablature line).
 *
 * Parenthesized tokens are stripped before counting.
 */
export const testTokenContext = (tokens: string[], hasWideGaps = false) => {
  if (tokens[1] === '|') return false

  const tokensWithoutParentheses =  tokens.reduce<{ result: string[], skip: boolean }>((acc, token) => {
    if (token === '(') return { ...acc, skip: true }
    if (token === ')') return { ...acc, skip: false }
    if (!acc.skip) return { ...acc, result: [...acc.result, token] }
    return acc
  }, { result: [], skip: false }).result

  // Full-match against the delimiter set: tokens that merely *contain* a
  // delimiter character (e.g. the merged minor chord `C-7`) must be kept.
  const normalizedTokens = tokensWithoutParentheses.filter(token => !/^(?:\s+|\||\(|\)|-|,|\*|%)$/.test(token))

  const isChordLike = (token: string) => testChords(token) || CHORD_LIKE_RE.test(token)

  if (normalizedTokens.every(token => isChordLike(token)) || normalizedTokens.every(token => !isChordLike(token))) return false

  const tokenCount = normalizedTokens.reduce((previousValue, currentValue) => {
    if (isChordLike(currentValue)) {
      return {chords: previousValue.chords + 1, other: previousValue.other}
    }
    return {chords: previousValue.chords, other: previousValue.other + 1}
  }, {chords: 0, other: 0})

  if (tokenCount.chords > tokenCount.other) return false

  // A 1:1 tie is ambiguous by token shape alone: `C7  Riff` is a chord
  // annotation, but `F#2 ... ?` is a voicing definition (F#2 also parses as a
  // sus2 chord). Layout disambiguates — only column-aligned lines win the tie.
  if (tokenCount.chords === tokenCount.other && hasWideGaps) return false

  return true
}
