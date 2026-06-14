import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CHORD_QUALITIES, GUITAR_TUNING, BASS_TUNING } from './chord-theory.js'
import {
  SCALES,
  CHORD_SCALE_MAP,
  getScalePitches,
  getDegreeByPitch,
  getScaleById,
  scalesForQuality,
  getScaleFretboard,
  getScalePositions,
  getDiatonicTriads,
} from './scales.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const rootArb = fc.integer({ min: 0, max: 11 })
const scaleArb = fc.constantFrom(...SCALES)

// ── 1. Scale table invariants ─────────────────────────────────────────────────

describe('SCALES table', () => {
  it('intervals.length === degrees.length for every scale', () => {
    for (const scale of SCALES) {
      expect(scale.intervals.length, scale.id).toBe(scale.degrees.length)
    }
  })

  it('intervals are strictly ascending for every scale', () => {
    for (const scale of SCALES) {
      for (let i = 1; i < scale.intervals.length; i++) {
        expect(scale.intervals[i], `${scale.id}[${i}]`).toBeGreaterThan(scale.intervals[i - 1])
      }
    }
  })

  it('intervals[0] === 0 for every scale', () => {
    for (const scale of SCALES) {
      expect(scale.intervals[0], scale.id).toBe(0)
    }
  })

  it('all intervals are in 0..11 for every scale', () => {
    for (const scale of SCALES) {
      for (const interval of scale.intervals) {
        expect(interval, `${scale.id} interval ${interval}`).toBeGreaterThanOrEqual(0)
        expect(interval, `${scale.id} interval ${interval}`).toBeLessThanOrEqual(11)
      }
    }
  })

  it('intervals are unique within each scale', () => {
    for (const scale of SCALES) {
      const unique = new Set(scale.intervals)
      expect(unique.size, scale.id).toBe(scale.intervals.length)
    }
  })

  it('scale ids are globally unique', () => {
    const ids = SCALES.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('if modeOf is set, getScaleById(modeOf) resolves for every such scale', () => {
    for (const scale of SCALES) {
      if (scale.modeOf !== undefined) {
        expect(getScaleById(scale.modeOf), `${scale.id}.modeOf=${scale.modeOf}`).toBeDefined()
      }
    }
  })

  it('there are exactly 24 scales', () => {
    expect(SCALES.length).toBe(24)
  })
})

// ── 2. getScalePitches ────────────────────────────────────────────────────────

describe('getScalePitches', () => {
  it('returns the same number of pitches as intervals', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        expect(getScalePitches(root, scale)).toHaveLength(scale.intervals.length)
      }),
    )
  })

  it('all returned pitches are in 0..11', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        for (const pitch of getScalePitches(root, scale)) {
          expect(pitch).toBeGreaterThanOrEqual(0)
          expect(pitch).toBeLessThanOrEqual(11)
        }
      }),
    )
  })

  it('pitch set equals intervals shifted by root mod 12 for all roots and scales', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const expected = new Set(scale.intervals.map((i) => ((root + i) % 12 + 12) % 12))
        const actual = new Set(getScalePitches(root, scale))
        expect(actual).toEqual(expected)
      }),
    )
  })

  it('crafted: C ionian [0,2,4,5,7,9,11]', () => {
    const ionian = getScaleById('ionian')!
    expect(getScalePitches(0, ionian)).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it('crafted: C minor-pentatonic [0,3,5,7,10]', () => {
    const mp = getScaleById('minor-pentatonic')!
    expect(getScalePitches(0, mp)).toEqual([0, 3, 5, 7, 10])
  })

  it('crafted: G altered (root 7) contains expected pitch-class set [7,8,10,11,1,3,5]', () => {
    // Altered: [0,1,3,4,6,8,10] relative to root.
    // Root G = 7: 7,8,10,11,1,3,5
    const altered = getScaleById('altered')!
    const pitches = new Set(getScalePitches(7, altered))
    expect(pitches).toEqual(new Set([7, 8, 10, 11, 1, 3, 5]))
  })
})

// ── 3. Mode-rotation property ─────────────────────────────────────────────────

describe('mode-rotation property', () => {
  it('a mode rooted at r has the same pitch set as its parent rooted at (r - parent.intervals[modeDegree-1]) mod 12', () => {
    const modes = SCALES.filter((s) => s.modeOf !== undefined && s.modeDegree !== undefined)
    fc.assert(
      fc.property(rootArb, fc.constantFrom(...modes), (r, mode) => {
        const parent = getScaleById(mode.modeOf!)!
        const offset = parent.intervals[mode.modeDegree! - 1]
        const parentRoot = ((r - offset) % 12 + 12) % 12
        const modeSet = new Set(getScalePitches(r, mode))
        const parentSet = new Set(getScalePitches(parentRoot, parent))
        expect(modeSet).toEqual(parentSet)
      }),
    )
  })
})

// ── 4. getScaleFretboard ──────────────────────────────────────────────────────

describe('getScaleFretboard', () => {
  it('returns tuning.length rows × 13 columns (fretCount=12) for GUITAR_TUNING and BASS_TUNING', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const guitarBoard = getScaleFretboard(root, scale, GUITAR_TUNING)
        expect(guitarBoard).toHaveLength(GUITAR_TUNING.length)
        for (const row of guitarBoard) expect(row).toHaveLength(13)

        const bassBoard = getScaleFretboard(root, scale, BASS_TUNING)
        expect(bassBoard).toHaveLength(BASS_TUNING.length)
        for (const row of bassBoard) expect(row).toHaveLength(13)
      }),
    )
  })

  it('every non-null cell.pitch is in getScalePitches', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const scalePitches = new Set(getScalePitches(root, scale))
        const board = getScaleFretboard(root, scale, GUITAR_TUNING)
        for (const row of board) {
          for (const cell of row) {
            if (cell !== null) {
              expect(scalePitches.has(cell.pitch), `pitch ${cell.pitch}`).toBe(true)
            }
          }
        }
      }),
    )
  })

  it('cell.isRoot === (cell.pitch === root % 12)', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const board = getScaleFretboard(root, scale, GUITAR_TUNING)
        const rootPitch = ((root % 12) + 12) % 12
        for (const row of board) {
          for (const cell of row) {
            if (cell !== null) {
              expect(cell.isRoot).toBe(cell.pitch === rootPitch)
            }
          }
        }
      }),
    )
  })

  it('cell.degree matches getDegreeByPitch', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const degreeMap = getDegreeByPitch(root, scale)
        const board = getScaleFretboard(root, scale, GUITAR_TUNING)
        for (const row of board) {
          for (const cell of row) {
            if (cell !== null) {
              expect(cell.degree).toBe(degreeMap.get(cell.pitch))
            }
          }
        }
      }),
    )
  })
})

// ── 5. getScalePositions ──────────────────────────────────────────────────────

describe('getScalePositions', () => {
  const tuningArb = fc.constantFrom(GUITAR_TUNING, BASS_TUNING)

  it('every start fret is in 0..11 and anchors the root on the lowest string', () => {
    fc.assert(
      fc.property(rootArb, tuningArb, (root, tuning) => {
        const rootMod = ((root % 12) + 12) % 12
        for (const fret of getScalePositions(root, tuning)) {
          expect(fret).toBeGreaterThanOrEqual(0)
          expect(fret).toBeLessThanOrEqual(11)
          expect((tuning[0] + fret) % 12).toBe(rootMod)
        }
      }),
    )
  })

  it('positions are unique and sorted ascending', () => {
    fc.assert(
      fc.property(rootArb, tuningArb, (root, tuning) => {
        const positions = getScalePositions(root, tuning)
        expect(new Set(positions).size).toBe(positions.length)
        for (let i = 1; i < positions.length; i++) {
          expect(positions[i]).toBeGreaterThan(positions[i - 1])
        }
      }),
    )
  })

  it('returns exactly the frets in 0..11 whose lowest-string pitch is the root', () => {
    fc.assert(
      fc.property(rootArb, tuningArb, (root, tuning) => {
        const rootMod = ((root % 12) + 12) % 12
        const expected = [...Array(12).keys()].filter((fret) => (tuning[0] + fret) % 12 === rootMod)
        expect(getScalePositions(root, tuning)).toEqual(expected)
      }),
    )
  })
})

// ── 6. getDiatonicTriads ──────────────────────────────────────────────────────

describe('getDiatonicTriads', () => {
  it('C ionian produces the correct triad degrees in order (C, Dm, Em, F, G, Am, Bdim)', () => {
    const ionian = getScaleById('ionian')!
    const triads = getDiatonicTriads(0, ionian)
    // 7 degrees for a 7-note scale
    expect(triads).toHaveLength(7)
    const expected = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']
    for (let i = 0; i < 7; i++) {
      expect(triads[i].chordKey, `degree ${i + 1}`).toBe(expected[i])
    }
  })

  it('C harmonic-minor contains at least one augmented triad', () => {
    const hm = getScaleById('harmonic-minor')!
    const triads = getDiatonicTriads(0, hm)
    // harmonic minor: C D Eb F G Ab B → III degree: Eb aug
    const hasAug = triads.some((t) => t.chordKey !== null && t.chordKey.endsWith('aug'))
    expect(hasAug).toBe(true)
  })

  it('C minor-pentatonic mostly produces null chordKeys (5-note scale makes few tertian triads)', () => {
    const mp = getScaleById('minor-pentatonic')!
    const triads = getDiatonicTriads(0, mp)
    expect(triads).toHaveLength(5)
    const nullCount = triads.filter((t) => t.chordKey === null).length
    // at least 3 of 5 should be null (non-tertian) for a pentatonic
    expect(nullCount).toBeGreaterThanOrEqual(3)
  })

  it('returns one entry per scale degree', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const triads = getDiatonicTriads(root, scale)
        expect(triads).toHaveLength(scale.intervals.length)
      }),
    )
  })

  it('each entry degree matches scale.degrees at the same index', () => {
    fc.assert(
      fc.property(rootArb, scaleArb, (root, scale) => {
        const triads = getDiatonicTriads(root, scale)
        for (let i = 0; i < triads.length; i++) {
          expect(triads[i].degree).toBe(scale.degrees[i])
        }
      }),
    )
  })
})

// ── 7. CHORD_SCALE_MAP ────────────────────────────────────────────────────────

describe('CHORD_SCALE_MAP', () => {
  it('key set equals CHORD_QUALITIES', () => {
    const mapKeys = new Set(Object.keys(CHORD_SCALE_MAP))
    const qualitySet = new Set([...CHORD_QUALITIES])
    expect(mapKeys).toEqual(qualitySet)
  })

  it('every referenced scale id resolves via getScaleById', () => {
    for (const [quality, ids] of Object.entries(CHORD_SCALE_MAP)) {
      for (const id of ids) {
        expect(getScaleById(id), `CHORD_SCALE_MAP[${quality}] id="${id}"`).toBeDefined()
      }
    }
  })

  it('scalesForQuality returns at least 1 scale for every chord quality', () => {
    for (const quality of CHORD_QUALITIES) {
      expect(scalesForQuality(quality).length, `quality="${quality}"`).toBeGreaterThanOrEqual(1)
    }
  })

  it('scalesForQuality drops unknown ids gracefully', () => {
    // Verify it returns only valid ScaleDefinition objects
    for (const quality of CHORD_QUALITIES) {
      const scales = scalesForQuality(quality)
      for (const scale of scales) {
        expect(scale.id).toBeDefined()
        expect(scale.intervals.length).toBeGreaterThan(0)
      }
    }
  })
})

// ── 8. getScaleById ───────────────────────────────────────────────────────────

describe('getScaleById', () => {
  it('resolves every scale in SCALES by id', () => {
    for (const scale of SCALES) {
      expect(getScaleById(scale.id)).toBe(scale)
    }
  })

  it('returns undefined for unknown ids', () => {
    expect(getScaleById('nonexistent-scale')).toBeUndefined()
    expect(getScaleById('')).toBeUndefined()
  })
})
