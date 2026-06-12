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

  try {
    const json = JSON.parse(dataContent)

    const content = json?.store?.page?.data?.tab_view?.wiki_tab?.content
    if (content === undefined || content === null) return

    const data = content.toString().replace(/\[\/?(ch|tab)\]/g, '')

    const artist = json.store.page.data.tab?.artist_name ?? ''
    const title = json.store.page.data.tab?.song_name ?? ''

    const filename = `${artist} - ${title}.tab.txt`
    return { data, filename }
  } catch (error) {
    // UG page shape changed or Cloudflare served an HTML challenge page
    console.error('Failed to parse UG response:', error)
    return
  }
}
