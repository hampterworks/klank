import { canonicalSuffix, parseChordSymbol } from './chord-symbol.js'
import { pitchName } from './chord-theory.js'
import { getDiatonicTriads, getScaleById, getScalePitches } from './scales.js'
import { classifySheetLine } from './sheet-lines.js'
import { testHeader } from './chords.js'

/**
 * Detects the musical key of a tab from its chords alone (root-membership
 * scoring against the major/natural-minor scales), for the "show detected
 * key" toolbar feature. Pure music theory — no React, no IO.
 */

export type SongKey = { rootPitch: number; isMinor: boolean }

export type SongKeyResult =
  | { kind: 'single'; key: SongKey }
  | { kind: 'change'; from: SongKey; to: SongKey; atSection: string }

/** A chord occurrence as written in the tab, tagged with the index of the
 *  section it appeared in (sections are numbered in order of first line). */
type ChordOccurrence = { rootPitch: number; suffix: string; section: number }

type Section = { name: string; occurrences: ChordOccurrence[] }

const MOD12 = (n: number): number => ((n % 12) + 12) % 12

/** A candidate key must explain at least this many chord occurrences before
 *  it is trusted — a couple of stray chords are not enough evidence. */
const MIN_OCCURRENCES = 4
/** ...and those occurrences must name at least this many distinct roots.
 *  Two notes (e.g. a song built entirely on A5/E5 power chords) are diatonic
 *  to many keys at once — root-membership scoring can't tell them apart, so
 *  there is no real evidence of a key until a third distinct root shows up. */
const MIN_DISTINCT_ROOTS = 3
/** A candidate key's root-membership fit must clear this fraction before
 *  it is accepted as confident. */
const MIN_FIT = 0.85
/** Per-occurrence tie-break bonus for a chord that is the candidate's own
 *  tonic triad — disambiguates a relative major/minor pair when one tonic
 *  chord is played noticeably more often than the other (e.g. Am dominating
 *  an Am-F-G-Em vamp), which otherwise scores identically on root membership
 *  and diatonic-quality matching alone (relative keys share both). */
const TONIC_BONUS = 0.001
/** Per-occurrence tie-break bonus for a chord whose root+quality matches the
 *  candidate's diatonic triad at that scale degree — disambiguates *non*
 *  relative same-root-set ties (e.g. an Aeolian vamp vs. its IV chord's
 *  major key), which the tonic-only bonus above cannot see since it only
 *  looks at the tonic occurrence. Both bonuses are small enough that no
 *  number of occurrences can flip a MIN_FIT accept/reject decision on its
 *  own — they only break ties among candidates that already qualify. */
const DIATONIC_BONUS = 0.001
/** Tolerance for comparing candidate scores when checking for a tie at the
 *  top — guards against float noise, not genuine near-ties. */
const SCORE_EPSILON = 1e-9

/**
 * Walks `tabData` line by line, grouping chord occurrences by section
 * (text between `[Header]` lines, in order of first appearance). Detection
 * always runs untransposed (transpose 0): the caller shifts the *displayed*
 * result by the live transpose, since transposition is a uniform pitch shift.
 */
const extractSections = (tabData: string): Section[] => {
  const sections: Section[] = [{ name: 'Intro', occurrences: [] }]

  for (const line of tabData.split(/\r\n|\r|\n/)) {
    if (testHeader(line)) {
      sections.push({ name: line.trim(), occurrences: [] })
      continue
    }

    const classified = classifySheetLine(line, 0)
    if (classified.kind !== 'chord-line') continue

    const current = sections[sections.length - 1]
    for (const token of classified.tokens) {
      if (token.kind !== 'chord') continue
      const parsed = parseChordSymbol(token.raw)
      if (parsed === null) continue
      current.occurrences.push({ rootPitch: parsed.rootPitch, suffix: parsed.suffix, section: sections.length - 1 })
    }
  }

  return sections
}

/** True when a chord's quality reads as the major tonic for a major candidate,
 *  or the minor tonic for a minor candidate (used only for the tie-break bonus). */
const isTonicQuality = (suffix: string, isMinor: boolean): boolean => {
  const canonical = canonicalSuffix(suffix)
  return isMinor ? canonical.startsWith('m') && !canonical.startsWith('maj') : canonical === ''
}

/** Reduces a canonical chord-quality suffix to the bucket relevant for
 *  diatonic-triad comparison: `''` (major family: maj7, 6, 9, ...), `'m'`
 *  (minor family: m7, m9, m6, ...), or the suffix itself for `dim`/`aug`
 *  families. Anything else (e.g. the rootless power chord `'5'`) reduces to
 *  `null`, since it carries no major/minor information and should match
 *  nothing. */
const qualityBucket = (suffix: string): string | null => {
  const canonical = canonicalSuffix(suffix)
  if (canonical === '') return ''
  if (canonical.startsWith('maj')) return ''
  if (canonical.startsWith('m') && !canonical.startsWith('m7b5')) return 'm'
  if (canonical.startsWith('dim')) return 'dim'
  if (canonical.startsWith('aug')) return 'aug'
  return null
}

/** Builds a `rootPitch -> quality bucket` map of the candidate's diatonic
 *  triads, for scoring how well each chord occurrence's own quality matches
 *  what the candidate key would expect at that root. */
const diatonicQualityByRoot = (rootPitch: number, isMinor: boolean): Map<number, string> => {
  const scale = getScaleById(isMinor ? 'aeolian' : 'ionian')!
  const map = new Map<number, string>()
  for (const { chordKey } of getDiatonicTriads(rootPitch, scale)) {
    if (chordKey === null) continue
    const parsed = parseChordSymbol(chordKey)
    if (parsed === null) continue
    const bucket = qualityBucket(parsed.suffix)
    if (bucket !== null) map.set(parsed.rootPitch, bucket)
  }
  return map
}

const sameKey = (a: SongKey, b: SongKey): boolean => a.rootPitch === b.rootPitch && a.isMinor === b.isMinor

/**
 * Scores every one of the 24 candidate keys (12 roots × major/minor) against
 * `occurrences` and returns the best one, or `null` when no candidate clears
 * the minimum occurrence count and minimum fit score, or when the top score
 * is tied between two or more distinct keys (genuinely ambiguous evidence).
 */
const detectKeyForOccurrences = (occurrences: ChordOccurrence[]): SongKey | null => {
  if (occurrences.length < MIN_OCCURRENCES) return null
  if (new Set(occurrences.map((o) => o.rootPitch)).size < MIN_DISTINCT_ROOTS) return null

  const ionian = getScaleById('ionian')!
  const aeolian = getScaleById('aeolian')!

  const scored: { key: SongKey; score: number }[] = []
  for (let rootPitch = 0; rootPitch < 12; rootPitch++) {
    for (const isMinor of [false, true]) {
      const scalePitches = new Set(getScalePitches(rootPitch, isMinor ? aeolian : ionian))
      const diatonicQuality = diatonicQualityByRoot(rootPitch, isMinor)
      let inScale = 0
      let bonus = 0
      for (const occurrence of occurrences) {
        if (scalePitches.has(occurrence.rootPitch)) inScale++
        if (occurrence.rootPitch === rootPitch && isTonicQuality(occurrence.suffix, isMinor)) bonus += TONIC_BONUS
        const expected = diatonicQuality.get(occurrence.rootPitch)
        if (expected !== undefined && qualityBucket(occurrence.suffix) === expected) bonus += DIATONIC_BONUS
      }
      const score = inScale / occurrences.length + bonus
      scored.push({ key: { rootPitch, isMinor }, score })
    }
  }

  let best = scored[0]
  for (const candidate of scored) {
    if (candidate.score > best.score) best = candidate
  }

  const fit = Math.min(1, best.score) // strip the tie-break bonus back off for the threshold check
  if (fit < MIN_FIT) return null

  const tiedAtTop = scored.filter(
    (candidate) => Math.abs(candidate.score - best.score) <= SCORE_EPSILON && !sameKey(candidate.key, best.key),
  )

  // A relative major/minor pair (e.g. C major / A minor) shares the exact same
  // diatonic chords, so it can reach a genuine, irreducible tie on root
  // membership, tonic weight, *and* diatonic-quality matching all at once.
  // Default to the major key in that specific case — standard practice when
  // a progression gives no other evidence of which is the true tonic — but
  // only when the tie is *exactly* that one relative pair; any other tie
  // (e.g. unrelated keys sharing a thin power-chord vocabulary) is left as
  // genuine ambiguity below.
  if (tiedAtTop.length === 1 && best.key.isMinor !== tiedAtTop[0].key.isMinor) {
    const [major, minor] = best.key.isMinor ? [tiedAtTop[0].key, best.key] : [best.key, tiedAtTop[0].key]
    if (MOD12(minor.rootPitch + 3) === major.rootPitch) {
      return major
    }
  }

  if (tiedAtTop.length > 0) return null

  return best.key
}

/**
 * Detects the song's key (or a single clean key change) from its chords.
 *
 * - One section (no headers, or only one) → `{ kind: 'single' }` when
 *   confident, else `null`.
 * - Multiple sections → each is scored independently; sections too thin on
 *   chords to meet `MIN_OCCURRENCES` are skipped (neither help nor hurt).
 *   Consecutive identical keys collapse into runs. Zero runs → `null`. One
 *   run → `{ kind: 'single' }`. Exactly two runs (a clean A→B switch that
 *   never returns to A) → `{ kind: 'change' }`. Three or more runs, or A
 *   reappearing after B, is "too complex" → `null`.
 */
export const detectSongKey = (tabData: string): SongKeyResult | null => {
  const sections = extractSections(tabData)

  if (sections.length <= 1) {
    const key = detectKeyForOccurrences(sections[0]?.occurrences ?? [])
    return key === null ? null : { kind: 'single', key }
  }

  const runs: { key: SongKey; sectionName: string }[] = []
  for (const section of sections) {
    const key = detectKeyForOccurrences(section.occurrences)
    if (key === null) continue
    const last = runs[runs.length - 1]
    if (last !== undefined && sameKey(last.key, key)) continue
    runs.push({ key, sectionName: section.name })
  }

  if (runs.length === 0) return null
  if (runs.length === 1) return { kind: 'single', key: runs[0].key }
  if (runs.length === 2) {
    return { kind: 'change', from: runs[0].key, to: runs[1].key, atSection: runs[1].sectionName }
  }
  // 3+ runs, or a key reappearing after a switch (which also yields 3+ runs
  // since the collapse only merges *consecutive* duplicates) — too complex.
  return null
}

/**
 * Renders a key as `"G"` or `"Em"`, after shifting `rootPitch` by `transpose`
 * semitones (wraps at 12, same pattern as `transposeChordSymbol`).
 */
export const formatSongKey = (key: SongKey, transpose = 0): string => {
  const shifted = (((key.rootPitch + transpose) % 12) + 12) % 12
  return pitchName(shifted) + (key.isMinor ? 'm' : '')
}
