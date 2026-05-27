import { invoke } from '@tauri-apps/api/core'

export const getSheetFromUG = async (url: string) => {
  if (!url) return

  // Loads the UG page in a hidden Tauri webview so Cloudflare's JS challenge
  // is solved by real Chromium, then returns the `data-content` attribute of
  // the `.js-store` element directly (the page already knows where the data
  // lives, so no HTML regex is needed on this side).
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
