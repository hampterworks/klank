import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

// update.ts statically imports the Tauri plugin bindings, which only work
// inside a Tauri webview - mock them all.
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))

import { fetch } from '@tauri-apps/plugin-http'
import { check } from '@tauri-apps/plugin-updater'
import { checkForUpdate, isNewerVersion } from './update.js'

const fetchMock = fetch as Mock
const checkMock = check as unknown as Mock

const mobileUserAgent =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36'

describe('isNewerVersion', () => {
  it('returns false for equal versions', () => {
    expect(isNewerVersion('2.0.1', '2.0.1')).toBe(false)
  })

  it('detects patch, minor, and major bumps', () => {
    expect(isNewerVersion('2.0.2', '2.0.1')).toBe(true)
    expect(isNewerVersion('2.1.0', '2.0.9')).toBe(true)
    expect(isNewerVersion('3.0.0', '2.9.9')).toBe(true)
  })

  it('never reports an older version as newer', () => {
    expect(isNewerVersion('2.0.1', '2.0.2')).toBe(false)
    expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false)
  })

  it('compares segments numerically, not lexically', () => {
    expect(isNewerVersion('2.0.10', '2.0.9')).toBe(true)
    expect(isNewerVersion('2.0.9', '2.0.10')).toBe(false)
  })
})

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses the desktop updater plugin off mobile', async () => {
    checkMock.mockResolvedValue({ version: '2.0.5' })

    expect(await checkForUpdate('2.0.4')).toEqual({ kind: 'desktop', version: '2.0.5' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports upToDate when the desktop check finds nothing', async () => {
    checkMock.mockResolvedValue(null)

    expect(await checkForUpdate('2.0.5')).toEqual({ kind: 'upToDate' })
  })

  it('returns the APK download URL on mobile when a newer release exists', async () => {
    vi.stubGlobal('navigator', { userAgent: mobileUserAgent })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v2.0.5',
        html_url: 'https://github.com/hampterworks/klank/releases/tag/v2.0.5',
        assets: [
          { name: 'klank_2.0.5_x64-setup.exe', browser_download_url: 'https://example.com/setup.exe' },
          { name: 'app-arm64-release.apk', browser_download_url: 'https://example.com/app.apk' },
        ],
      }),
    })

    expect(await checkForUpdate('2.0.4')).toEqual({
      kind: 'android',
      version: '2.0.5',
      url: 'https://example.com/app.apk',
    })
    expect(checkMock).not.toHaveBeenCalled()
  })

  it('reports upToDate on mobile when the latest tag is not newer', async () => {
    vi.stubGlobal('navigator', { userAgent: mobileUserAgent })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v2.0.4', html_url: '', assets: [] }),
    })

    expect(await checkForUpdate('2.0.4')).toEqual({ kind: 'upToDate' })
  })

  it('falls back to the release page when no APK asset exists', async () => {
    vi.stubGlobal('navigator', { userAgent: mobileUserAgent })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v2.0.5',
        html_url: 'https://github.com/hampterworks/klank/releases/tag/v2.0.5',
        assets: [],
      }),
    })

    expect(await checkForUpdate('2.0.4')).toEqual({
      kind: 'android',
      version: '2.0.5',
      url: 'https://github.com/hampterworks/klank/releases/tag/v2.0.5',
    })
  })

  it('throws on a non-ok GitHub API response', async () => {
    vi.stubGlobal('navigator', { userAgent: mobileUserAgent })
    fetchMock.mockResolvedValue({ ok: false, status: 403 })

    await expect(checkForUpdate('2.0.4')).rejects.toThrow('403')
  })
})
