import { describe, expect, it, vi } from 'vitest'

// This spec deliberately has NO static import of store.js: Vitest hoists
// static imports above vi.stubGlobal, so the persist middleware would capture
// an undefined localStorage at store creation and silently disable writes.
// The dynamic import inside the tests runs after the stub is in place, so
// hydration and writes go through the stubbed storage for real.

const localStorageData: Record<string, string> = {}
const localStorageStub = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key] }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]) }),
  length: 0,
  key: vi.fn(() => null),
}
vi.stubGlobal('localStorage', localStorageStub)
// zustand v5's default persist storage is `createJSONStorage(() => window.localStorage)`,
// so a bare localStorage stub is not enough in the node test environment.
vi.stubGlobal('window', { localStorage: localStorageStub })

// Seed a v0 klank-storage entry (the old format that still carried playlists)
// BEFORE the store module is first imported, so rehydration runs migrate.
localStorageData['klank-storage'] = JSON.stringify({
  version: 0,
  state: {
    theme: 'Dark',
    playlists: [{ id: 'p1', name: 'Stale', paths: ['/tabs/A.tab.txt'], createdAt: 1 }],
    activePlaylistId: 'p1',
    activePlaylistIndex: 0,
  },
})

describe('klank-storage migration and shape', () => {
  it('migrate drops v0 playlists from localStorage but keeps the rest of the state', async () => {
    const { useKlankStore } = await import('./store.js')

    const state = useKlankStore.getState()
    // Playlists now live in .klank-settings.json — stale localStorage copies are ignored
    expect(state.playlists).toEqual([])
    // Everything else survives the migration
    expect(state.theme).toBe('Dark')
    expect(state.activePlaylistId).toBe('p1')
    expect(state.activePlaylistIndex).toBe(0)
  })

  it('no longer writes playlists to klank-storage, but keeps the active selection', async () => {
    const { useKlankStore } = await import('./store.js')

    useKlankStore.getState().createPlaylist('Practice')

    const raw = localStorageData['klank-storage']
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw) as { version: number; state: Record<string, unknown> }
    expect(parsed.version).toBe(4)
    expect(parsed.state).not.toHaveProperty('playlists')
    expect(parsed.state).toHaveProperty('activePlaylistId')
    expect(parsed.state).toHaveProperty('activePlaylistIndex')
    // Sync cadence is persisted so it survives reloads.
    expect(parsed.state).toHaveProperty('syncSettings')
    // Instrument and Harmony settings are persisted so they survive reloads.
    expect(parsed.state).toHaveProperty('instrument')
    expect(parsed.state).toHaveProperty('harmony')
    // Custom tunings are persisted.
    expect(parsed.state).toHaveProperty('customTunings')
  })

  it('never persists the ephemeral jam slice', async () => {
    const { useKlankStore } = await import('./store.js')

    // Enter host mode (and force a persisted write so the entry is fresh).
    useKlankStore.getState().setJamHosting({ port: 7070, urls: ['http://192.168.50.50:7070'] })
    useKlankStore.getState().setTheme('Dark')

    const parsed = JSON.parse(localStorageData['klank-storage']) as { state: Record<string, unknown> }
    expect(parsed.state).not.toHaveProperty('jam')
    expect(JSON.stringify(parsed)).not.toContain('192.168.50.50')
  })

  it('migrate fills in default sync settings for older persisted state', async () => {
    const { useKlankStore } = await import('./store.js')
    const { syncSettings } = useKlankStore.getState()
    expect(syncSettings).toEqual({ enabled: true, intervalMinutes: 30, debounceMinutes: 5 })
  })

  it('migrate fills in default instrument and harmony settings for older persisted state', async () => {
    const { useKlankStore } = await import('./store.js')
    const { instrument, harmony } = useKlankStore.getState()
    expect(instrument).toBe('guitar')
    expect(harmony).toEqual({ rootPitch: 0, scaleId: 'ionian', quality: '', tab: 'scales' })
  })

  it('migrate fills in customTunings: [] for v0 state that has no customTunings', async () => {
    const { useKlankStore } = await import('./store.js')
    const { customTunings } = useKlankStore.getState()
    // The seed state was a v0 blob with no customTunings — migrate must default to [].
    expect(customTunings).toEqual([])
  })
})

describe('klank-storage v2 migration', () => {
  it('a v2 persisted blob (no customTunings) migrates to include customTunings: [] with all other fields intact', async () => {
    // Seed a v2 blob (syncSettings present, customTunings absent)
    const v2State = {
      version: 2,
      state: {
        theme: 'Light',
        activePlaylistId: 'pl-abc',
        activePlaylistIndex: 2,
        syncSettings: { enabled: false, intervalMinutes: 15, debounceMinutes: 3 },
        tab: { path: '/tabs/song.tab.txt', fontSize: 14, transpose: 1, scrollSpeed: 3, isScrolling: false, details: '', link: '' },
      },
    }
    // Wipe localStorage and reseed with the v2 blob
    Object.keys(localStorageData).forEach((k) => delete localStorageData[k])
    localStorageData['klank-storage'] = JSON.stringify(v2State)

    const { useKlankStore } = await import('./store.js')
    await useKlankStore.persist.rehydrate()

    const state = useKlankStore.getState()
    // customTunings must be filled in with [] by the migration
    expect(state.customTunings).toEqual([])
    // All pre-existing v2 fields must survive untouched
    expect(state.theme).toBe('Light')
    expect(state.activePlaylistId).toBe('pl-abc')
    expect(state.activePlaylistIndex).toBe(2)
    expect(state.syncSettings).toEqual({ enabled: false, intervalMinutes: 15, debounceMinutes: 3 })
  })
})
