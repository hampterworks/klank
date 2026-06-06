import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, fireEvent, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import { ChordDiagramTooltip } from './ChordDiagramTooltip.js'
import type { ChordVariant, ChordDiagramMap } from '@klank/platform-api'

// ── Module mock ───────────────────────────────────────────────────────────────

// Mock loadChordDiagrams so we control the data without any fetch calls
vi.mock('@klank/platform-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klank/platform-api')>()
  return {
    ...actual,
    loadChordDiagrams: vi.fn(),
  }
})

// eslint-disable-next-line import/first
import { loadChordDiagrams } from '@klank/platform-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeVariant = (strings = 6): ChordVariant => ({
  frets: Array.from({ length: strings }, (_, i) => (i < 2 ? 0 : 1)),
  fingers: Array.from({ length: strings }, (_, i) => (i < 2 ? 0 : 1)),
  baseFret: 1,
  barres: [],
})

const makeMap = (chords: Record<string, number>): ChordDiagramMap =>
  Object.fromEntries(
    Object.entries(chords).map(([name, count]) => [
      name,
      Array.from({ length: count }, () => makeVariant()),
    ]),
  )

const setupFetch = (map: ChordDiagramMap) => {
  vi.mocked(loadChordDiagrams).mockResolvedValue(map)
}

const hoverWrapper = (container: HTMLElement) => {
  // The ChordDiagramTooltip renders a <span> as its outermost element
  const wrapper = container.querySelector('span')
  if (wrapper) fireEvent.mouseEnter(wrapper)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChordDiagramTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always renders children regardless of props', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom('Am', 'C', 'UnknownXYZ'),
        (isScrolling, chord) => {
          setupFetch(makeMap({ Am: 2, C: 1 }))
          const { getByTestId, unmount } = render(
            <ChordDiagramTooltip chordName={chord} instrument="guitar" isScrolling={isScrolling}>
              <span data-testid="child">{chord}</span>
            </ChordDiagramTooltip>,
          )
          expect(getByTestId('child')).toBeTruthy()
          unmount()
        },
      ),
    )
  })

  it('never shows tooltip while autoscrolling', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('Am', 'C', 'Em'), async (chord) => {
        setupFetch(makeMap({ Am: 2, C: 1, Em: 1 }))
        const { container, unmount } = render(
          <ChordDiagramTooltip chordName={chord} instrument="guitar" isScrolling={true}>
            <span data-testid="child">{chord}</span>
          </ChordDiagramTooltip>,
        )
        await act(async () => {})
        hoverWrapper(container)
        // Portal renders into document.body; tooltip should not appear
        const tooltip = document.body.querySelector('[role="tooltip"]')
        expect(tooltip).toBeNull()
        unmount()
      }),
    )
  })

  it('never shows tooltip for a chord with no variants', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 10 }), async (unknownChord) => {
        setupFetch(makeMap({})) // empty map — no chords
        const { container, unmount } = render(
          <ChordDiagramTooltip chordName={unknownChord} instrument="guitar" isScrolling={false}>
            <span data-testid="child">{unknownChord}</span>
          </ChordDiagramTooltip>,
        )
        await act(async () => {})
        hoverWrapper(container)
        const tooltip = document.body.querySelector('[role="tooltip"]')
        expect(tooltip).toBeNull()
        unmount()
      }),
    )
  })

  it('alt index stays in bounds after any sequence of left/right navigations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        async (variantCount, navSteps) => {
          const map = makeMap({ Am: variantCount })
          setupFetch(map)
          const { container, unmount } = render(
            <ChordDiagramTooltip chordName="Am" instrument="guitar" isScrolling={false}>
              <span data-testid="child">Am</span>
            </ChordDiagramTooltip>,
          )
          await act(async () => {})
          hoverWrapper(container)

          if (variantCount > 1) {
            for (const goRight of navSteps) {
              await act(async () => {
                fireEvent.keyDown(window, { key: goRight ? 'ArrowRight' : 'ArrowLeft' })
              })
            }
          }

          const tooltip = document.body.querySelector('[role="tooltip"]')
          if (variantCount > 0) {
            // If tooltip is shown, the counter must always be within range
            const counter = tooltip?.querySelector('[class*="altCount"]')
            if (counter) {
              const [current, total] = counter.textContent!.split('/').map(Number)
              expect(current).toBeGreaterThanOrEqual(1)
              expect(current).toBeLessThanOrEqual(total)
              expect(total).toBe(variantCount)
            }
          }
          unmount()
        },
      ),
    )
  })

  it('hides nav buttons when there is only one variant', async () => {
    setupFetch(makeMap({ G: 1 }))
    const { container } = render(
      <ChordDiagramTooltip chordName="G" instrument="guitar" isScrolling={false}>
        <span data-testid="child">G</span>
      </ChordDiagramTooltip>,
    )
    await act(async () => {})
    hoverWrapper(container)
    const prevBtn = document.body.querySelector('[aria-label="previous voicing"]')
    const nextBtn = document.body.querySelector('[aria-label="next voicing"]')
    expect(prevBtn).toBeNull()
    expect(nextBtn).toBeNull()
  })

  it('shows nav buttons when there are multiple variants', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), async (count) => {
        setupFetch(makeMap({ Em: count }))
        const { container, unmount } = render(
          <ChordDiagramTooltip chordName="Em" instrument="guitar" isScrolling={false}>
            <span data-testid="child">Em</span>
          </ChordDiagramTooltip>,
        )
        await act(async () => {})
        hoverWrapper(container)
        await waitFor(() => {
          expect(document.body.querySelector('[aria-label="previous voicing"]')).not.toBeNull()
          expect(document.body.querySelector('[aria-label="next voicing"]')).not.toBeNull()
        })
        unmount()
      }),
    )
  })

  it('keeps tooltip visible after click (pin) + mouse leave', async () => {
    setupFetch(makeMap({ Am: 2 }))
    const { container } = render(
      <ChordDiagramTooltip chordName="Am" instrument="guitar" isScrolling={false}>
        <span data-testid="child">Am</span>
      </ChordDiagramTooltip>,
    )
    await act(async () => {})
    const wrapper = container.querySelector('span')!

    fireEvent.mouseEnter(wrapper)
    await waitFor(() => {
      expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    })

    // Click to pin, then mouse leave — tooltip must survive
    await act(async () => {
      fireEvent.click(wrapper)
    })
    fireEvent.mouseLeave(wrapper)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
  })

  it('closes pinned tooltip immediately on click outside', async () => {
    setupFetch(makeMap({ Am: 2 }))
    const { container } = render(
      <ChordDiagramTooltip chordName="Am" instrument="guitar" isScrolling={false}>
        <span data-testid="child">Am</span>
      </ChordDiagramTooltip>,
    )
    await act(async () => {})
    const wrapper = container.querySelector('span')!

    fireEvent.mouseEnter(wrapper)
    await waitFor(() => {
      expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    })

    await act(async () => {
      fireEvent.click(wrapper) // pin
    })

    await act(async () => {
      fireEvent.mouseDown(document.body) // click outside
    })
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('closes tooltip after 1s delay when mouse leaves without clicking', async () => {
    setupFetch(makeMap({ Am: 1 }))
    const { container } = render(
      <ChordDiagramTooltip chordName="Am" instrument="guitar" isScrolling={false}>
        <span data-testid="child">Am</span>
      </ChordDiagramTooltip>,
    )
    // Flush the loadChordDiagrams effect with real timers before enabling fake ones
    await act(async () => {})

    vi.useFakeTimers()
    try {
      const wrapper = container.querySelector('span')!

      act(() => { fireEvent.mouseEnter(wrapper) })
      expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()

      act(() => { fireEvent.mouseLeave(wrapper) })
      // Immediately after leave: still visible (delayed close scheduled)
      expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()

      // Advance past 1s — timer fires, tooltip closes
      act(() => { vi.advanceTimersByTime(1000) })
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets alt index to 0 when chordName changes', async () => {
    const map = makeMap({ Am: 3, Em: 2 })
    setupFetch(map)

    const { container, rerender } = render(
      <ChordDiagramTooltip chordName="Am" instrument="guitar" isScrolling={false}>
        <span data-testid="child">Am</span>
      </ChordDiagramTooltip>,
    )
    await act(async () => {})
    hoverWrapper(container)

    // Wait for tooltip to appear with Am's 3 variants
    await waitFor(() => {
      expect(document.body.querySelector('[class*="altCount"]')).not.toBeNull()
    })

    // Navigate to index 2
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })

    await waitFor(() => {
      const counter = document.body.querySelector('[class*="altCount"]')
      expect(counter?.textContent).toBe('3/3')
    })

    // Change chord name
    await act(async () => {
      rerender(
        <ChordDiagramTooltip chordName="Em" instrument="guitar" isScrolling={false}>
          <span data-testid="child">Em</span>
        </ChordDiagramTooltip>,
      )
    })

    // Alt index must reset to 0 after chord change
    await waitFor(() => {
      const counter = document.body.querySelector('[class*="altCount"]')
      if (counter) {
        expect(counter.textContent?.startsWith('1/')).toBe(true)
      }
    })
  })

  it('only one tooltip is open at a time — opening a second closes the first', async () => {
    setupFetch(makeMap({ Am: 1, G: 1 }))

    const { container: c1 } = render(
      <ChordDiagramTooltip chordName="Am" instrument="guitar" isScrolling={false}>
        <span>Am</span>
      </ChordDiagramTooltip>,
    )
    const { container: c2 } = render(
      <ChordDiagramTooltip chordName="G" instrument="guitar" isScrolling={false}>
        <span>G</span>
      </ChordDiagramTooltip>,
    )
    await act(async () => {})

    const amWrapper = c1.querySelector('span')!
    const gWrapper = c2.querySelector('span')!

    // Open the Am tooltip
    fireEvent.mouseEnter(amWrapper)
    await waitFor(() => {
      expect(document.body.querySelectorAll('[role="tooltip"]').length).toBe(1)
    })

    // Opening G must close Am, leaving exactly one tooltip open
    fireEvent.mouseEnter(gWrapper)
    await waitFor(() => {
      expect(document.body.querySelectorAll('[role="tooltip"]').length).toBe(1)
    })
  })
})
