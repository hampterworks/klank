import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import * as React from 'react'
import { TunerPanel } from './TunerPanel.js'
import { tuningStrings, TUNINGS } from '@klank/audio'
import type { TunerEngine, TuningName } from '@klank/audio'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeEngine(available = true): TunerEngine & {
  playedFrequencies: number[]
  stopCallCount: number
} {
  const playedFrequencies: number[] = []
  let stopCallCount = 0

  return {
    get playedFrequencies() { return playedFrequencies },
    get stopCallCount() { return stopCallCount },
    playFrequency(hz: number) { playedFrequencies.push(hz) },
    stop() { stopCallCount++ },
    isAvailable() { return available },
    dispose() {},
  }
}

const DEFAULT_POSITION = { top: 100, right: 16 }

function renderPanel(engine: TunerEngine, onClose = vi.fn()) {
  const triggerRef = React.createRef<HTMLButtonElement>()
  return render(
    <TunerPanel
      triggerRef={triggerRef as React.RefObject<HTMLButtonElement | null>}
      position={DEFAULT_POSITION}
      onClose={onClose}
      engineFactory={() => engine}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TunerPanel — ARIA and structure', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders with correct ARIA roles', () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    expect(document.querySelector('#tuner-panel')).toBeTruthy()
    expect(document.querySelector('[aria-label="Tuner"]')).toBeTruthy()
    expect(document.querySelector('[aria-modal="true"]')).toBeTruthy()
  })

  it('returns null when position is null', () => {
    const engine = makeFakeEngine()
    const triggerRef = React.createRef<HTMLButtonElement>()
    const { container } = render(
      <TunerPanel
        triggerRef={triggerRef as React.RefObject<HTMLButtonElement | null>}
        position={null}
        onClose={vi.fn()}
        engineFactory={() => engine}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('TunerPanel — string button count', () => {
  beforeEach(() => vi.clearAllMocks())

  const tuningStringCounts: Record<TuningName, number> = {
    'guitar-standard': 6,
    'guitar-drop-d': 6,
    'guitar-half-step-down': 6,
    'guitar-full-step-down': 6,
    'guitar-drop-c': 6,
    'guitar-open-g': 6,
    'guitar-open-d': 6,
    'guitar-open-e': 6,
    'guitar-dadgad': 6,
    'bass-standard': 4,
    'bass-5-string': 5,
    'bass-drop-d': 4,
    'bass-half-step-down': 4,
  }

  it('guitar-standard shows 6 string buttons (default)', () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const strings = tuningStrings('guitar-standard')
    for (const s of strings) {
      expect(screen.getByRole('button', { name: new RegExp(`Play ${s.label} string`, 'i') })).toBeTruthy()
    }
    expect(strings.length).toBe(6)
  })

  it('bass-standard shows 4 string buttons after switching to Bass', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const bassRadio = screen.getByRole('radio', { name: /bass/i })
    await act(async () => { fireEvent.click(bassRadio) })

    const strings = tuningStrings('bass-standard')
    expect(strings.length).toBe(4)
    for (const s of strings) {
      expect(screen.getByRole('button', { name: new RegExp(`Play ${s.label} string`, 'i') })).toBeTruthy()
    }
  })

  it('bass-5-string shows 5 string buttons after selecting the tuning', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    // Switch to Bass first
    const bassRadio = screen.getByRole('radio', { name: /bass/i })
    await act(async () => { fireEvent.click(bassRadio) })

    // Change tuning to 5-string
    const tuningSelect = screen.getByRole('combobox', { name: /tuning/i })
    await act(async () => {
      fireEvent.change(tuningSelect, { target: { value: 'bass-5-string' } })
    })

    const strings = tuningStrings('bass-5-string')
    expect(strings.length).toBe(5)
    for (const s of strings) {
      expect(screen.getByRole('button', { name: new RegExp(`Play ${s.label} string`, 'i') })).toBeTruthy()
    }
  })

  // Verify string counts for all tunings
  for (const [name, expectedCount] of Object.entries(tuningStringCounts) as [TuningName, number][]) {
    it(`${name} has ${expectedCount} strings`, () => {
      expect(tuningStrings(name).length).toBe(expectedCount)
    })
  }
})

describe('TunerPanel — string interaction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clicking a string button calls playFrequency with the correct Hz', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    const firstString = strings[0]
    const btn = screen.getByRole('button', { name: new RegExp(`Play ${firstString.label} string`, 'i') })
    await act(async () => { fireEvent.click(btn) })

    expect(engine.playedFrequencies).toContain(firstString.frequency)
  })

  it('clicking a different string after one is active plays the new string', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    const btn0 = screen.getByRole('button', { name: new RegExp(`Play ${strings[0].label} string`, 'i') })
    const btn1 = screen.getByRole('button', { name: new RegExp(`Play ${strings[1].label} string`, 'i') })

    await act(async () => { fireEvent.click(btn0) })
    await act(async () => { fireEvent.click(btn1) })

    expect(engine.playedFrequencies).toContain(strings[1].frequency)
  })

  it('clicking the same string again replays it instead of stopping', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    const btn = screen.getByRole('button', { name: new RegExp(`Play ${strings[0].label} string`, 'i') })

    await act(async () => { fireEvent.click(btn) })
    await act(async () => { fireEvent.click(btn) })

    expect(engine.playedFrequencies).toEqual([strings[0].frequency, strings[0].frequency])
    expect(engine.stopCallCount).toBe(0)
  })

  it('active string button has aria-pressed=true', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    const btn = screen.getByRole('button', { name: new RegExp(`Play ${strings[0].label} string`, 'i') })
    expect(btn.getAttribute('aria-pressed')).toBe('false')

    await act(async () => { fireEvent.click(btn) })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('TunerPanel — instrument switching', () => {
  beforeEach(() => vi.clearAllMocks())

  it('switching to Bass resets tuning to bass-standard and shows bass strings', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const bassRadio = screen.getByRole('radio', { name: /bass/i })
    await act(async () => { fireEvent.click(bassRadio) })

    // Tuning select should now show bass tunings
    const tuningSelect = screen.getByRole('combobox', { name: /tuning/i }) as HTMLSelectElement
    expect(tuningSelect.value).toBe('bass-standard')

    // String count should be 4
    const strings = tuningStrings('bass-standard')
    for (const s of strings) {
      expect(screen.getByRole('button', { name: new RegExp(`Play ${s.label} string`, 'i') })).toBeTruthy()
    }
  })

  it('switching instrument stops currently sounding string', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    const btn = screen.getByRole('button', { name: new RegExp(`Play ${strings[0].label} string`, 'i') })
    await act(async () => { fireEvent.click(btn) })
    const stopBefore = engine.stopCallCount

    const bassRadio = screen.getByRole('radio', { name: /bass/i })
    await act(async () => { fireEvent.click(bassRadio) })

    expect(engine.stopCallCount).toBeGreaterThan(stopBefore)
  })

  it('tuning dropdown only shows tunings for the selected instrument', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    // On guitar, no bass tunings should be in the dropdown
    const tuningSelect = screen.getByRole('combobox', { name: /tuning/i }) as HTMLSelectElement
    const guitarTunings = Object.values(TUNINGS).filter((t) => t.instrument === 'guitar')
    const bassTunings = Object.values(TUNINGS).filter((t) => t.instrument === 'bass')

    for (const t of guitarTunings) {
      const option = Array.from(tuningSelect.options).find((o) => o.value === t.name)
      expect(option).toBeTruthy()
    }
    for (const t of bassTunings) {
      const option = Array.from(tuningSelect.options).find((o) => o.value === t.name)
      expect(option).toBeFalsy()
    }
  })
})

describe('TunerPanel — keyboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('digit key 1 plays the first string', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    await act(async () => {
      fireEvent.keyDown(document, { key: '1' })
    })
    expect(engine.playedFrequencies).toContain(strings[0].frequency)
  })

  it('digit key 2 plays the second string', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    await act(async () => {
      fireEvent.keyDown(document, { key: '2' })
    })
    expect(engine.playedFrequencies).toContain(strings[1].frequency)
  })

  it('digit key on the sounding string replays it instead of stopping', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)

    const strings = tuningStrings('guitar-standard')
    await act(async () => { fireEvent.keyDown(document, { key: '1' }) })
    await act(async () => { fireEvent.keyDown(document, { key: '1' }) })

    expect(engine.playedFrequencies).toEqual([strings[0].frequency, strings[0].frequency])
    expect(engine.stopCallCount).toBe(0)
  })

  it('Escape key calls onClose', async () => {
    const onClose = vi.fn()
    const engine = makeFakeEngine()
    renderPanel(engine, onClose)
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('TunerPanel — audio unavailable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "Audio not available" when isAvailable returns false', () => {
    const engine = makeFakeEngine(false)
    renderPanel(engine)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/audio not available/i)).toBeTruthy()
  })

  it('string buttons are disabled when audio is unavailable', () => {
    const engine = makeFakeEngine(false)
    renderPanel(engine)
    const strings = tuningStrings('guitar-standard')
    const btn = screen.getByRole('button', { name: new RegExp(`Play ${strings[0].label} string`, 'i') })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })
})
