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
    const currentArtist = currentValue.artist.toLowerCase()
    if (previousValue[currentArtist]) {
      previousValue[currentArtist].push(currentValue)
    } else {
      if (currentValue.song !== undefined) {
        previousValue[currentArtist] = [currentValue]
      } else {
        previousValue['unknown'] = [
          ...(previousValue['unknown'] ?? []),
          currentValue,
        ]
      }
    }
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
