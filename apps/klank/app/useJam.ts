import { useEffect, useRef } from 'react'
import { useKlankStore } from '@klank/store'
import { connectJam, type JamConnection } from '@klank/platform-api'

/**
 * Manages the guest WebSocket lifecycle.
 *
 * - When role === 'guest' and hostAddress is set, opens a WebSocket connection
 *   via connectJam and pipes snapshots + connection status into the store.
 * - Switches activeView to 'tab' on becoming a guest so the Sheet is visible.
 * - Closes the connection on cleanup or when leaving guest mode.
 *
 * Mount this hook once in App — it has no UI of its own.
 */
export function useJam(): void {
  const role = useKlankStore((s) => s.jam.role)
  const hostAddress = useKlankStore((s) => s.jam.hostAddress)
  const setJamSnapshot = useKlankStore((s) => s.setJamSnapshot)
  const setJamConnected = useKlankStore((s) => s.setJamConnected)
  const setActiveView = useKlankStore((s) => s.setActiveView)

  // Stable ref so the effect closure always holds the current connection.
  const connectionRef = useRef<JamConnection | null>(null)

  useEffect(() => {
    if (role !== 'guest' || !hostAddress) return

    // Show the tab sheet while connected as a guest.
    setActiveView('tab')

    const connection = connectJam(hostAddress, {
      onSnapshot: setJamSnapshot,
      onStatus: setJamConnected,
    })
    connectionRef.current = connection

    return () => {
      connection.close()
      connectionRef.current = null
    }
  }, [role, hostAddress, setJamSnapshot, setJamConnected, setActiveView])
}
