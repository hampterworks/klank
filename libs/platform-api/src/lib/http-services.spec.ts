import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

// ── Tauri module doubles ──────────────────────────────────────────────────────
// In the node test env `window` is undefined, so isTauri() is false and every
// factory picks its HTTP variant. `invoke` throws if ever called (the HTTP path
// must not touch Tauri IPC); the fs plugin modules throw on import, so a stray
// dynamic tauri import in server mode would fail the test loudly.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => {
    throw new Error('invoke must not be called in server mode')
  }),
  Channel: class {
    onmessage: unknown = null
  },
}))
vi.mock('@tauri-apps/plugin-fs', () => {
  throw new Error('@tauri-apps/plugin-fs must not be imported in server mode')
})
vi.mock('@tauri-apps/api/path', () => {
  throw new Error('@tauri-apps/api/path must not be imported in server mode')
})
vi.mock('@tauri-apps/plugin-dialog', () => {
  throw new Error('@tauri-apps/plugin-dialog must not be imported in server mode')
})

import { createFileService } from './fs.js'
import { createGitService } from './git.js'
import { createJamHost } from './jam.js'
import { getSheetFromUG } from './download.js'

const fetchMock = vi.fn() as Mock

/** A minimal 2xx JSON Response double. */
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data })

/** A streaming NDJSON Response double: each string is delivered as one chunk. */
const ndjson = (chunks: string[]) => {
  const encoder = new TextEncoder()
  const encoded = chunks.map((c) => encoder.encode(c))
  let i = 0
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < encoded.length
            ? { done: false, value: encoded[i++] }
            : { done: true, value: undefined },
      }),
    },
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Factory selection ─────────────────────────────────────────────────────────

describe('factory selection in server mode', () => {
  it('createFileService returns the HTTP variant and never imports tauri fs plugins', async () => {
    // getBaseDirectoryPath hits /api/version; a Tauri variant would instead
    // import the (throwing) plugin modules and reject.
    fetchMock.mockResolvedValue(ok({ version: '1.2.3', mode: 'server', root: '/data' }))

    const service = await createFileService()

    expect(await service.getBaseDirectoryPath()).toBe('/data')
    expect(fetchMock).toHaveBeenCalledWith('/api/version')
  })

  it('createGitService returns the HTTP variant', async () => {
    fetchMock.mockResolvedValue(ok({ value: true }))

    const git = await createGitService()

    expect(await git.isGitRepo('/ignored')).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/git/is-repo')
  })
})

// ── HTTP FileService ──────────────────────────────────────────────────────────

describe('http FileService', () => {
  const tabFilter = (f: { isDirectory: boolean; name: string }) =>
    f.isDirectory || f.name.endsWith('.tab.txt')

  it('readDirectoryRecursively fetches /api/tree and re-applies the filter recursively', async () => {
    fetchMock.mockResolvedValue(
      ok([
        { name: 'A - Song.tab.txt', isDirectory: false, isFile: true, isSymlink: false, path: '/data/A - Song.tab.txt' },
        {
          name: 'Rock',
          isDirectory: true,
          isFile: false,
          isSymlink: false,
          path: '/data/Rock',
          children: [
            { name: 'notes.md', isDirectory: false, isFile: true, isSymlink: false, path: '/data/Rock/notes.md' },
            { name: 'B - Song.tab.txt', isDirectory: false, isFile: true, isSymlink: false, path: '/data/Rock/B - Song.tab.txt' },
          ],
        },
      ]),
    )

    const service = await createFileService()
    const tree = JSON.stringify(await service.readDirectoryRecursively('/data', tabFilter))

    expect(fetchMock).toHaveBeenCalledWith('/api/tree')
    expect(tree).toContain('A - Song.tab.txt')
    expect(tree).toContain('B - Song.tab.txt')
    // The non-tab child is filtered out, matching the Tauri scan's output.
    expect(tree).not.toContain('notes.md')
  })

  it('readTabFile returns the content field, encoding the path query param', async () => {
    fetchMock.mockResolvedValue(ok({ content: 'song body' }))

    const service = await createFileService()
    const content = await service.readTabFile('/data/Artist - Song.tab.txt')

    expect(content).toBe('song body')
    expect(fetchMock).toHaveBeenCalledWith('/api/file?path=%2Fdata%2FArtist%20-%20Song.tab.txt')
  })

  it('writeTabFile PUTs {filename, target, content} and returns the written path', async () => {
    fetchMock.mockResolvedValue(ok({ path: '/data/A - Song.tab.txt' }))

    const service = await createFileService()
    const result = await service.writeTabFile('A - Song.tab.txt', '/data', 'body')

    expect(result).toBe('/data/A - Song.tab.txt')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/file')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({
      filename: 'A - Song.tab.txt',
      target: '/data',
      content: 'body',
    })
  })

  it('writeTabFile returns the server error message string on failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'path escapes root' }) })

    const service = await createFileService()
    expect(await service.writeTabFile('x.tab.txt', '/etc', 'body')).toBe('path escapes root')
  })

  it('deleteTabFile treats a 404 as success', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'missing' }) })

    const service = await createFileService()
    await expect(service.deleteTabFile('/data/x.tab.txt')).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/file?path=%2Fdata%2Fx.tab.txt')
    expect(init.method).toBe('DELETE')
  })

  it('deleteTabFile throws on a non-404 failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'bad path' }) })

    const service = await createFileService()
    await expect(service.deleteTabFile('/etc/passwd')).rejects.toThrow('bad path')
  })

  it('writeTabSetting PUTs {path, settings} to /api/settings/tab', async () => {
    fetchMock.mockResolvedValue(ok(undefined))

    const service = await createFileService()
    await service.writeTabSetting('/data/A - Song.tab.txt', { fontSize: 14, transpose: 2, scrollSpeed: 3 }, '/data')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/settings/tab')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({
      path: '/data/A - Song.tab.txt',
      settings: { fontSize: 14, transpose: 2, scrollSpeed: 3 },
    })
  })

  it('readTabSettings degrades to an empty object when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    const service = await createFileService()
    await expect(service.readTabSettings('/data')).resolves.toEqual({})
  })

  it('readPlaylists returns the server array and degrades to [] on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ id: 'p1', name: 'Set', paths: ['/data/A.tab.txt'], createdAt: 1 }]))
    const service = await createFileService()
    expect(await service.readPlaylists('/data')).toEqual([{ id: 'p1', name: 'Set', paths: ['/data/A.tab.txt'], createdAt: 1 }])

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
    expect(await service.readPlaylists('/data')).toEqual([])
  })

  it('getDirectoryPath resolves to null (no browser folder picker)', async () => {
    const service = await createFileService()
    expect(await service.getDirectoryPath()).toBeNull()
  })
})

// ── HTTP GitService ───────────────────────────────────────────────────────────

describe('http GitService', () => {
  it('sync maps the snake_case RawSyncResult to camelCase', async () => {
    fetchMock.mockResolvedValue(
      ok({
        success: true,
        committed: true,
        pulled: 2,
        pushed: 1,
        conflicts_resolved: 3,
        branch: 'main',
        up_to_date: false,
        changed: true,
        message: 'synced',
        error_kind: undefined,
      }),
    )

    const git = await createGitService()
    const result = await git.sync('/ignored')

    expect(result).toEqual({
      success: true,
      committed: true,
      pulled: 2,
      pushed: 1,
      conflictsResolved: 3,
      branch: 'main',
      upToDate: false,
      changed: true,
      message: 'synced',
      error: undefined,
      errorKind: undefined,
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/git/sync')
    expect(init.method).toBe('POST')
  })

  it('listBranches maps is_head/is_remote to camelCase', async () => {
    fetchMock.mockResolvedValue(ok([{ name: 'main', is_head: true, is_remote: false, upstream: 'origin/main' }]))

    const git = await createGitService()
    expect(await git.listBranches('/ignored')).toEqual([
      { name: 'main', isHead: true, isRemote: false, upstream: 'origin/main' },
    ])
  })

  it('commit POSTs the message and returns the GitResult verbatim', async () => {
    fetchMock.mockResolvedValue(ok({ success: true, output: 'done' }))

    const git = await createGitService()
    expect(await git.commit('/ignored', 'my message')).toEqual({ success: true, output: 'done' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/git/commit')
    expect(JSON.parse(init.body as string)).toEqual({ message: 'my message' })
  })

  it('isGitRepo and listBranches degrade to safe defaults on error', async () => {
    fetchMock.mockRejectedValue(new Error('network'))

    const git = await createGitService()
    expect(await git.isGitRepo('/x')).toBe(false)
    expect(await git.listBranches('/x')).toEqual([])
  })

  it('systemCredentialsEnabled reflects the server flag', async () => {
    fetchMock.mockResolvedValue(ok({ value: false }))

    const git = await createGitService()
    expect(await git.systemCredentialsEnabled()).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('/api/git/system-credentials-enabled')
  })
})

// ── HTTP import (NDJSON) ──────────────────────────────────────────────────────

describe('getSheetFromUG over HTTP', () => {
  it('forwards progress lines then resolves the {done} payload with markup stripped', async () => {
    fetchMock.mockResolvedValue(
      ndjson([
        JSON.stringify({ type: 'StageStart', id: 'ug_mobile_api', label: 'UG app API', index: 0, total: 2 }) + '\n',
        JSON.stringify({ type: 'Succeeded', id: 'ug_mobile_api', label: 'UG app API' }) + '\n',
        JSON.stringify({ done: { content: '[ch]G[/ch] [tab]riff[/tab]', artist: 'Radiohead', song: 'Creep' } }) + '\n',
      ]),
    )

    const events: string[] = []
    const result = await getSheetFromUG('https://tabs.ultimate-guitar.com/tab/x-1', (p) => events.push(p.type))

    expect(events).toEqual(['StageStart', 'Succeeded'])
    expect(result).toEqual({ data: 'G riff', filename: 'Radiohead - Creep.tab.txt' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/import')
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://tabs.ultimate-guitar.com/tab/x-1' })
  })

  it('reassembles a JSON line split across stream chunks', async () => {
    const full = JSON.stringify({ done: { content: 'plain', artist: 'A', song: 'B' } }) + '\n'
    const mid = Math.floor(full.length / 2)
    fetchMock.mockResolvedValue(ndjson([full.slice(0, mid), full.slice(mid)]))

    const result = await getSheetFromUG('https://x')
    expect(result).toEqual({ data: 'plain', filename: 'A - B.tab.txt' })
  })

  it('throws the reason carried by a terminal {error} line', async () => {
    fetchMock.mockResolvedValue(ndjson([JSON.stringify({ error: 'not a valid UG url' }) + '\n']))

    await expect(getSheetFromUG('https://x')).rejects.toThrow('not a valid UG url')
  })
})

// ── HTTP JamHost ──────────────────────────────────────────────────────────────

describe('http JamHost', () => {
  beforeEach(() => {
    // A plain browser window (no __TAURI_INTERNALS__) reached the server on this
    // location; the host derives port/urls from it.
    vi.stubGlobal('window', { location: { port: '8080', host: 'jam.local:8080' } })
  })

  it('status fills port/urls from window.location when hosting', async () => {
    fetchMock.mockResolvedValue(ok({ hosting: true, name: 'klank-jam', clients: 2 }))

    const host = await createJamHost()
    expect(await host.status()).toEqual({
      hosting: true,
      name: 'klank-jam',
      clients: 2,
      port: 8080,
      urls: ['jam.local:8080'],
    })
  })

  it('status reports null port and empty urls when not hosting', async () => {
    fetchMock.mockResolvedValue(ok({ hosting: false, name: null, clients: 0 }))

    const host = await createJamHost()
    expect(await host.status()).toEqual({
      hosting: false,
      name: null,
      clients: 0,
      port: null,
      urls: [],
    })
  })

  it('start posts the name and returns host info from window.location', async () => {
    fetchMock.mockResolvedValue(ok({ name: 'klank-jam' }))

    const host = await createJamHost()
    expect(await host.start('klank-jam')).toEqual({
      name: 'klank-jam',
      port: 8080,
      urls: ['jam.local:8080'],
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/jam/start')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'klank-jam' })
  })
})
