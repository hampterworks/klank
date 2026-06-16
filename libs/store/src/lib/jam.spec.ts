import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub localStorage before store import — the persist middleware reads it on init.
const localStorageData: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key] }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]) }),
  length: 0,
  key: vi.fn(() => null),
})

import { useKlankStore, type JamSnapshot } from './store.js'

const snapshot = (overrides: Partial<JamSnapshot> = {}): JamSnapshot => ({
  v: 1,
  name: 'Song',
  content: 'A C G',
  transpose: 0,
  fontSize: 12,
  scrollSpeed: 1,
  scrolling: false,
  fraction: 0,
  ...overrides,
})

const OFF = { role: 'off', port: null, urls: [], hostAddress: '', connected: false, snapshot: null }

describe('jam store slice', () => {
  beforeEach(() => useKlankStore.getState().setJamOff())

  it('defaults to off', () => {
    expect(useKlankStore.getState().jam).toEqual(OFF)
  })

  it('setJamHosting → host role carrying port + urls', () => {
    useKlankStore.getState().setJamHosting({ port: 7070, urls: ['http://192.168.1.5:7070'] })
    const { jam } = useKlankStore.getState()
    expect(jam.role).toBe('host')
    expect(jam.port).toBe(7070)
    expect(jam.urls).toEqual(['http://192.168.1.5:7070'])
  })

  it('setJamGuest → guest role and clears any prior connection/snapshot', () => {
    useKlankStore.getState().setJamSnapshot(snapshot())
    useKlankStore.getState().setJamConnected(true)
    useKlankStore.getState().setJamGuest('192.168.1.5:7070')
    const { jam } = useKlankStore.getState()
    expect(jam.role).toBe('guest')
    expect(jam.hostAddress).toBe('192.168.1.5:7070')
    expect(jam.connected).toBe(false)
    expect(jam.snapshot).toBeNull()
  })

  it('setJamConnected toggles connection without changing role', () => {
    useKlankStore.getState().setJamGuest('host:7070')
    useKlankStore.getState().setJamConnected(true)
    expect(useKlankStore.getState().jam.connected).toBe(true)
    expect(useKlankStore.getState().jam.role).toBe('guest')
  })

  it('setJamSnapshot stores the latest snapshot verbatim', () => {
    const s = snapshot({ fraction: 0.42, name: 'Wish You Were Here', transpose: -2 })
    useKlankStore.getState().setJamSnapshot(s)
    expect(useKlankStore.getState().jam.snapshot).toEqual(s)
  })

  it('setJamOff fully resets from host', () => {
    useKlankStore.getState().setJamHosting({ port: 7070, urls: ['http://x:7070'] })
    useKlankStore.getState().setJamOff()
    expect(useKlankStore.getState().jam).toEqual(OFF)
  })

  it('setJamOff fully resets from guest', () => {
    useKlankStore.getState().setJamGuest('host:7070')
    useKlankStore.getState().setJamConnected(true)
    useKlankStore.getState().setJamSnapshot(snapshot())
    useKlankStore.getState().setJamOff()
    expect(useKlankStore.getState().jam).toEqual(OFF)
  })
})
