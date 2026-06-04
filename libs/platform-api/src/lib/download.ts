import { invoke } from '@tauri-apps/api/core'

/**
 * Downloads a guitar tab from an Ultimate Guitar URL.
 *
 * Opens a hidden Tauri webview via the `scrape_ug` Rust command, which loads the
 * UG page in real Chromium (required for Cloudflare JS challenges). The webview
 * extracts the `.js-store` JSON and returns it to Rust; this function then parses
 * out the tab content and strips UG's `[ch]`/`[tab]` markup tags.
 *
 * @param url A valid Ultimate Guitar tab URL.
 * @returns `{ data, filename }` where `data` is the plain-text tab content and
 *          `filename` follows the `Artist - Song.tab.txt` convention, or
 *          `undefined` if `url` is falsy or parsing fails.
 */
export const getSheetFromUG = async (url: string) => {
  if (!url) return

  const dataContent = await invoke<string>('scrape_ug', { url })
  if (!dataContent) return

  const json = JSON.parse(dataContent)

  const data = json.store.page.data.tab_view.wiki_tab.content
    .toString()
    .replace(/(\[(ch|tab)\]|\[(\/)?(ch|tab)\])/g, '')

  const artist = json.store.page.data.tab.artist_name ?? ''
  const title = json.store.page.data.tab.song_name ?? ''

  const filename = `${artist} - ${title}.tab.txt`
  return { data, filename }
}
