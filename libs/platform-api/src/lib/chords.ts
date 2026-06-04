/** The 12-note chromatic scale starting at A. Index is used for semitone arithmetic. */
export const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

/** Splits a token stream on whitespace, pipe, parentheses, and common punctuation. */
export const delimiterMatcher = /(?<whitespace>\s+|\||\(|\)|-|,|\*|%)/

/**
 * Returns true if the line is a guitar tablature line.
 * Tablature lines start with a note letter (optionally sharped/flatted) followed by `|`,
 * e.g. `E|---0--2---` or `A#|--5--`.
 */
export const isTablatureLine = (line: string): boolean =>
  /^[A-G][#b]?\|/.test(line) || /^e\|/.test(line)

// Note pattern - captures the basic note and any accidentals
const notePattern = "(?<note>[A-G])(?<accidentals>(?:bb|b|♭♭|♭)|(?:##|#))?"

// Chord quality pattern - captures chord types and modifications
const chordQualityPattern = '(maj|[Mm]|min|sus|dim|add)?'
const chordQualityRequired = '(?:maj|[Mm]|min|sus|dim|add)'
const chordNumberPattern = '(?:[1-9]|1[0-9]|2[0-3])?'
const chordNumberRequiredPattern = '(?:[1-9]|1[0-9]|2[0-3])'

// Rejects any chord containing three or more consecutive accidentals (### / bbb / ♭♭♭)
const noTriples = '^(?!.*(?:#{3}|b{3}|♭{3}))'

// Combines the chord components into the chords group (quality + extension, repeated at most twice)
const chordsPattern =
  `(?<chords>` +
  chordQualityPattern +      // 1st quality
  chordNumberPattern +       // 1st number
  `(?:${chordQualityRequired}${chordNumberRequiredPattern})?` +  // 2nd quality+number
  `)?`

// Bass note pattern - captures the optional bass note after the slash (e.g. C/G)
const bassPattern = "(?:\\/(?<bass>(?<bassNote>[A-G])(?<bassAccidentals>(?:b|bb|♭|♭♭)|(?:#|##))?))?";

// Combine all patterns into the final chord matcher
const chordMatcher = `${notePattern}${chordsPattern}${bassPattern}`

/**
 * Returns true if the string looks like a section header, e.g. `[Verse]` or `[Chorus 1]`.
 */
export const testHeader = (string: string) => /\[[a-zA-Z0-9\s]+/.test(string)

/**
 * Returns true if `string` is a valid chord symbol.
 *
 * Valid chords: root note (A–G) + optional accidental (#, ##, b, bb, ♭, ♭♭) +
 * optional quality (maj, m, M, min, sus, dim, add) + optional extension (1–23) +
 * optional slash bass note (e.g. `/G`). Rejects strings with triple accidentals.
 *
 * Examples: `Am`, `C#maj7`, `Dm7/G`, `Eb`, `Bsus4`.
 */
export const testChords = (string: string) => {
  const match = (new RegExp(noTriples + chordMatcher + '$')).exec(string)

  if (match === null || match.length === 0)
    return false
  if (match[0] === string)
    return true

  return false
}

/** Returns true if `string` contains only whitespace (or is empty). */
export const testSpaces = (string: string) => /^\s*$/.test(string)

/** Maps an accidentals string to a signed semitone offset (flats = negative, sharps = positive). */
const getNoteOffset = (string: string | undefined) => {
  if (string === undefined) {
    return 0
  }
  const regex = /^(?<flats>bb|b|♭♭|♭)|(?<sharps>##|#)$/
  const accidentals = regex.exec(string)

  if (accidentals === null) {
    return 0
  } else if (["b", "bb", "♭", "♭♭"].includes(accidentals[0])) {
    return string.length * -1
  }
  return string.length
}

/** Wraps a note index into the 0–11 range regardless of sign or magnitude. */
const normalizeNoteIndex = (noteNumber: number): number => ((noteNumber % notes.length) + notes.length) % notes.length

/** Parses a chord string into its named regex groups. */
const matchChords = (string: string) => (new RegExp(chordMatcher).exec(string))

/**
 * Transposes a chord symbol by `transpose` semitones.
 *
 * - Positive `transpose` shifts up; negative shifts down.
 * - Accidentals in the input are resolved to a semitone index before transposing,
 *   so `Bb` transposed +2 correctly yields `C` (not `B#`).
 * - Bass notes (e.g. the `G` in `C/G`) are transposed independently by the same amount.
 * - Returns `chord` unchanged when `transpose === 0`.
 *
 * @param chord     A valid chord symbol (see `testChords`).
 * @param transpose Semitone offset. May be any integer; wraps at 12.
 * @returns The transposed chord string using sharp notation for all output notes.
 */
export const transposeChord = (chord: string, transpose: number): string => {
  const currentNote = matchChords(chord)?.groups
  const matchedChords = currentNote?.chords

  if (transpose !== 0) {
    const noteIndex = notes.findIndex(sequenceNote => sequenceNote === currentNote?.note)
    const bassNoteIndex = notes.findIndex(sequenceNote => sequenceNote === currentNote?.bassNote)

    const transposedNoteIndex = normalizeNoteIndex(noteIndex + getNoteOffset(currentNote?.accidentals ?? '') + transpose)
    const transposedBassNoteIndex = currentNote?.bassNote !== undefined ? normalizeNoteIndex(bassNoteIndex + getNoteOffset(currentNote.bassAccidentals) + transpose) : null

    const bassChord = transposedBassNoteIndex !== null
      ? `/${notes[transposedBassNoteIndex]}`
      : '';

    return `${notes[transposedNoteIndex]}${matchedChords ?? ''}${bassChord}`
  }
  return chord
}

/**
 * Returns true if `tokens` represent a lyric line with embedded chord annotations,
 * i.e. chords are in the minority among non-delimiter tokens.
 *
 * Returns false if all tokens are chords (chord line), all tokens are non-chords
 * (lyric-only line), or the token count is tied. Also returns false immediately
 * if `tokens[1]` is `|` (tablature line).
 *
 * Parenthesized tokens are stripped before counting.
 */
export const testTokenContext = (tokens: string[]) => {
  if (tokens[1] === '|') return false

  const tokensWithoutParentheses =  tokens.reduce<{ result: string[], skip: boolean }>((acc, token) => {
    if (token === '(') return { ...acc, skip: true }
    if (token === ')') return { ...acc, skip: false }
    if (!acc.skip) return { ...acc, result: [...acc.result, token] }
    return acc
  }, { result: [], skip: false }).result

  const normalizedTokens = tokensWithoutParentheses.filter(token => !delimiterMatcher.test(token))

  if (normalizedTokens.every(token => testChords(token)) || normalizedTokens.every(token => !testChords(token))) return false

  const tokenCount = normalizedTokens.reduce((previousValue, currentValue) => {
    if (testChords(currentValue)) {
      return {chords: previousValue.chords + 1, other: previousValue.other}
    }
    return {chords: previousValue.chords, other: previousValue.other + 1}
  }, {chords: 0, other: 0})

  if (tokenCount.chords >= tokenCount.other) return false

  return true
}
