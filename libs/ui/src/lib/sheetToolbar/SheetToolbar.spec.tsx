import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { SheetToolbar } from './SheetToolbar.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  songName: 'Test Song',
  songKey: undefined as string | undefined,
  fontSize: 14,
  transpose: 0,
  tabScrollSpeed: 3,
  isScrolling: false,
  mode: 'Read' as 'Read' | 'Edit',
  setTabFontSize: vi.fn(),
  setTabTranspose: vi.fn(),
  setTabScrollSpeed: vi.fn(),
  setTabIsScrolling: vi.fn(),
  onEditToggle: vi.fn(),
}

function renderToolbar(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<SheetToolbar {...DEFAULT_PROPS} {...overrides} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SheetToolbar — existing functionality', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the song name', () => {
    renderToolbar()
    expect(screen.getByText('Test Song')).toBeTruthy()
  })

  it('renders play button', () => {
    renderToolbar()
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy()
  })

  it('does not render a save button (save lives in the floating FAB in Player)', () => {
    renderToolbar()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('does not render a save button even in Edit mode (save is a floating FAB in Player)', () => {
    renderToolbar({ mode: 'Edit' })
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })
})

describe('SheetToolbar — detected key badge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the badge with the given songKey text when provided', () => {
    renderToolbar({ songKey: 'G' })
    expect(screen.getByLabelText('Detected key')).toBeTruthy()
    expect(screen.getByText('G')).toBeTruthy()
  })

  it('renders a key-change badge text as given', () => {
    renderToolbar({ songKey: 'G → D' })
    expect(screen.getByText('G → D')).toBeTruthy()
  })

  it('does not render the badge when songKey is undefined', () => {
    renderToolbar()
    expect(screen.queryByLabelText('Detected key')).toBeNull()
  })
})

describe('SheetToolbar — metronome and tuner buttons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Metronome button with correct aria attributes', () => {
    renderToolbar()
    const btn = screen.getByRole('button', { name: /metronome/i })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-controls')).toBe('metronome-panel')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders the Tuner button with correct aria attributes', () => {
    renderToolbar()
    const btn = screen.getByRole('button', { name: /^tuner$/i })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-controls')).toBe('tuner-panel')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking Metronome button opens the metronome panel', async () => {
    renderToolbar()
    const btn = screen.getByRole('button', { name: /metronome/i })
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('#metronome-panel')).toBeTruthy()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('clicking Tuner button opens the tuner panel', async () => {
    renderToolbar()
    const btn = screen.getByRole('button', { name: /^tuner$/i })
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('#tuner-panel')).toBeTruthy()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('only one panel open at a time — opening metronome closes tuner', async () => {
    renderToolbar()
    const metronomeBtn = screen.getByRole('button', { name: /metronome/i })
    const tunerBtn = screen.getByRole('button', { name: /^tuner$/i })

    await act(async () => { fireEvent.click(tunerBtn) })
    expect(document.querySelector('#tuner-panel')).toBeTruthy()

    await act(async () => { fireEvent.click(metronomeBtn) })
    expect(document.querySelector('#metronome-panel')).toBeTruthy()
    expect(document.querySelector('#tuner-panel')).toBeFalsy()
  })

  it('only one panel open at a time — opening tuner closes metronome', async () => {
    renderToolbar()
    const metronomeBtn = screen.getByRole('button', { name: /metronome/i })
    const tunerBtn = screen.getByRole('button', { name: /^tuner$/i })

    await act(async () => { fireEvent.click(metronomeBtn) })
    expect(document.querySelector('#metronome-panel')).toBeTruthy()

    await act(async () => { fireEvent.click(tunerBtn) })
    expect(document.querySelector('#tuner-panel')).toBeTruthy()
    expect(document.querySelector('#metronome-panel')).toBeFalsy()
  })

  it('clicking an open Metronome button closes the panel', async () => {
    renderToolbar()
    const btn = screen.getByRole('button', { name: /metronome/i })
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('#metronome-panel')).toBeTruthy()
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('#metronome-panel')).toBeFalsy()
  })

  it('clicking an open Tuner button closes the panel', async () => {
    renderToolbar()
    const btn = screen.getByRole('button', { name: /^tuner$/i })
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('#tuner-panel')).toBeTruthy()
    await act(async () => { fireEvent.click(btn) })
    expect(document.querySelector('#tuner-panel')).toBeFalsy()
  })
})

describe('SheetToolbar — keyboard shortcuts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('"m" key toggles metronome panel open', async () => {
    renderToolbar()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'm' })
    })
    expect(document.querySelector('#metronome-panel')).toBeTruthy()
  })

  it('"m" key toggles metronome panel closed when open', async () => {
    renderToolbar()
    await act(async () => { fireEvent.keyDown(window, { key: 'm' }) })
    expect(document.querySelector('#metronome-panel')).toBeTruthy()
    await act(async () => { fireEvent.keyDown(window, { key: 'm' }) })
    expect(document.querySelector('#metronome-panel')).toBeFalsy()
  })

  it('"t" key toggles tuner panel open', async () => {
    renderToolbar()
    await act(async () => {
      fireEvent.keyDown(window, { key: 't' })
    })
    expect(document.querySelector('#tuner-panel')).toBeTruthy()
  })

  it('"t" key toggles tuner panel closed when open', async () => {
    renderToolbar()
    await act(async () => { fireEvent.keyDown(window, { key: 't' }) })
    expect(document.querySelector('#tuner-panel')).toBeTruthy()
    await act(async () => { fireEvent.keyDown(window, { key: 't' }) })
    expect(document.querySelector('#tuner-panel')).toBeFalsy()
  })

  it('"m" does nothing when target is an INPUT', async () => {
    renderToolbar()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    await act(async () => {
      fireEvent.keyDown(input, { key: 'm' })
    })
    expect(document.querySelector('#metronome-panel')).toBeFalsy()
    document.body.removeChild(input)
  })

  it('"t" does nothing when target is a TEXTAREA', async () => {
    renderToolbar()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 't' })
    })
    expect(document.querySelector('#tuner-panel')).toBeFalsy()
    document.body.removeChild(textarea)
  })

  it('"m" does nothing when target is a SELECT', async () => {
    renderToolbar()
    const select = document.createElement('select')
    document.body.appendChild(select)
    select.focus()

    await act(async () => {
      fireEvent.keyDown(select, { key: 'm' })
    })
    expect(document.querySelector('#metronome-panel')).toBeFalsy()
    document.body.removeChild(select)
  })

  it('Space key calls setTabIsScrolling', async () => {
    const setTabIsScrolling = vi.fn()
    renderToolbar({ setTabIsScrolling })
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    })
    expect(setTabIsScrolling).toHaveBeenCalledTimes(1)
  })

  it('+ key calls setTabScrollSpeed', async () => {
    const setTabScrollSpeed = vi.fn()
    renderToolbar({ setTabScrollSpeed })
    await act(async () => {
      fireEvent.keyDown(window, { key: '+' })
    })
    expect(setTabScrollSpeed).toHaveBeenCalledTimes(1)
  })

  it('- key calls setTabScrollSpeed', async () => {
    const setTabScrollSpeed = vi.fn()
    renderToolbar({ setTabScrollSpeed })
    await act(async () => {
      fireEvent.keyDown(window, { key: '-' })
    })
    expect(setTabScrollSpeed).toHaveBeenCalledTimes(1)
  })
})
