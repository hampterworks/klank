import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

// createJamHost calls invoke from @tauri-apps/api/core; mock it before import.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { connectJam, createJamHost, discoverJams, type JamSnapshot } from './jam.js'

const invokeMock = invoke as Mock

const snapshot = (overrides: Partial<JamSnapshot> = {}): JamSnapshot => ({
  v: 1,
  name: 'Song',
  content: 'tab',
  transpose: 0,
  fontSize: 12,
  scrollSpeed: 1,
  scrolling: false,
  fraction: 0,
  ...overrides,
})

describe('createJamHost', () => {
  beforeEach(() => invokeMock.mockReset())

  it('start invokes jam_start with the jam name and returns the host info', async () => {
    invokeMock.mockResolvedValue({ port: 7070, urls: ['http://x:7070'], name: 'klank-jam-1234' })
    const host = await createJamHost()
    expect(await host.start('klank-jam-1234')).toEqual({ port: 7070, urls: ['http://x:7070'], name: 'klank-jam-1234' })
    expect(invokeMock).toHaveBeenCalledWith('jam_start', { name: 'klank-jam-1234' })
  })

  it('stop invokes jam_stop', async () => {
    invokeMock.mockResolvedValue(undefined)
    await (await createJamHost()).stop()
    expect(invokeMock).toHaveBeenCalledWith('jam_stop')
  })

  it('broadcast sends the snapshot as a JSON string argument', async () => {
    invokeMock.mockResolvedValue(undefined)
    const s = snapshot({ fraction: 0.5, transpose: 3 })
    await (await createJamHost()).broadcast(s)
    expect(invokeMock).toHaveBeenCalledWith('jam_broadcast', { snapshot: JSON.stringify(s) })
  })

  it('status invokes jam_status and passes the result through', async () => {
    invokeMock.mockResolvedValue({ hosting: true, port: 7070, urls: [] })
    expect(await (await createJamHost()).status()).toEqual({ hosting: true, port: 7070, urls: [] })
    expect(invokeMock).toHaveBeenCalledWith('jam_status')
  })
})

describe('discoverJams', () => {
  beforeEach(() => invokeMock.mockReset())

  it('invokes jam_discover and returns the discovered jams', async () => {
    const jams = [{ name: 'klank-jam-1', address: '192.168.1.5:7070' }]
    invokeMock.mockResolvedValue(jams)
    expect(await discoverJams()).toEqual(jams)
    expect(invokeMock).toHaveBeenCalledWith('jam_discover')
  })

  it('resolves to an empty list when discovery is unavailable', async () => {
    invokeMock.mockRejectedValueOnce(new Error('not in tauri'))
    await expect(discoverJams()).resolves.toEqual([])
  })
})

// Minimal controllable WebSocket double — handlers are fired explicitly so the
// reconnect timing is deterministic under fake timers.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
}

describe('connectJam', () => {
  let originalWS: typeof globalThis.WebSocket
  beforeEach(() => {
    FakeWebSocket.instances = []
    originalWS = globalThis.WebSocket
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.stubGlobal('WebSocket', originalWS)
  })

  it('opens ws://<address>/jam', () => {
    connectJam('192.168.1.5:7070', { onSnapshot: vi.fn() })
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toBe('ws://192.168.1.5:7070/jam')
  })

  it('reports connected on open and parses snapshot frames', () => {
    const onSnapshot = vi.fn()
    const onStatus = vi.fn()
    connectJam('host:7070', { onSnapshot, onStatus })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    expect(onStatus).toHaveBeenCalledWith(true)
    const s = snapshot({ fraction: 0.25 })
    ws.onmessage?.({ data: JSON.stringify(s) })
    expect(onSnapshot).toHaveBeenCalledWith(s)
  })

  it('ignores malformed frames', () => {
    const onSnapshot = vi.fn()
    connectJam('host:7070', { onSnapshot })
    FakeWebSocket.instances[0].onmessage?.({ data: 'not-json{' })
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('reconnects after an unexpected close', () => {
    const onStatus = vi.fn()
    connectJam('host:7070', { onSnapshot: vi.fn(), onStatus })
    FakeWebSocket.instances[0].onclose?.()
    expect(onStatus).toHaveBeenCalledWith(false)
    vi.advanceTimersByTime(1000)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('close() stops reconnection', () => {
    const conn = connectJam('host:7070', { onSnapshot: vi.fn() })
    conn.close()
    expect(FakeWebSocket.instances[0].close).toHaveBeenCalled()
    // A late socket-close after close() must not schedule a new connection.
    FakeWebSocket.instances[0].onclose?.()
    vi.advanceTimersByTime(10000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
