import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FretboardDiagram } from './FretboardDiagram.js'
import type { FretCell } from '@klank/platform-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCell = (pitch: number, degree: string, isRoot: boolean): FretCell => ({
  pitch,
  degree,
  isRoot,
})

/**
 * Minimal 2-string × 5-fret grid (indices 0..4).
 * String 0 (low): root at fret 0, scale note at fret 2, root at fret 4
 * String 1 (high): scale note at fret 1, null everywhere else
 */
const SMALL_GRID: (FretCell | null)[][] = [
  // string 0 (low)
  [makeCell(0, '1', true), null, makeCell(2, '2', false), null, makeCell(0, '1', true)],
  // string 1 (high)
  [null, makeCell(4, '3', false), null, null, null],
]

// note names for labelMode='note' tests (12 pitch classes)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FretboardDiagram', () => {
  it('renders an svg with role="img" and aria-label="scale diagram"', () => {
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} fretCount={4} />,
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('scale diagram')
  })

  it('renders exactly as many dot circles as non-null cells', () => {
    // SMALL_GRID non-null count: fret 0 (string 0 root), fret 2 (string 0), fret 4 (string 0), fret 1 (string 1) = 4
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} fretCount={4} />,
    )
    // dots live inside <g> elements; count circles that are inside a <g> (excludes inlay circles)
    // inlay circles have class 'inlay'; dot circles have class containing 'dot'
    const allCircles = Array.from(container.querySelectorAll('circle'))
    const dotCircles = allCircles.filter((c) => {
      const cls = c.getAttribute('class') ?? ''
      return cls.includes('dot') || cls.includes('Dot')
    })
    // 4 non-null cells in SMALL_GRID
    expect(dotCircles.length).toBe(4)
  })

  it('root cells carry the root class (dotRoot), non-root carry dot class', () => {
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} fretCount={4} />,
    )
    const allCircles = Array.from(container.querySelectorAll('circle'))
    const rootCircles = allCircles.filter((c) => {
      const cls = c.getAttribute('class') ?? ''
      return cls.includes('dotRoot')
    })
    const nonRootDotCircles = allCircles.filter((c) => {
      const cls = c.getAttribute('class') ?? ''
      // has 'dot' but NOT 'dotRoot' and NOT 'inlay'
      return cls.includes('dot') && !cls.includes('dotRoot') && !cls.includes('inlay')
    })
    // Roots: fret 0 string 0 + fret 4 string 0 = 2
    expect(rootCircles.length).toBe(2)
    // Non-roots: fret 2 string 0 + fret 1 string 1 = 2
    expect(nonRootDotCircles.length).toBe(2)
  })

  it('renders degree text in labelMode="degree"', () => {
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} fretCount={4} labelMode="degree" />,
    )
    const textEls = Array.from(container.querySelectorAll('text'))
    const textContents = textEls.map((t) => t.textContent).filter(Boolean)
    // degrees present: '1' (×2), '2', '3'
    expect(textContents).toContain('1')
    expect(textContents).toContain('2')
    expect(textContents).toContain('3')
  })

  it('renders note names in labelMode="note" with noteNames', () => {
    const { container } = render(
      <FretboardDiagram
        grid={SMALL_GRID}
        fretCount={4}
        labelMode="note"
        noteNames={NOTE_NAMES}
      />,
    )
    const textEls = Array.from(container.querySelectorAll('text'))
    const textContents = textEls.map((t) => t.textContent).filter(Boolean)
    // pitch 0 => 'C', pitch 2 => 'D', pitch 4 => 'E'
    expect(textContents).toContain('C')
    expect(textContents).toContain('D')
    expect(textContents).toContain('E')
    // Should NOT contain degrees like '1', '2', '3'
    expect(textContents).not.toContain('1')
  })

  it('renders a base-fret label when startFret > 0', () => {
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} startFret={4} fretCount={4} />,
    )
    const textEls = Array.from(container.querySelectorAll('text'))
    const baseFretText = textEls.find((t) => t.textContent?.includes('fr'))
    expect(baseFretText).not.toBeUndefined()
    expect(baseFretText?.textContent).toMatch(/\dfr/)
  })

  it('does NOT render a base-fret label when startFret === 0', () => {
    const { container } = render(
      <FretboardDiagram grid={SMALL_GRID} startFret={0} fretCount={4} />,
    )
    const textEls = Array.from(container.querySelectorAll('text'))
    const baseFretText = textEls.find((t) => t.textContent?.includes('fr'))
    expect(baseFretText).toBeUndefined()
  })

  it('omits the open-string column (open col left of nut) when startFret > 0', () => {
    // When startFret > 0, fret-0 cells should not be rendered
    // Build a grid where ONLY fret 0 has a non-null cell; at startFret=4 it should show 0 dots
    const gridOnlyOpen: (FretCell | null)[][] = [
      [makeCell(0, '1', true), null, null, null, null],
      [makeCell(0, '1', true), null, null, null, null],
    ]
    const { container } = render(
      <FretboardDiagram grid={gridOnlyOpen} startFret={4} fretCount={4} />,
    )
    const allCircles = Array.from(container.querySelectorAll('circle'))
    const dotCircles = allCircles.filter((c) => {
      const cls = c.getAttribute('class') ?? ''
      return cls.includes('dot') || cls.includes('Dot')
    })
    expect(dotCircles.length).toBe(0)
  })
})
