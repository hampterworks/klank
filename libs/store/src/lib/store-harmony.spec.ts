import { beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { useKlankStore } from './store.js'
import { playlistNameArb, makePlaylist, resetPlaylists, pathArb, pathsArb } from './store-test-helpers.js'

describe('harmony slice — property-based', () => {
  it('setHarmony merges any partial as { ...prev, ...partial }', () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            rootPitch: fc.integer({ min: 0, max: 11 }),
            scaleId: fc.constantFrom('ionian', 'dorian', 'altered', 'minor-pentatonic'),
            quality: fc.constantFrom('', 'm', 'maj7', 'm7b5'),
            tab: fc.constantFrom('chords', 'scales', 'chord-scales'),
          },
          { requiredKeys: [] },
        ),
        (partial) => {
          const prev = useKlankStore.getState().harmony
          useKlankStore.getState().setHarmony(partial)
          expect(useKlankStore.getState().harmony).toEqual({ ...prev, ...partial })
        },
      ),
    )
  })

  it('two sequential setHarmony calls compose like a single merged update', () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            rootPitch: fc.integer({ min: 0, max: 11 }),
            scaleId: fc.constantFrom('ionian', 'dorian', 'altered', 'minor-pentatonic'),
            quality: fc.constantFrom('', 'm', 'maj7', 'm7b5'),
            tab: fc.constantFrom('chords', 'scales', 'chord-scales'),
          },
          { requiredKeys: [] },
        ),
        fc.record(
          {
            rootPitch: fc.integer({ min: 0, max: 11 }),
            scaleId: fc.constantFrom('ionian', 'dorian', 'altered', 'minor-pentatonic'),
            quality: fc.constantFrom('', 'm', 'maj7', 'm7b5'),
            tab: fc.constantFrom('chords', 'scales', 'chord-scales'),
          },
          { requiredKeys: [] },
        ),
        (a, b) => {
          const start = useKlankStore.getState().harmony
          useKlankStore.getState().setHarmony(a)
          useKlankStore.getState().setHarmony(b)
          expect(useKlankStore.getState().harmony).toEqual({ ...start, ...a, ...b })
        },
      ),
    )
  })
})
