import { FileEntry } from './fs'

export type SortedFileEntry = Record<string, FileEntry[]>

export const sortByArtist = (
  files: FileEntry[],
  searchFilter?: string
): SortedFileEntry => {
  const sortedFiles = searchFilter
    ? files.filter((item) =>
      item.name.toLowerCase().includes(searchFilter.toLowerCase())
    )
    : files

  const unsortedResult = sortedFiles.reduce((previousValue, currentValue) => {
    // Files without a ` - ` separator have no song name and always group
    // under "unknown", regardless of what group their artist field landed in.
    const key = currentValue.song !== undefined
      ? currentValue.artist.toLowerCase()
      : 'unknown'
    previousValue[key] = [...(previousValue[key] ?? []), currentValue]
    return previousValue
  }, {} as SortedFileEntry)

  if (!searchFilter) {
    return Object.fromEntries(
      Object.entries(unsortedResult).sort(([a], [b]) => {
        if (a === 'unknown') return 1
        if (b === 'unknown') return -1
        return a.localeCompare(b)
      })
    )
  }

  return unsortedResult
}
