import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { useKlankStore } from './store.js'
import { makeCustomTuning, resetCustomTunings } from './store-test-helpers.js'

describe('addCustomTuning', () => {
  beforeEach(() => resetCustomTunings())

  it('appends a new tuning to an empty list', () => {
    const tuning = makeCustomTuning()
    useKlankStore.getState().addCustomTuning(tuning)
    expect(useKlankStore.getState().customTunings).toEqual([tuning])
  })

  it('appends without mutating existing tunings', () => {
    const existing = makeCustomTuning({ name: 'Existing' })
    resetCustomTunings([existing])
    const newTuning = makeCustomTuning({ name: 'New' })
    useKlankStore.getState().addCustomTuning(newTuning)
    const after = useKlankStore.getState().customTunings
    expect(after).toHaveLength(2)
    expect(after[0]).toEqual(existing)
    expect(after[1]).toEqual(newTuning)
  })

  it('count always increases by 1 — property-based', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5 }), (seed) => {
      const existing = Array.from({ length: seed }, () => makeCustomTuning())
      resetCustomTunings(existing)
      useKlankStore.getState().addCustomTuning(makeCustomTuning())
      expect(useKlankStore.getState().customTunings).toHaveLength(seed + 1)
    }))
  })
})

describe('deleteCustomTuning', () => {
  beforeEach(() => resetCustomTunings())

  it('removes a tuning by id', () => {
    const tuning = makeCustomTuning()
    resetCustomTunings([tuning])
    useKlankStore.getState().deleteCustomTuning(tuning.id)
    expect(useKlankStore.getState().customTunings).toEqual([])
  })

  it('leaves non-target tunings intact', () => {
    const keep = makeCustomTuning({ name: 'Keep' })
    const remove = makeCustomTuning({ name: 'Remove' })
    resetCustomTunings([keep, remove])
    useKlankStore.getState().deleteCustomTuning(remove.id)
    expect(useKlankStore.getState().customTunings).toEqual([keep])
  })

  it('is a no-op when the id does not exist', () => {
    const tuning = makeCustomTuning()
    resetCustomTunings([tuning])
    useKlankStore.getState().deleteCustomTuning('nonexistent-id')
    expect(useKlankStore.getState().customTunings).toEqual([tuning])
  })

  it('count decreases by 1 and target is gone — property-based', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 4 }), (count, rawIdx) => {
      const tunings = Array.from({ length: count }, () => makeCustomTuning())
      resetCustomTunings(tunings)
      const idx = rawIdx % count
      const target = tunings[idx]
      useKlankStore.getState().deleteCustomTuning(target.id)
      const after = useKlankStore.getState().customTunings
      expect(after).toHaveLength(count - 1)
      expect(after.find((t) => t.id === target.id)).toBeUndefined()
    }))
  })
})

describe('customTunings partialize', () => {
  it('customTunings is included in the persisted state slice', () => {
    const tuning = makeCustomTuning()
    resetCustomTunings([tuning])
    expect(useKlankStore.getState().customTunings).toEqual([tuning])
  })
})
