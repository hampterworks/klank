import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

// download.ts statically imports invoke + Channel from @tauri-apps/api/core, so
// mock the module. The fake Channel lets a test drive progress callbacks.
vi.mock('@tauri-apps/api/core', () => {
  class Channel<T> {
    onmessage: ((message: T) => void) | null = null
  }
  return { invoke: vi.fn(), Channel }
})

import { invoke } from '@tauri-apps/api/core'
import { getSheetFromUG, type ImportProgress } from './download.js'

// getSheetFromUG branches on isTauri(); present a Tauri webview so these tests
// exercise the scrape_ug path (the HTTP NDJSON path is covered in
// http-services.spec.ts).
vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })

const invokeMock = invoke as Mock

describe('getSheetFromUG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined for a falsy url without invoking', async () => {
    expect(await getSheetFromUG('')).toBeUndefined()
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('strips [ch]/[tab] markup and builds the filename', async () => {
    invokeMock.mockResolvedValue(
      JSON.stringify({ content: '[ch]G[/ch] [tab]riff[/tab]', artist: 'Radiohead', song: 'Creep' }),
    )

    const result = await getSheetFromUG('https://tabs.ultimate-guitar.com/tab/x-1')

    expect(result).toEqual({ data: 'G riff', filename: 'Radiohead - Creep.tab.txt' })
  })

  it('forwards pipeline progress to onProgress in order', async () => {
    const start: ImportProgress = { type: 'StageStart', id: 'ug-mobile-api', label: 'UG app API', index: 1, total: 2 }
    const done: ImportProgress = { type: 'Succeeded', id: 'ug-mobile-api', label: 'UG app API' }

    invokeMock.mockImplementation(async (_cmd: string, args: { onProgress?: { onmessage: (m: ImportProgress) => void } }) => {
      args.onProgress?.onmessage(start)
      args.onProgress?.onmessage(done)
      return JSON.stringify({ content: 'plain', artist: 'A', song: 'B' })
    })

    const events: ImportProgress[] = []
    const result = await getSheetFromUG('https://tabs.ultimate-guitar.com/tab/x-1', (p) => events.push(p))

    expect(events).toEqual([start, done])
    expect(result?.filename).toBe('A - B.tab.txt')
  })

  it('returns undefined when the payload has no content', async () => {
    invokeMock.mockResolvedValue(JSON.stringify({ content: '', artist: 'A', song: 'B' }))
    expect(await getSheetFromUG('https://tabs.ultimate-guitar.com/tab/x-1')).toBeUndefined()
  })

  it('returns undefined when the response is not valid JSON', async () => {
    invokeMock.mockResolvedValue('<html>not json</html>')
    expect(await getSheetFromUG('https://tabs.ultimate-guitar.com/tab/x-1')).toBeUndefined()
  })

  it('propagates a rejection when every import stage fails', async () => {
    invokeMock.mockRejectedValue(new Error('all import methods failed — …'))
    await expect(getSheetFromUG('https://tabs.ultimate-guitar.com/tab/x-1')).rejects.toThrow('all import methods failed')
  })
})
