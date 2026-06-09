import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getInvalidNotes, parseChordKey, GUITAR_TUNING, BASS_TUNING } from './chord-theory.js'
import type { ChordDiagramMap } from './chord-diagrams.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GUITAR_PATH = resolve(__dirname, '../../../../apps/klank/public/chords-guitar.json')
const BASS_PATH   = resolve(__dirname, '../../../../apps/klank/public/chords-bass.json')

function loadMap(path: string): ChordDiagramMap {
  return JSON.parse(readFileSync(path, 'utf-8')) as ChordDiagramMap
}

function auditMap(map: ChordDiagramMap, tuning: readonly number[]): string[] {
  const failures: string[] = []
  for (const [key, variants] of Object.entries(map)) {
    if (!parseChordKey(key)) continue  // skip unrecognised quality — separate guard
    for (const [i, variant] of variants.entries()) {
      const errors = getInvalidNotes(key, variant, tuning)
      if (errors.length > 0) {
        failures.push(
          `${key}[${i}] frets=${JSON.stringify(variant.frets)}: ` +
          `non-chord note(s) ${errors.map((e) => e.name).join(', ')}`,
        )
      }
    }
  }
  return failures
}

describe('chord data correctness', () => {
  it('all guitar chord variants use only notes belonging to the chord', () => {
    const failures = auditMap(loadMap(GUITAR_PATH), GUITAR_TUNING)
    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  it('all bass chord variants use only notes belonging to the chord', () => {
    const failures = auditMap(loadMap(BASS_PATH), BASS_TUNING)
    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  it('every chord key is a known root + quality combination', () => {
    const unknown: string[] = []
    for (const path of [GUITAR_PATH, BASS_PATH]) {
      for (const key of Object.keys(loadMap(path))) {
        if (!parseChordKey(key)) unknown.push(key)
      }
    }
    expect(unknown, `Unknown chord keys: ${unknown.join(', ')}`).toHaveLength(0)
  })
})
