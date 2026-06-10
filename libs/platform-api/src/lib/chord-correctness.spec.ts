import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CHORD_INTERVALS,
  expectedChordKeys,
  findDuplicateVariants,
  getInvalidNotes,
  getRequiredPitches,
  getVariantNotes,
  parseChordKey,
  pitchName,
  validateChordVariant,
  GUITAR_TUNING,
  BASS_TUNING,
} from './chord-theory.js'
import type { ChordDiagramMap, Instrument } from './chord-diagrams.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA: Record<Instrument, { path: string; tuning: readonly number[] }> = {
  guitar: {
    path: resolve(__dirname, '../../../../apps/klank/public/chords-guitar.json'),
    tuning: GUITAR_TUNING,
  },
  bass: {
    path: resolve(__dirname, '../../../../apps/klank/public/chords-bass.json'),
    tuning: BASS_TUNING,
  },
}
const INSTRUMENTS = Object.keys(DATA) as Instrument[]

function loadMap(instrument: Instrument): ChordDiagramMap {
  return JSON.parse(readFileSync(DATA[instrument].path, 'utf-8')) as ChordDiagramMap
}

describe.each(INSTRUMENTS)('%s chord data', (instrument) => {
  const map = loadMap(instrument)

  it('defines exactly the expected chord keys, in order', () => {
    expect(Object.keys(map)).toEqual(expectedChordKeys())
  })

  it('has 1 to 4 variants per key with no duplicates', () => {
    for (const [key, variants] of Object.entries(map)) {
      expect(variants.length, `${key} variant count`).toBeGreaterThanOrEqual(1)
      expect(variants.length, `${key} variant count`).toBeLessThanOrEqual(4)
      expect(findDuplicateVariants(variants), `${key} duplicates`).toEqual([])
    }
  })

  it('uses only notes belonging to each chord', () => {
    const failures: string[] = []
    for (const [key, variants] of Object.entries(map)) {
      for (const [i, variant] of variants.entries()) {
        const errors = getInvalidNotes(key, variant, DATA[instrument].tuning)
        if (errors.length > 0) {
          failures.push(
            `${key}[${i}] frets=${JSON.stringify(variant.frets)}: ` +
              `non-chord note(s) ${errors.map((e) => e.name).join(', ')}`,
          )
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  it('every triad variant is complete — all chord tones present', () => {
    const failures: string[] = []
    for (const [key, variants] of Object.entries(map)) {
      const parsed = parseChordKey(key)
      if (!parsed || CHORD_INTERVALS[parsed.quality].length === 4) continue
      for (const [i, variant] of variants.entries()) {
        const sounded = getVariantNotes(variant, DATA[instrument].tuning)
        const missing = [...getRequiredPitches(parsed)].filter((p) => !sounded.has(p))
        if (missing.length > 0) {
          failures.push(
            `${key}[${i}] frets=${JSON.stringify(variant.frets)}: ` +
              `missing tone(s) ${missing.map(pitchName).join(', ')}`,
          )
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  it('every variant passes the full validator', () => {
    const failures: string[] = []
    for (const [key, variants] of Object.entries(map)) {
      for (const [i, variant] of variants.entries()) {
        for (const { rule, message } of validateChordVariant(key, variant, instrument)) {
          failures.push(`${key}[${i}] frets=${JSON.stringify(variant.frets)} ${rule}: ${message}`)
        }
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0)
  })
})
