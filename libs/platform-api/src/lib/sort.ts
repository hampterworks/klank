import { FileEntry, PlayMetric } from './fs'

export type SortedFileEntry = Record<string, FileEntry[]>

const matchesFilter = (files: FileEntry[], searchFilter?: string): FileEntry[] =>
  searchFilter
    ? files.filter((item) =>
      item.name.toLowerCase().includes(searchFilter.toLowerCase())
    )
    : files

export const sortByArtist = (
  files: FileEntry[],
  searchFilter?: string
): SortedFileEntry => {
  const sortedFiles = matchesFilter(files, searchFilter)

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

/**
 * Flat "recently played" ordering: songs with a play metric first, most-recent
 * first; then never-played songs alphabetically by name. Applies the same
 * name filter as `sortByArtist`.
 */
export const sortByRecency = (
  files: FileEntry[],
  playMetricByPath: Record<string, PlayMetric>,
  searchFilter?: string
): FileEntry[] => {
  const filtered = matchesFilter(files, searchFilter)
  const played: FileEntry[] = []
  const neverPlayed: FileEntry[] = []
  for (const file of filtered) {
    if (playMetricByPath[file.path]) played.push(file)
    else neverPlayed.push(file)
  }
  played.sort(
    (a, b) =>
      playMetricByPath[b.path].lastPlayedAt - playMetricByPath[a.path].lastPlayedAt
  )
  neverPlayed.sort((a, b) => a.name.localeCompare(b.name))
  return [...played, ...neverPlayed]
}

/**
 * Compact relative time from an epoch-ms timestamp to now, e.g. "just now",
 * "5m ago", "2d ago". Used for the per-song play-info tooltip.
 */
export const formatRelativeTime = (timestamp: number, now: number = Date.now()): string => {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${Math.max(1, months)}mo ago`
  const years = Math.floor(days / 365)
  return `${Math.max(1, years)}y ago`
}
