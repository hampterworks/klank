import { invoke, Channel } from '@tauri-apps/api/core'
import { isTauri } from './platform'

/**
 * Progress events streamed by the `scrape_ug` import pipeline, one per stage
 * attempt. Mirrors the Rust `ImportProgress` enum (`#[serde(tag = "type")]`).
 */
export type ImportProgress =
  | { type: 'StageStart'; id: string; label: string; index: number; total: number }
  | { type: 'StageFailed'; id: string; label: string; reason: string }
  | { type: 'Succeeded'; id: string; label: string }

/** Normalised tab payload returned by the import pipeline on success. */
type NormalizedTab = { content: string; artist: string; song: string }

/**
 * Runs the Rust `scrape_ug` command (mobile API → website scrape → real-browser
 * webview) inside a Tauri webview, returning the normalised tab or `undefined`.
 */
const importViaTauri = async (
  url: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<NormalizedTab | undefined> => {
  let channel: Channel<ImportProgress> | undefined
  if (onProgress) {
    channel = new Channel<ImportProgress>()
    channel.onmessage = onProgress
  }

  const raw = await invoke<string>('scrape_ug', { url, onProgress: channel })
  if (!raw) return

  try {
    return JSON.parse(raw) as NormalizedTab
  } catch (error) {
    // Shape changed unexpectedly — surface nothing rather than a broken file.
    console.error('Failed to parse UG import response:', error)
    return
  }
}

/**
 * Runs the two headless import stages via the klank-server `POST /api/import`
 * NDJSON stream: each line is either an `ImportProgress`, the terminal
 * `{done}` payload, or a terminal `{error}` line (which throws).
 */
const importViaHttp = async (
  url: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<NormalizedTab | undefined> => {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const reader = res.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''
  let result: NormalizedTab | undefined

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const parsed = JSON.parse(trimmed) as
      | ImportProgress
      | { done: NormalizedTab }
      | { error: string }
    if ('type' in parsed) onProgress?.(parsed)
    else if ('error' in parsed) throw new Error(parsed.error)
    else if ('done' in parsed) result = parsed.done
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handleLine(line)
  }
  handleLine(buffer)

  return result
}

/**
 * Imports a guitar tab from an Ultimate Guitar URL.
 *
 * Runs the layered import pipeline — via the Rust `scrape_ug` command in a Tauri
 * webview, or the klank-server `POST /api/import` NDJSON stream in a browser —
 * then strips UG's `[ch]`/`[tab]` markup and builds the `Artist - Song.tab.txt`
 * filename.
 *
 * @param url A valid Ultimate Guitar tab URL.
 * @param onProgress Optional callback invoked for each pipeline stage, used to
 *   show a nonintrusive "which method is running" status in the UI.
 * @returns `{ data, filename }`, or `undefined` if `url` is falsy or the
 *   response can't be parsed. Throws (rejects) if every import stage fails.
 */
export const getSheetFromUG = async (
  url: string,
  onProgress?: (progress: ImportProgress) => void,
) => {
  if (!url) return

  const tab = isTauri()
    ? await importViaTauri(url, onProgress)
    : await importViaHttp(url, onProgress)
  if (!tab?.content) return

  const data = tab.content.replace(/\[\/?(ch|tab)\]/g, '')
  const filename = `${tab.artist ?? ''} - ${tab.song ?? ''}.tab.txt`
  return { data, filename }
}
