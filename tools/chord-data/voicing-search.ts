import type { ChordVariant, Instrument } from '../../libs/platform-api/src/lib/chord-diagrams.ts'
import {
  CHORD_INTERVALS,
  INSTRUMENT_TUNING,
  MAX_SPAN,
  getAllowedPitches,
  getRequiredPitches,
  getVariantNotes,
  parseChordKey,
  validateChordVariant,
} from '../../libs/platform-api/src/lib/chord-theory.ts'

const MAX_BASE = 12
const MAX_FINGERS = 4

export type ScoredVariant = { variant: ChordVariant; score: number }

/** Lowest fretted fret — the neck position of a shape (0 = all open). */
export function positionOf(variant: ChordVariant): number {
  const fretted = variant.frets.filter((f) => f > 0)
  return fretted.length > 0 ? Math.min(...fretted) : 0
}

/** Deterministic playability/idiomaticity score — higher is better. */
function scoreVariant(variant: ChordVariant, quality: string, rootPitch: number, tuning: readonly number[]): number {
  const { frets, barres } = variant
  const sounding = frets.filter((f) => f >= 0)
  const fretted = frets.filter((f) => f > 0)
  const open = frets.filter((f) => f === 0)
  const maxFret = fretted.length > 0 ? Math.max(...fretted) : 0
  const span = fretted.length > 0 ? maxFret - Math.min(...fretted) : 0
  const openPosition = maxFret <= 3

  let score = 4 * sounding.length
  if (openPosition) {
    score += 8 + 2 * open.length
  } else {
    // open strings ringing under a shape played up the neck are unidiomatic
    score -= 6 * open.length
  }
  score -= 2 * Math.max(0, positionOf(variant) - 1)
  if (barres.length > 0) score -= 6
  score -= 2 * fretted.length
  score -= 4 * Math.max(0, span - 2)
  if (CHORD_INTERVALS[quality].length === 4) {
    const fifth = (rootPitch + 7) % 12
    if (getVariantNotes(variant, tuning).has(fifth)) score += 6
  }
  return score
}

/** Lexicographic comparison of fret arrays — the deterministic tie-breaker. */
function compareFrets(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

/**
 * Assigns fingers and barres to a fret combination, or returns null when no
 * physically sensible assignment exists. Fingers follow sorted (fret, string)
 * order, which reproduces canonical fingerings for open shapes; five or more
 * fretted positions become an index-finger barre at the lowest fret.
 */
export function assignFingering(frets: number[], strings: number): ChordVariant | null {
  const positions = frets
    .map((fret, string) => ({ fret, string }))
    .filter((p) => p.fret > 0)
    .sort((a, b) => a.fret - b.fret || a.string - b.string)

  const fretted = positions.map((p) => p.fret)
  const maxFret = fretted.length > 0 ? Math.max(...fretted) : 0
  const minFret = fretted.length > 0 ? Math.min(...fretted) : 0
  const baseFret = maxFret <= 5 ? 1 : minFret

  const fingers = Array.from({ length: strings }, () => 0)
  const barres: ChordVariant['barres'] = []

  if (positions.length <= MAX_FINGERS) {
    positions.forEach((p, i) => {
      fingers[p.string] = i + 1
    })
  } else {
    // barre with the index finger across every string at the lowest fret
    const barred = positions.filter((p) => p.fret === minFret)
    if (barred.length < 2) return null
    const rest = positions.filter((p) => p.fret > minFret)
    if (rest.length > MAX_FINGERS - 1) return null

    const fromString = barred[0].string
    const toString = barred[barred.length - 1].string
    for (let s = fromString; s <= toString; s++) {
      if (frets[s] < minFret) return null // open or muted string under the bar
    }
    for (const p of barred) fingers[p.string] = 1
    rest.forEach((p, i) => {
      fingers[p.string] = i + 2
    })
    barres.push({ fret: minFret - baseFret + 1, fromString, toString })
  }

  return { frets, fingers, baseFret, barres }
}

/**
 * Enumerates every valid voicing of a chord on an instrument: contiguous
 * sounding strings, fretted notes inside a sliding 4-fret window, lowest
 * sounding string playing the root (or slash bass), all required chord tones
 * present, and a physically assignable fingering that passes the full
 * validator. Results are deterministic and sorted best-first.
 */
export function searchVoicings(chordKey: string, instrument: Instrument): ScoredVariant[] {
  const parsed = parseChordKey(chordKey)
  if (!parsed) throw new Error(`unknown chord key "${chordKey}"`)
  const tuning = INSTRUMENT_TUNING[instrument]
  const n = tuning.length

  const allowed = getAllowedPitches(parsed)
  const required = getRequiredPitches(parsed)
  const bassPitch = parsed.bassPitch ?? parsed.rootPitch
  // even power chords get 3 strings (root, 5th, octave) — the shape players know
  const minSounding = 3

  const seen = new Set<string>()
  const results: ScoredVariant[] = []

  const tryCandidate = (frets: number[]) => {
    const signature = frets.join(',')
    if (seen.has(signature)) return
    seen.add(signature)

    const variant = assignFingering(frets, n)
    if (!variant) return
    if (validateChordVariant(chordKey, variant, instrument).length > 0) return
    results.push({
      variant,
      score: scoreVariant(variant, parsed.quality, parsed.rootPitch, tuning),
    })
  }

  for (let base = 1; base <= MAX_BASE; base++) {
    const windowMax = base + MAX_SPAN
    for (let start = 0; start <= n - minSounding; start++) {
      for (let end = start + minSounding - 1; end < n; end++) {
        // options per sounding string: open string or an allowed tone inside the
        // window; open strings only mix with shapes at the nut — ringing opens
        // under a hand parked at the 5th fret are unidiomatic
        const options: number[][] = []
        for (let s = start; s <= end; s++) {
          const stringOptions: number[] = []
          if (base === 1 && allowed.has(tuning[s] % 12)) stringOptions.push(0)
          for (let f = base; f <= windowMax; f++) {
            if (allowed.has((tuning[s] + f) % 12)) stringOptions.push(f)
          }
          options.push(stringOptions)
        }
        if (options.some((o) => o.length === 0)) continue

        const frets = Array.from({ length: n }, () => -1)
        const sounded = new Map<number, number>() // pitch -> count

        const dfs = (s: number) => {
          if (s > end) {
            if ([...required].every((p) => (sounded.get(p) ?? 0) > 0)) {
              tryCandidate([...frets])
            }
            return
          }
          for (const f of options[s - start]) {
            const pitch = (tuning[s] + f) % 12
            if (s === start && pitch !== bassPitch) continue
            frets[s] = f
            sounded.set(pitch, (sounded.get(pitch) ?? 0) + 1)
            dfs(s + 1)
            sounded.set(pitch, (sounded.get(pitch) ?? 0) - 1)
            frets[s] = -1
          }
        }
        dfs(start)
      }
    }
  }

  results.sort((a, b) => b.score - a.score || compareFrets(a.variant.frets, b.variant.frets))
  return results
}

/** Diverse picks below this score are too awkward to ship as alternatives. */
const DIVERSITY_SCORE_FLOOR = -12

/**
 * Picks up to `count` voicings from a best-first list. A first pass prefers
 * shapes whose neck position differs by at least 2 frets from everything
 * already chosen (genuinely different voicings, not near-duplicates), a
 * second pass fills remaining slots best-first. The preselected seed stays
 * first; other picks are ordered low position to high.
 */
export function selectVoicings(
  ranked: readonly ScoredVariant[],
  count: number,
  preselected: readonly ChordVariant[] = [],
): ChordVariant[] {
  const picked: ChordVariant[] = [...preselected]
  const isDuplicate = (v: ChordVariant) =>
    picked.some((p) => p.frets.join(',') === v.frets.join(','))

  for (const diverse of [true, false]) {
    for (const { variant, score } of ranked) {
      if (picked.length >= count) break
      if (isDuplicate(variant)) continue
      if (score < DIVERSITY_SCORE_FLOOR && picked.length > 0) continue
      if (diverse && picked.some((p) => Math.abs(positionOf(p) - positionOf(variant)) < 2)) continue
      picked.push(variant)
    }
  }

  const searched = picked.slice(preselected.length)
  const scoreOf = new Map(ranked.map(({ variant, score }) => [variant.frets.join(','), score]))
  searched.sort(
    (a, b) =>
      positionOf(a) - positionOf(b) ||
      (scoreOf.get(b.frets.join(',')) ?? 0) - (scoreOf.get(a.frets.join(',')) ?? 0) ||
      compareFrets(a.frets, b.frets),
  )
  return [...picked.slice(0, preselected.length), ...searched]
}
