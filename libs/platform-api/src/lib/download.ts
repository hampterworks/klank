import { invoke, Channel } from '@tauri-apps/api/core'

/**
 * Progress events streamed by the `scrape_ug` import pipeline, one per stage
 * attempt. Mirrors the Rust `ImportProgress` enum (`#[serde(tag = "type")]`).
 */
export type ImportProgress =
  | { type: 'StageStart'; id: string; label: string; index: number; total: number }
  | { type: 'StageFailed'; id: string; label: string; reason: string }
  | { type: 'Succeeded'; id: string; label: string }

/** Normalised tab payload returned by the `scrape_ug` command on success. */
type NormalizedTab = { content: string; artist: string; song: string }

/**
 * Imports a guitar tab from an Ultimate Guitar URL.
 *
 * Delegates to the Rust `scrape_ug` command, which runs a layered import
 * pipeline (mobile API → website scrape → real-browser webview) and returns a
 * normalised `{ content, artist, song }` payload. This function strips UG's
 * `[ch]`/`[tab]` markup and builds the `Artist - Song.tab.txt` filename.
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

  let channel: Channel<ImportProgress> | undefined
  if (onProgress) {
    channel = new Channel<ImportProgress>()
    channel.onmessage = onProgress
  }

  const raw = await invoke<string>('scrape_ug', { url, onProgress: channel })
  if (!raw) return

  try {
    const tab = JSON.parse(raw) as NormalizedTab
    if (!tab.content) return

    const data = tab.content.replace(/\[\/?(ch|tab)\]/g, '')
    const filename = `${tab.artist ?? ''} - ${tab.song ?? ''}.tab.txt`
    return { data, filename }
  } catch (error) {
    // Shape changed unexpectedly — surface nothing rather than a broken file.
    console.error('Failed to parse UG import response:', error)
    return
  }
}
