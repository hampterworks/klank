import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'

// Stub localStorage before store import — persist middleware reads it on init.
const localStorageData: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key] }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]) }),
  length: 0,
  key: vi.fn(() => null),
})

import { useKlankStore } from './store.js'

describe('harmony slice — property-based', () => {
  const harmonyPartialArb = fc.record(
    {
      rootPitch: fc.integer({ min: 0, max: 11 }),
      scaleId: fc.constantFrom('ionian', 'dorian', 'altered', 'minor-pentatonic'),
      quality: fc.constantFrom('', 'm', 'maj7', 'm7b5'),
      tab: fc.constantFrom('chords', 'scales', 'chord-scales'),
    },
    { requiredKeys: [] },
  )

  it('setHarmony merges any partial as { ...prev, ...partial }', () => {
    fc.assert(
      fc.property(harmonyPartialArb, (partial) => {
        const prev = useKlankStore.getState().harmony
        useKlankStore.getState().setHarmony(partial)
        expect(useKlankStore.getState().harmony).toEqual({ ...prev, ...partial })
      }),
    )
  })

  it('two sequential setHarmony calls compose like a single merged update', () => {
    fc.assert(
      fc.property(harmonyPartialArb, harmonyPartialArb, (a, b) => {
        const start = useKlankStore.getState().harmony
        useKlankStore.getState().setHarmony(a)
        useKlankStore.getState().setHarmony(b)
        expect(useKlankStore.getState().harmony).toEqual({ ...start, ...a, ...b })
      }),
    )
  })
})
