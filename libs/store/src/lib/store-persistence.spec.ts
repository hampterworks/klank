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
    expect(parsed.version).toBe(2)
    expect(parsed.state).not.toHaveProperty('playlists')
    expect(parsed.state).toHaveProperty('activePlaylistId')
    expect(parsed.state).toHaveProperty('activePlaylistIndex')
    // Sync cadence is persisted so it survives reloads.
    expect(parsed.state).toHaveProperty('syncSettings')
  })

  it('migrate fills in default sync settings for older persisted state', async () => {
    const { useKlankStore } = await import('./store.js')
    const { syncSettings } = useKlankStore.getState()
    expect(syncSettings).toEqual({ enabled: true, intervalMinutes: 30, debounceMinutes: 5 })
  })
})
