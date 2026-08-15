import fc from 'fast-check'
import { useKlankStore } from './store.js'
import type { Playlist, CustomTuning } from './store.js'

export const makePlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  id: crypto.randomUUID(),
  name: 'Test',
  paths: [],
  createdAt: Date.now(),
  ...overrides,
})

export const resetPlaylists = (playlists: Playlist[] = []) => {
  useKlankStore.setState({ playlists, activePlaylistId: null, activePlaylistIndex: null })
}

export const resetForDelete = (_overrides: Partial<Parameters<typeof useKlankStore.setState>[0]> = {}) => {
  useKlankStore.setState({
    playlists: [],
    activePlaylistId: null,
    activePlaylistIndex: null,
    tabSettingByPath: {},
    tab: {
      path: '',
      fontSize: 12,
      transpose: 0,
      scrollSpeed: 1,
      isScrolling: false,
      details: '',
      link: '',
    },
    ..._overrides,
  })
}

export const makeCustomTuning = (overrides: Partial<CustomTuning> = {}): CustomTuning => ({
  id: crypto.randomUUID(),
  name: 'My Tuning',
  instrument: 'guitar',
  strings: [
    { pitchClass: 2, octave: 2 },
    { pitchClass: 9, octave: 2 },
    { pitchClass: 2, octave: 3 },
    { pitchClass: 7, octave: 3 },
    { pitchClass: 11, octave: 3 },
    { pitchClass: 4, octave: 4 },
  ],
  ...overrides,
})

export const resetCustomTunings = (customTunings: CustomTuning[] = []) => {
  useKlankStore.setState({ customTunings })
}

export const playlistNameArb = fc.string({ minLength: 1, maxLength: 80 })
export const pathArb = fc.string({ minLength: 1, maxLength: 200 })
export const pathsArb = fc.array(pathArb, { minLength: 0, maxLength: 20 })

export const harmonyPartialArb = fc.record(
  {
    rootPitch: fc.integer({ min: 0, max: 11 }),
    scaleId: fc.constantFrom('ionian', 'dorian', 'altered', 'minor-pentatonic'),
    quality: fc.constantFrom('', 'm', 'maj7', 'm7b5'),
    tab: fc.constantFrom('chords', 'scales', 'chord-scales'),
  },
  { requiredKeys: [] },
)
