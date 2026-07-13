import { fetch } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { isMobileDevice } from './userAgent'

const RELEASES_LATEST = 'https://api.github.com/repos/hampterworks/klank/releases/latest'

/** Whether semver `a` is newer than `b`. Non-numeric segments compare as 0. */
export const isNewerVersion = (a: string, b: string): boolean => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0
    const db = pb[i] || 0
    if (da !== db) return da > db
  }
  return false
}

export type UpdateCheck =
  /** Already on the latest released version. */
  | { kind: 'upToDate' }
  /** Desktop: the updater plugin can download and install this version. */
  | { kind: 'desktop'; version: string }
  /** Android: a newer APK exists; `url` opens in the system browser. */
  | { kind: 'android'; version: string; url: string }

// The Update handle from the last successful desktop check, so installing
// doesn't hit the endpoint a second time.
let pendingUpdate: Update | null = null

type GitHubRelease = {
  tag_name: string
  html_url: string
  assets: { name: string; browser_download_url: string }[]
}

/**
 * Checks GitHub Releases for a version newer than `currentVersion`. On desktop
 * this asks the Tauri updater (signed `latest.json` manifest); on Android it
 * compares against the latest release tag and returns the APK download URL.
 * Rejects when offline or outside a Tauri context; callers surface the error.
 */
export const checkForUpdate = async (currentVersion: string): Promise<UpdateCheck> => {
  if (isMobileDevice()) {
    const response = await fetch(RELEASES_LATEST, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw new Error(`GitHub API responded with ${response.status}`)
    const release = (await response.json()) as GitHubRelease
    const version = release.tag_name.replace(/^v/, '')
    if (!isNewerVersion(version, currentVersion)) return { kind: 'upToDate' }
    const apk = release.assets.find((a) => a.name.endsWith('.apk'))
    return { kind: 'android', version, url: apk?.browser_download_url ?? release.html_url }
  }
  pendingUpdate = await check()
  return pendingUpdate ? { kind: 'desktop', version: pendingUpdate.version } : { kind: 'upToDate' }
}

/**
 * Desktop only: downloads and installs the update found by `checkForUpdate`,
 * then relaunches. `onProgress` receives 0-100. On Windows the NSIS installer
 * exits and restarts the app itself, in which case `relaunch` never runs.
 */
export const installUpdate = async (onProgress?: (percent: number) => void): Promise<void> => {
  const update = pendingUpdate ?? (await check())
  if (!update) return
  let total = 0
  let received = 0
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0
    } else if (event.event === 'Progress') {
      received += event.data.chunkLength
      if (total > 0) onProgress?.(Math.min(99, Math.round((received / total) * 100)))
    } else {
      onProgress?.(100)
    }
  })
  pendingUpdate = null
  await relaunch()
}

/** Opens an update download URL (Android APK) in the system browser. */
export const openUpdateUrl = (url: string): Promise<void> => openUrl(url)
