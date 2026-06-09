import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import fc from 'fast-check'
import { ChordDiagram } from './ChordDiagram.js'
import type { ChordVariant } from '@klank/platform-api'

// ── Arbitraries ──────────────────────────────────────────────────────────────

const fretValueArb = fc.integer({ min: -1, max: 12 })
const fingerValueArb = fc.integer({ min: 0, max: 4 })

const variantArb = (strings: number): fc.Arbitrary<ChordVariant> =>
  fc.record({
    frets: fc.array(fretValueArb, { minLength: strings, maxLength: strings }),
    fingers: fc.array(fingerValueArb, { minLength: strings, maxLength: strings }),
    baseFret: fc.integer({ min: 1, max: 9 }),
    barres: fc.constant([]),
  })

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChordDiagram', () => {
  it('renders without crashing for any valid 6-string variant', () => {
    fc.assert(
      fc.property(variantArb(6), (variant) => {
        expect(() => render(<ChordDiagram variant={variant} strings={6} />)).not.toThrow()
      }),
    )
  })

  it('renders without crashing for any valid 4-string (bass) variant', () => {
    fc.assert(
      fc.property(variantArb(4), (variant) => {
        expect(() => render(<ChordDiagram variant={variant} strings={4} />)).not.toThrow()
      }),
    )
  })

  it('shows baseFret label only when baseFret > 1', () => {
    fc.assert(
      fc.property(variantArb(6), fc.integer({ min: 1, max: 9 }), (base, baseFret) => {
        const variant: ChordVariant = { ...base, baseFret }
        const { container } = render(<ChordDiagram variant={variant} strings={6} />)
        const text = Array.from(container.querySelectorAll('text')).find((el) =>
          el.textContent?.includes('fr'),
        )
        if (baseFret > 1) {
          expect(text?.textContent).toBe(`${baseFret}fr`)
        } else {
          expect(text).toBeUndefined()
        }
      }),
    )
  })

  it('renders exactly strings-count string lines', () => {
    fc.assert(
      fc.property(fc.constantFrom(4, 6), variantArb(6), (strings, base) => {
        const variant: ChordVariant = {
          ...base,
          frets: Array.from({ length: strings }, () => 0),
          fingers: Array.from({ length: strings }, () => 0),
        }
        const { container } = render(<ChordDiagram variant={variant} strings={strings} />)
        // String lines have class containing 'String'
        const stringLines = Array.from(container.querySelectorAll('line')).filter(
          (el) =>
            el.getAttribute('class')?.includes('string') ||
            el.getAttribute('class')?.includes('String') ||
            el.getAttribute('class')?.includes('bass'),
        )
        expect(stringLines.length).toBe(strings)
      }),
    )
  })

  it('renders a nut rect when baseFret is 1', () => {
    const variant: ChordVariant = {
      frets: [0, 2, 2, 1, 0, 0],
      fingers: [0, 2, 3, 1, 0, 0],
      baseFret: 1,
      barres: [],
    }
    const { container } = render(<ChordDiagram variant={variant} strings={6} />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })

  it('does not render a nut rect when baseFret > 1', () => {
    const variant: ChordVariant = {
      frets: [5, 7, 7, 6, 5, 5],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: 5,
      barres: [],
    }
    const { container } = render(<ChordDiagram variant={variant} strings={6} />)
    // No nut rect — only barre rects if any
    const nutRect = Array.from(container.querySelectorAll('rect')).find(
      (el) => el.getAttribute('class')?.includes('nut'),
    )
    expect(nutRect).toBeUndefined()
  })
})
