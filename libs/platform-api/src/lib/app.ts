import { getVersion } from '@tauri-apps/api/app'
import { isTauri } from './platform'

/**
 * The running app version: the Tauri bundle version inside a webview, or the
 * klank-server crate version (`GET /api/version`) in server mode.
 */
export const getAppVersion = async (): Promise<string> => {
  if (isTauri()) return getVersion()
  const res = await fetch('/api/version')
  return ((await res.json()) as { version: string }).version
}
