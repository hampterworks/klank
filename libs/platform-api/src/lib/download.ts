export const getSheetFromUG = async (url: string) => {
  if (!url) return

  const result = await fetch(url)
  const htmlData = await result.text()

  // Extract data-content using regex
  const match = htmlData.match(/class="js-store"[^>]*data-content="([^"]*)"/)
  if (!match) return

  const dataContent = match[1].replace(/&quot;/g, '"') // Decode HTML entities
  const json = JSON.parse(dataContent)

  const data = json.store.page.data.tab_view.wiki_tab.content.toString().replace(/(\[(ch|tab)\]|\[(\/)?(ch|tab)\])/g, '')

  const artist = json.store.page.data.tab.artist_name ?? ""
  const title = json.store.page.data.tab.song_name ?? ""

  const filename = `${artist} - ${title}.tab.txt`
  console.log(filename)
  console.log(data)
  return data
}
