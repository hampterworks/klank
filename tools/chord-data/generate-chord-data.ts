/**
 * Regenerates apps/klank/public/chords-guitar.json and chords-bass.json from
 * music theory: every voicing is searched, finger-assigned, and checked
 * against the strict validator in @klank/platform-api's chord-theory.
 *
 *   node tools/chord-data/generate-chord-data.ts             # write both files
 *   node tools/chord-data/generate-chord-data.ts --preview C G/B Dm   # ASCII diagrams
 *
 * Output is deterministic — rerunning produces byte-identical files.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChordDiagramMap, ChordVariant, Instrument } from '../../libs/platform-api/src/lib/chord-diagrams.ts'
import {
  DIAGRAM_ROWS,
  INSTRUMENT_TUNING,
  expectedChordKeys,
  validateChordVariant,
} from '../../libs/platform-api/src/lib/chord-theory.ts'
import { searchVoicings, selectVoicings } from './voicing-search.ts'
import { SEED_SHAPES, seedVariant } from './seeds.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = resolve(__dirname, '../../apps/klank/public')

const VARIANT_COUNT: Record<Instrument, { plain: number; slash: number }> = {
  guitar: { plain: 3, slash: 2 },
  bass: { plain: 2, slash: 2 },
}

function buildMap(instrument: Instrument): ChordDiagramMap {
  const map: ChordDiagramMap = {}
  for (const key of expectedChordKeys(instrument)) {
    const counts = VARIANT_COUNT[instrument]
    const count = key.includes('/') ? counts.slash : counts.plain

    const preselected: ChordVariant[] = []
    const seed = SEED_SHAPES[instrument][key]
    if (seed) preselected.push(seedVariant(seed))

    const ranked = searchVoicings(key, instrument)
    const variants = selectVoicings(ranked, count, preselected)
    if (variants.length === 0) {
      throw new Error(`${instrument} ${key}: search produced no valid voicing`)
    }
    for (const [i, variant] of variants.entries()) {
      const violations = validateChordVariant(key, variant, instrument)
      if (violations.length > 0) {
        const detail = violations.map((v) => `${v.rule}: ${v.message}`).join('; ')
        throw new Error(`${instrument} ${key}[${i}] frets=[${variant.frets}] invalid — ${detail}`)
      }
    }
    map[key] = variants
  }
  return map
}

/** One variant per line, matching the hand-reviewable style of the data files. */
function formatMap(map: ChordDiagramMap): string {
  const lines: string[] = ['{']
  const keys = Object.keys(map)
  keys.forEach((key, keyIdx) => {
    lines.push(`  ${JSON.stringify(key)}: [`)
    map[key].forEach((v, i) => {
      const barres = v.barres
        .map((b) => `{ "fret": ${b.fret}, "fromString": ${b.fromString}, "toString": ${b.toString} }`)
        .join(', ')
      const comma = i < map[key].length - 1 ? ',' : ''
      lines.push(
        `    { "frets": [${v.frets.join(', ')}], "fingers": [${v.fingers.join(', ')}], ` +
          `"baseFret": ${v.baseFret}, "barres": [${barres}] }${comma}`,
      )
    })
    lines.push(`  ]${keyIdx < keys.length - 1 ? ',' : ''}`)
  })
  lines.push('}')
  return lines.join('\n') + '\n'
}

function previewVariant(key: string, variant: ChordVariant, instrument: Instrument): string {
  const tuning = INSTRUMENT_TUNING[instrument]
  const n = tuning.length
  const { frets, fingers, baseFret, barres } = variant
  const lines: string[] = []

  const fretLabel = (f: number) => (f === -1 ? 'x' : String(f))
  lines.push(`${key} (${instrument})  frets=[${frets.map(fretLabel).join(' ')}]  baseFret=${baseFret}`)
  lines.push('  ' + frets.map((f) => (f === -1 ? 'x' : f === 0 ? 'o' : ' ')).join(' '))
  lines.push('  ' + (baseFret === 1 ? '='.repeat(n * 2 - 1) : '-'.repeat(n * 2 - 1)) + (baseFret > 1 ? `  ${baseFret}fr` : ''))
  for (let row = 1; row <= DIAGRAM_ROWS; row++) {
    const cells = frets.map((f, s) => {
      if (f - baseFret + 1 === row && f > 0) return String(fingers[s])
      if (barres.some((b) => b.fret === row && s >= b.fromString && s <= b.toString)) return '='
      return '|'
    })
    lines.push('  ' + cells.join(' '))
  }
  return lines.join('\n')
}

const args = process.argv.slice(2)

if (args[0] === '--preview') {
  const keys = args.slice(1)
  if (keys.length === 0) {
    console.error('usage: generate-chord-data.ts --preview <chordKey> [...]')
    process.exit(1)
  }
  for (const instrument of ['guitar', 'bass'] as const) {
    const map = buildMap(instrument)
    for (const key of keys) {
      const variants = map[key]
      if (!variants) {
        console.log(`${key} (${instrument}): not a generated key`)
        continue
      }
      for (const variant of variants) {
        console.log(previewVariant(key, variant, instrument))
        console.log()
      }
    }
  }
} else {
  for (const instrument of ['guitar', 'bass'] as const) {
    const map = buildMap(instrument)
    const file = resolve(PUBLIC_DIR, `chords-${instrument}.json`)
    writeFileSync(file, formatMap(map))
    const variantCount = Object.values(map).reduce((sum, v) => sum + v.length, 0)
    console.log(`wrote ${file}: ${Object.keys(map).length} keys, ${variantCount} variants`)
  }
}
