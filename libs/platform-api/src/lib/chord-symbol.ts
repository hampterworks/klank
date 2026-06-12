import { CHORD_INTERVALS, NOTE_PITCH, pitchName, type ParsedChord } from './chord-theory.js'

/**
 * Permissive structured chord-symbol layer.
 *
 * This module is the single place where chord symbols written in tab text
 * (`Am`, `Bbmaj7`, `Dm7/G`, `E7#9`, `C6/9`, ...) are interpreted. Root and
 * bass notes are resolved to theory-grade pitch classes (C=0, shared with
 * chord-theory.ts); the quality suffix is validated against a grammar but
 * stored verbatim, so unconventional spellings like `Dmin7` survive a
 * parse/format round trip unchanged.
 */

/**
 * A chord symbol in parsed form.
 *
 * `suffix` is the verbatim quality text from the input (`''` for a plain
 * major chord) and is always grammar-valid when produced by
 * `parseChordSymbol`. It is *not* normalized: `Dmin7` keeps the suffix
 * `min7`, it does not become `m7`.
 */
export type ParsedChordSymbol = {
  /** Root pitch class, 0–11 with C=0. */
  rootPitch: number
  /** Verbatim quality suffix, e.g. `m7`, `maj7`, `7b5`; `''` = major. */
  suffix: string
  /** Slash-bass pitch class, 0–11 with C=0, when the symbol has one. */
  bassPitch?: number
}

/** Signed semitone offset of each accidental spelling. */
const ACCIDENTAL_OFFSET: Record<string, number> = {
  '#': 1, '##': 2, b: -1, bb: -2, '♭': -1, '♭♭': -2,
}

const NOTE_PREFIX = /^(?<letter>[A-G])(?<accidental>##|bb|♭♭|#|b|♭)?/

/**
 * Splits a leading note token off a string and resolves it to a pitch class.
 *
 * Accepts a note letter A–G followed by at most a double accidental
 * (`#`, `##`, `b`, `bb`, `♭`, `♭♭`). This is the only place in the codebase
 * where accidentals are interpreted; enharmonic spellings collapse to the
 * same pitch class (`Cb` → 11, same as `B`).
 *
 * @returns The pitch class and the unconsumed remainder, or `null` when the
 *          string does not start with a note.
 */
export const parseNotePrefix = (string: string): { pitch: number; rest: string } | null => {
  const match = NOTE_PREFIX.exec(string)
  if (match === null || match.groups === undefined) return null
  const offset = ACCIDENTAL_OFFSET[match.groups.accidental ?? ''] ?? 0
  const pitch = (((NOTE_PITCH[match.groups.letter] + offset) % 12) + 12) % 12
  return { pitch, rest: string.slice(match[0].length) }
}

// Quality suffix grammar: quality? extension? (quality extension)? alteration{0,2}
//
// Accepts the conventional chord vocabulary — m, maj7, sus4, dim, aug, 5,
// add9, 7sus4, m7add9, 6/9, altered tones like m7b5 or 7#9, and the
// jazz/lead-sheet symbols - (minor), + (augmented), ° (diminished) and
// ø (half-diminished) — while rejecting non-chords such as Cmaj23 or C97.
// Extensions are limited to the numbers that name real chord tones.
const QUALITY = '(?:maj|min|m|M|dim|aug|sus|add|-|\\+|°|ø)'
// Bare m/M and the single-symbol qualities cannot stack onto an extension
// (C7m7 is not a chord); spelled-out qualities can (Cmmaj7, C7sus4, m7add9).
const TAIL_QUALITY = '(?:maj|min|sus|dim|add)'
const NUMBER = '(?:13|11|9|7|6|5|4|2)'
const EXTENSION = '(?:13|11|9|7|69|6(?:\\/9)?|5|4|2)'
const ALTERATION = `(?:[#b♭]${NUMBER})`
const SUFFIX_MATCHER = new RegExp(`^${QUALITY}?${EXTENSION}?(?:${TAIL_QUALITY}${NUMBER})?${ALTERATION}{0,2}$`)

/**
 * Parses a whole token as a chord symbol.
 *
 * A chord symbol is a note (see `parseNotePrefix`), an optional quality
 * suffix, and an optional `/bass` note. The bass split takes the last `/`
 * whose remainder is exactly a note, so the `6/9` suffix is never mistaken
 * for a slash bass (`C6/9` has no bass; `C6/9/E` does).
 *
 * @returns The parsed symbol, or `null` when the token is not a chord.
 */
export const parseChordSymbol = (token: string): ParsedChordSymbol | null => {
  const root = parseNotePrefix(token)
  if (root === null) return null

  let suffix = root.rest
  let bassPitch: number | undefined

  const slashIndex = root.rest.lastIndexOf('/')
  if (slashIndex !== -1) {
    const bass = parseNotePrefix(root.rest.slice(slashIndex + 1))
    if (bass !== null && bass.rest === '') {
      suffix = root.rest.slice(0, slashIndex)
      bassPitch = bass.pitch
    }
  }

  if (!SUFFIX_MATCHER.test(suffix)) return null
  return bassPitch === undefined
    ? { rootPitch: root.pitch, suffix }
    : { rootPitch: root.pitch, suffix, bassPitch }
}

/**
 * Renders a parsed symbol back to a string in canonical sharps-only form
 * (`{ rootPitch: 10, suffix: 'm7' }` → `A#m7`). Inverse of `parseChordSymbol`
 * up to enharmonic spelling of the input.
 */
export const formatChordSymbol = (parsed: ParsedChordSymbol): string => {
  const bass = parsed.bassPitch !== undefined ? `/${pitchName(parsed.bassPitch)}` : ''
  return `${pitchName(parsed.rootPitch)}${parsed.suffix}${bass}`
}

/**
 * Transposes a parsed symbol by `semitones` (any integer, wraps at 12).
 * Root and bass move together; the suffix is untouched.
 */
export const transposeChordSymbol = (parsed: ParsedChordSymbol, semitones: number): ParsedChordSymbol => {
  const shift = (pitch: number) => (((pitch + semitones) % 12) + 12) % 12
  return {
    ...parsed,
    rootPitch: shift(parsed.rootPitch),
    ...(parsed.bassPitch !== undefined ? { bassPitch: shift(parsed.bassPitch) } : {}),
  }
}

/** Returns true if `token` is a chord symbol (see `parseChordSymbol`). */
export const isChordSymbol = (token: string): boolean => parseChordSymbol(token) !== null

/**
 * Rewrites equivalent quality spellings to the canonical form used by
 * `CHORD_INTERVALS` and the chord-diagram JSON keys: `-` → `m`, `+` → `aug`,
 * `°` → `dim`, `ø`/`ø7` → `m7b5`, `min` → `m`, `M`/`maj` → `maj`/`''`, and
 * `6/9` → `69`. Spellings that are already canonical — or that name no
 * canonical quality — pass through verbatim. Idempotent.
 */
export const canonicalSuffix = (suffix: string): string => {
  if (suffix === 'ø' || suffix === 'ø7') return 'm7b5'
  let result = suffix
  if (result.startsWith('-')) result = 'm' + result.slice(1)
  else if (result.startsWith('+')) result = 'aug' + result.slice(1)
  else if (result.startsWith('°')) result = 'dim' + result.slice(1)
  else if (result.startsWith('min')) result = 'm' + result.slice(3)
  else if (result.startsWith('M') && !result.startsWith('Maj')) result = 'maj' + result.slice(1)
  result = result.replace('6/9', '69')
  return result === 'maj' ? '' : result
}

/**
 * Bridges the permissive symbol model to the strict theory model: succeeds
 * exactly when the canonicalized suffix is one of the qualities in
 * `CHORD_INTERVALS` (the qualities the chord-diagram data is generated for).
 */
export const toTheoryChord = (parsed: ParsedChordSymbol): ParsedChord | null => {
  const quality = canonicalSuffix(parsed.suffix)
  if (!(quality in CHORD_INTERVALS)) return null
  return parsed.bassPitch === undefined
    ? { rootPitch: parsed.rootPitch, quality }
    : { rootPitch: parsed.rootPitch, quality, bassPitch: parsed.bassPitch }
}
