import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import fc from 'fast-check'
import { FretboardDiagram } from './FretboardDiagram.js'
import type { FretCell } from '@klank/platform-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCell = (pitch: number, degree: string, isRoot: boolean): FretCell => ({
  pitch,
  degree,
  isRoot,
})

const dotClass = (c: Element) => c.getAttribute('class') ?? ''
const isDot = (c: Element) => dotClass(c).includes('dot') || dotClass(c).includes('Dot')
const isRootDot = (c: Element) => dotClass(c).includes('dotRoot')

const allDots = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('circle')).filter(isDot)

/**
 * Frets the renderer shows for a given startFret/fretCount, mirroring the
 * component: an open column at fret 0 only when startFret === 0, then a window
 * of `fretCount` cells starting at fret 1 (open neck) or `startFret`.
 */
const visibleFrets = (startFret: number, fretCount: number): number[] => {
  const firstCellFret = startFret === 0 ? 1 : startFret
  const frets = startFret === 0 ? [0] : []
  for (let i = 0; i < fretCount; i++) frets.push(firstCellFret + i)
  return frets
}

const countVisibleCells = (
  grid: (FretCell | null)[][],
  startFret: number,
  fretCount: number,
  predicate: (cell: FretCell) => boolean = () => true,
): number => {
  const frets = visibleFrets(startFret, fretCount)
  let count = 0
  for (const row of grid) {
    for (const f of frets) {
      const cell = row[f]
      if (cell && predicate(cell)) count++
    }
  }
  return count
}

/**
 * Minimal 2-string × 5-fret grid (indices 0..4).
 * String 0 (low): root at fret 0, scale note at fret 2, root at fret 4
 * String 1 (high): scale note at fret 1, null everywhere else
 */
const SMALL_GRID: (FretCell | null)[][] = [
  [makeCell(0, '1', true), null, makeCell(2, '2', false), null, makeCell(0, '1', true)],
  [null, makeCell(4, '3', false), null, null, null],
]

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

// ── Property-based arbitraries ──────────────────────────────────────────────────

const cellArb: fc.Arbitrary<FretCell | null> = fc.option(
  fc.record({
    pitch: fc.integer({ min: 0, max: 11 }),
    degree: fc.constantFrom('1', 'b3', '4', '5', 'b7'),
    isRoot: fc.boolean(),
  }),
  { nil: null },
)

// Rectangular grid: `numStrings` rows each of `cols` cells (cols up to 13 = fret 0..12).
const gridArb = fc
  .tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 13 }))
  .chain(([numStrings, cols]) =>
    fc.array(fc.array(cellArb, { minLength: cols, maxLength: cols }), {
      minLength: numStrings,
      maxLength: numStrings,
    }),
  )

// ── Crafted tests ───────────────────────────────────────────────────────────────

describe('FretboardDiagram', () => {
  it('renders an svg with role="img" and aria-label="scale diagram"', () => {
    const { container } = render(<FretboardDiagram grid={SMALL_GRID} fretCount={4} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('scale diagram')
  })

  it('renders degree text in labelMode="degree"', () => {
    const { container } = render(<FretboardDiagram grid={SMALL_GRID} fretCount={4} labelMode="degree" />)
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toContain('1')
    expect(texts).toContain('2')
    expect(texts).toContain('3')
  })

  it('renders note names in labelMode="note" with noteNames', () => {
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} fretCount={4} labelMode="note" noteNames={NOTE_NAMES} />,
    )
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toContain('C') // pitch 0
    expect(texts).toContain('D') // pitch 2
    expect(texts).toContain('E') // pitch 4
    expect(texts).not.toContain('1')
  })

  // ── Property-based tests ──────────────────────────────────────────────────────

  it('renders exactly one dot per visible non-null cell, for any grid/window', () => {
    fc.assert(
      fc.property(
        gridArb,
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 12 }),
        (grid, startFret, fretCount) => {
          const { container } = render(
            <FretboardDiagram grid={grid} startFret={startFret} fretCount={fretCount} />,
          )
          expect(allDots(container).length).toBe(countVisibleCells(grid, startFret, fretCount))
        },
      ),
    )
  })

  it('marks exactly the visible root cells with the root class', () => {
    fc.assert(
      fc.property(
        gridArb,
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 12 }),
        (grid, startFret, fretCount) => {
          const { container } = render(
            <FretboardDiagram grid={grid} startFret={startFret} fretCount={fretCount} />,
          )
          const rootDots = allDots(container).filter(isRootDot)
          const nonRootDots = allDots(container).filter((c) => !isRootDot(c))
          expect(rootDots.length).toBe(countVisibleCells(grid, startFret, fretCount, (c) => c.isRoot))
          expect(nonRootDots.length).toBe(countVisibleCells(grid, startFret, fretCount, (c) => !c.isRoot))
        },
      ),
    )
  })

  it('shows a base-fret label iff startFret > 0', () => {
    fc.assert(
      fc.property(gridArb, fc.integer({ min: 0, max: 6 }), (grid, startFret) => {
        const { container } = render(<FretboardDiagram grid={grid} startFret={startFret} fretCount={5} />)
        const hasBaseLabel = Array.from(container.querySelectorAll('text')).some((t) =>
          /^\d+fr$/.test(t.textContent ?? ''),
        )
        expect(hasBaseLabel).toBe(startFret > 0)
      }),
    )
  })

  it('labels the base fret with the start fret when windowed', () => {
    fc.assert(
      fc.property(gridArb, fc.integer({ min: 1, max: 11 }), (grid, startFret) => {
        const { container } = render(<FretboardDiagram grid={grid} startFret={startFret} fretCount={5} />)
        const baseLabel = Array.from(container.querySelectorAll('text')).find((t) =>
          /^\d+fr$/.test(t.textContent ?? ''),
        )
        expect(baseLabel?.textContent).toBe(`${startFret}fr`)
      }),
    )
  })

  it('renders nothing but stays valid for an empty grid', () => {
    const { container } = render(<FretboardDiagram grid={[]} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
