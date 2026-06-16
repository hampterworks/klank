import { invoke } from '@tauri-apps/api/core'

export type JamSnapshot = {
  v: 1
  name: string
  content: string
  transpose: number
  fontSize: number
  scrollSpeed: number
  scrolling: boolean
  fraction: number // 0..1 normalized scroll position
  /** Connected-guest count, injected by the host server (guest-facing only). */
  clients?: number
}

export type JamInfo = { port: number; urls: string[]; name: string }

export type JamStatus = {
  hosting: boolean
  port: number | null
  urls: string[]
  name: string | null
  /** Guests currently connected (host perspective). */
  clients: number
}

/** A jam discovered on the local network via mDNS. */
export type DiscoveredJam = { name: string; address: string }

export type JamHost = {
  start: (name: string) => Promise<JamInfo>
  stop: () => Promise<void>
  broadcast: (snapshot: JamSnapshot) => Promise<void>
  status: () => Promise<JamStatus>
}

export const createJamHost = async (): Promise<JamHost> => ({
  start: (name: string) => invoke<JamInfo>('jam_start', { name }),
  stop: () => invoke<void>('jam_stop'),
  broadcast: (snapshot: JamSnapshot) =>
    invoke<void>('jam_broadcast', { snapshot: JSON.stringify(snapshot) }),
  status: () => invoke<JamStatus>('jam_status'),
})

/**
 * Browse the local network for open jams (mDNS). Resolves after a short scan
 * window. Returns an empty list outside Tauri or when discovery is unavailable.
 */
export const discoverJams = async (): Promise<DiscoveredJam[]> => {
  try {
    return await invoke<DiscoveredJam[]>('jam_discover')
  } catch {
    return []
  }
}

// ── Guest / client side ───────────────────────────────────────────────────────

export type JamClientHandlers = {
  onSnapshot: (s: JamSnapshot) => void
  onStatus?: (connected: boolean) => void
}

export type JamConnection = { close: () => void }

/**
 * Connect to a Jam host as a guest. Works in both the Tauri webview and plain
 * browsers. `address` is `host:port` e.g. `"192.168.1.5:7070"`.
 *
 * Auto-reconnects with exponential backoff (1 s → 5 s cap) until `close()` is
 * called.
 */
export const connectJam = (
  address: string,
  handlers: JamClientHandlers,
): JamConnection => {
  let stopped = false
  let ws: WebSocket | null = null
  let delay = 1000
  let timer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    if (stopped) return
    ws = new WebSocket(`ws://${address}/jam`)

    ws.onopen = () => {
      delay = 1000
      handlers.onStatus?.(true)
    }

    ws.onmessage = (evt) => {
      try {
        const snapshot = JSON.parse(evt.data as string) as JamSnapshot
        handlers.onSnapshot(snapshot)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      handlers.onStatus?.(false)
      if (!stopped) {
        timer = setTimeout(() => {
          delay = Math.min(delay * 2, 5000)
          connect()
        }, delay)
      }
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  connect()

  return {
    close() {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      ws?.close()
    },
  }
}
