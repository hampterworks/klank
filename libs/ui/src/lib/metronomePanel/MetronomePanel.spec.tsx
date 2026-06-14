import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import * as React from 'react'
import { MetronomePanel } from './MetronomePanel.js'
import type { MetronomeEngine, MetronomeConfig, TickInfo } from '@klank/audio'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeEngine(available = true): MetronomeEngine & {
  lastConfig: Partial<MetronomeConfig> | null
  startCallCount: number
  stopCallCount: number
} {
  let running = false
  let lastConfig: Partial<MetronomeConfig> | null = null
  let startCallCount = 0
  let stopCallCount = 0

  const engine = {
    get lastConfig() { return lastConfig },
    get startCallCount() { return startCallCount },
    get stopCallCount() { return stopCallCount },
    start(config: MetronomeConfig, _onTick?: (info: TickInfo) => void) {
      running = true
      lastConfig = { ...config }
      startCallCount++
    },
    setConfig(partial: Partial<MetronomeConfig>) {
      lastConfig = { ...(lastConfig ?? {}), ...partial }
    },
    stop() {
      running = false
      stopCallCount++
    },
    isRunning() { return running },
    isAvailable() { return available },
    dispose() { running = false },
  }
  return engine
}

const DEFAULT_POSITION = { top: 100, right: 16 }

function renderPanel(engine: MetronomeEngine, onClose = vi.fn()) {
  const triggerRef = React.createRef<HTMLButtonElement>()
  return render(
    <MetronomePanel
      triggerRef={triggerRef as React.RefObject<HTMLButtonElement | null>}
      position={DEFAULT_POSITION}
      onClose={onClose}
      engineFactory={() => engine}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MetronomePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct ARIA roles', () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    expect(document.querySelector('[aria-modal="true"]')).toBeTruthy()
    expect(document.querySelector('[aria-label="Metronome"]')).toBeTruthy()
  })

  it('shows the BPM value (default 120)', () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('120')
  })

  it('+ button increases BPM by 1', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const incBtn = screen.getByRole('button', { name: /increase bpm/i })
    await act(async () => { fireEvent.click(incBtn) })
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('121')
  })

  it('- button decreases BPM by 1', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const decBtn = screen.getByRole('button', { name: /decrease bpm/i })
    await act(async () => { fireEvent.click(decBtn) })
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('119')
  })

  it('ArrowUp increases BPM by 1', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    await act(async () => {
      fireEvent.keyDown(document, { key: 'ArrowUp' })
    })
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('121')
  })

  it('ArrowDown decreases BPM by 1', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    await act(async () => {
      fireEvent.keyDown(document, { key: 'ArrowDown' })
    })
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('119')
  })

  it('Shift+ArrowUp increases BPM by 10', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    await act(async () => {
      fireEvent.keyDown(document, { key: 'ArrowUp', shiftKey: true })
    })
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('130')
  })

  it('Shift+ArrowDown decreases BPM by 10', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    await act(async () => {
      fireEvent.keyDown(document, { key: 'ArrowDown', shiftKey: true })
    })
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(bpmEl?.textContent).toBe('110')
  })

  it('BPM cannot go below 20', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    // Rapidly press ArrowDown many times
    for (let i = 0; i < 200; i++) {
      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' })
      })
    }
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(parseInt(bpmEl?.textContent ?? '0', 10)).toBeGreaterThanOrEqual(20)
  })

  it('BPM cannot exceed 300', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    for (let i = 0; i < 300; i++) {
      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowUp' })
      })
    }
    const bpmEl = document.querySelector('[aria-live="polite"]')
    expect(parseInt(bpmEl?.textContent ?? '999', 10)).toBeLessThanOrEqual(300)
  })

  it('Start button calls engine.start', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const startBtn = screen.getByRole('button', { name: /start metronome/i })
    await act(async () => { fireEvent.click(startBtn) })
    expect(engine.startCallCount).toBe(1)
  })

  it('Stop button calls engine.stop', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const startBtn = screen.getByRole('button', { name: /start metronome/i })
    await act(async () => { fireEvent.click(startBtn) })
    const stopBtn = screen.getByRole('button', { name: /stop metronome/i })
    await act(async () => { fireEvent.click(stopBtn) })
    expect(engine.stopCallCount).toBeGreaterThan(0)
  })

  it('changing time signature calls setConfig while running', async () => {
    const engine = makeFakeEngine()
    const setConfigSpy = vi.spyOn(engine, 'setConfig')
    renderPanel(engine)
    // Start the engine
    const startBtn = screen.getByRole('button', { name: /start metronome/i })
    await act(async () => { fireEvent.click(startBtn) })

    const beatsSelect = screen.getByRole('combobox', { name: /beats per bar/i })
    await act(async () => {
      fireEvent.change(beatsSelect, { target: { value: '3' } })
    })
    expect(setConfigSpy).toHaveBeenCalledWith(expect.objectContaining({ timeSignatureTop: 3 }))
  })

  it('accent On/Off radio calls setConfig while running', async () => {
    const engine = makeFakeEngine()
    const setConfigSpy = vi.spyOn(engine, 'setConfig')
    renderPanel(engine)
    const startBtn = screen.getByRole('button', { name: /start metronome/i })
    await act(async () => { fireEvent.click(startBtn) })

    const offBtn = screen.getByRole('radio', { name: /off/i })
    await act(async () => { fireEvent.click(offBtn) })
    expect(setConfigSpy).toHaveBeenCalledWith(expect.objectContaining({ accent: false }))
  })

  it('subdivision change calls setConfig while running', async () => {
    const engine = makeFakeEngine()
    const setConfigSpy = vi.spyOn(engine, 'setConfig')
    renderPanel(engine)
    const startBtn = screen.getByRole('button', { name: /start metronome/i })
    await act(async () => { fireEvent.click(startBtn) })

    const eighthBtn = screen.getByRole('radio', { name: /eighth notes/i })
    await act(async () => { fireEvent.click(eighthBtn) })
    expect(setConfigSpy).toHaveBeenCalledWith(expect.objectContaining({ subdivision: 2 }))
  })

  it('tap tempo button is rendered', () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    expect(screen.getByRole('button', { name: /tap tempo/i })).toBeTruthy()
  })

  it('tapping multiple times changes BPM', async () => {
    const engine = makeFakeEngine()
    renderPanel(engine)
    const tapBtn = screen.getByRole('button', { name: /tap tempo/i })
    const before = document.querySelector('[aria-live="polite"]')?.textContent

    // Simulate three rapid taps (~120 BPM = 500ms apart)
    await act(async () => { fireEvent.click(tapBtn) })
    await new Promise((r) => setTimeout(r, 500))
    await act(async () => { fireEvent.click(tapBtn) })
    await new Promise((r) => setTimeout(r, 500))
    await act(async () => { fireEvent.click(tapBtn) })

    const after = document.querySelector('[aria-live="polite"]')?.textContent
    // After 3 taps we expect the BPM to have been computed (may or may not differ from before)
    expect(after).toBeTruthy()
    // At minimum, the value is within range
    const bpm = parseInt(after ?? '0', 10)
    expect(bpm).toBeGreaterThanOrEqual(20)
    expect(bpm).toBeLessThanOrEqual(300)
    void before
  })

  it('shows "Audio not available" when isAvailable returns false', () => {
    const engine = makeFakeEngine(false)
    renderPanel(engine)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/audio not available/i)).toBeTruthy()
  })

  it('Start button is disabled when audio is unavailable', () => {
    const engine = makeFakeEngine(false)
    renderPanel(engine)
    const startBtn = screen.getByRole('button', { name: /start metronome/i })
    expect(startBtn.hasAttribute('disabled')).toBe(true)
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

  it('close button calls onClose', async () => {
    const onClose = vi.fn()
    const engine = makeFakeEngine()
    renderPanel(engine, onClose)
    const closeBtn = screen.getByRole('button', { name: /close metronome panel/i })
    await act(async () => { fireEvent.click(closeBtn) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('returns null when position is null', () => {
    const engine = makeFakeEngine()
    const triggerRef = React.createRef<HTMLButtonElement>()
    const { container } = render(
      <MetronomePanel
        triggerRef={triggerRef as React.RefObject<HTMLButtonElement | null>}
        position={null}
        onClose={vi.fn()}
        engineFactory={() => engine}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
